import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DEFAULT_SILENCE_CONFIG,
  evaluateSilence,
  isVoiceLevel,
  type AutoStopReason,
  type SilenceDetectionConfig,
} from './silenceDetection';

/**
 * Frames at or above the voice threshold required before a recording counts
 * as containing real speech. At the 100 ms tick cadence that is ~300 ms of
 * voice — enough to ignore a single tap / thud / chair-creak (one stray
 * frame), which would otherwise let an effectively-silent clip reach Whisper
 * and hallucinate a canned phrase. 2026 VAD best-practice: require a minimum
 * active duration before accepting audio as speech.
 */
const MIN_VOICE_FRAMES = 3;

interface Options {
  /** Whether a recording is in progress. Detection only runs while true. */
  isRecording: boolean;
  /**
   * Called once when the detector decides to stop the recording. The
   * caller wires this to the same path as a user-initiated stop, then
   * may surface a different toast / error message depending on the
   * reason ("Didn't catch that" for `noSpeech`, etc.).
   */
  onAutoStop: (reason: Exclude<AutoStopReason, null>) => void;
  /** Optional override of the default thresholds — used in tests. */
  config?: SilenceDetectionConfig;
}

/**
 * On-device voice-activity detector driving auto-stop of voice
 * recording. The decision logic lives in {@link evaluateSilence} (pure,
 * unit-tested); this hook is the thin React shell that:
 *
 *  1. tracks when the recording started and when voice was last heard,
 *  2. ticks every 100 ms while recording to surface the verdict, and
 *  3. surfaces a live input level + `hasHeardSpeech` flag for the UI
 *     (the record button uses these to render a level bar and switch
 *     its caption from "Listening…" to "Heard you").
 *
 * The returned `onLevel` callback is the integration point with the
 * audio service — pass it as `startRecording(onLevel)` so the recorder
 * pushes dBFS readings into the hook every 100 ms.
 */
export function useSilenceDetection({
  isRecording,
  onAutoStop,
  config = DEFAULT_SILENCE_CONFIG,
}: Options) {
  // Refs — the live timestamps and last-level reading. Refs (not state)
  // because (a) they're read by an interval tick and a callback that
  // must see the most recent value without a re-render cycle, and (b)
  // they should not by themselves trigger re-renders.
  const startedAtRef = useRef<number | null>(null);
  const lastVoiceAtRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  // Cumulative count of frames at/above the voice threshold this recording,
  // and the derived "real speech was heard" flag. Kept as a ref (not only the
  // `hasHeardSpeech` state) so the stop handler can read the verdict
  // synchronously at teardown, without a stale render closure.
  const voiceFramesRef = useRef(0);
  const heardSpeechRef = useRef(false);

  // UI-visible state — the current level (clamped, normalised 0..1 for
  // the level bar) and whether speech has been heard yet.
  const [level, setLevel] = useState(0);
  const [hasHeardSpeech, setHasHeardSpeech] = useState(false);

  // Reset every time a recording starts; clean up timers on stop.
  useEffect(() => {
    if (!isRecording) {
      startedAtRef.current = null;
      lastVoiceAtRef.current = null;
      firedRef.current = false;
      voiceFramesRef.current = 0;
      heardSpeechRef.current = false;
      setLevel(0);
      setHasHeardSpeech(false);
      return;
    }

    startedAtRef.current = Date.now();
    lastVoiceAtRef.current = null;
    firedRef.current = false;
    voiceFramesRef.current = 0;
    heardSpeechRef.current = false;
    setLevel(0);
    setHasHeardSpeech(false);

    // Tick at the same cadence as the recorder's level updates so the
    // verdict is reached in the same beat the user sees the bar drop.
    const id = setInterval(() => {
      if (firedRef.current) return;
      const start = startedAtRef.current;
      if (start === null) return;
      const verdict = evaluateSilence(
        {
          now: Date.now(),
          startedAt: start,
          lastVoiceAt: lastVoiceAtRef.current,
        },
        config,
      );
      if (verdict !== null) {
        firedRef.current = true;
        onAutoStop(verdict);
      }
    }, 100);

    return () => clearInterval(id);
  }, [isRecording, onAutoStop, config]);

  /**
   * Push a fresh dBFS reading from the recorder. Updates the
   * voice-timestamp ref (used by the next tick), the normalised level
   * for the UI, and the one-shot "heard speech" flag.
   *
   * Normalisation: clamp dBFS into [-60, 0], then map to [0, 1]. -60
   * dBFS reads as "no input"; 0 dBFS is clipping. Indoor speech sits
   * around -35..-20.
   */
  const onLevel = useCallback(
    (db: number) => {
      if (!startedAtRef.current) return;
      if (isVoiceLevel(db, config)) {
        lastVoiceAtRef.current = Date.now();
        voiceFramesRef.current += 1;
        // Flip to "heard speech" only once enough voice frames have
        // accumulated — a lone above-threshold spike is noise, not speech.
        if (voiceFramesRef.current >= MIN_VOICE_FRAMES && !heardSpeechRef.current) {
          heardSpeechRef.current = true;
          setHasHeardSpeech(true);
        }
      }
      const clamped = Math.max(-60, Math.min(0, db));
      setLevel((clamped + 60) / 60);
    },
    [config],
  );

  return { onLevel, level, hasHeardSpeech, heardSpeechRef };
}
