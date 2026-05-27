import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import {
  createSession,
  pickLatestForPair,
  type ConversationSession,
} from '../constants/conversation';
import { findByCode, resolveDirection } from '../constants/languages';
import { requestPermissions, startRecording, stopRecording } from '../services/audio';
import { AppErrorType, classifyError, userMessage } from '../services/errors';
import { translateTextStreaming } from '../services/openai';
import { speechRecognition } from '../services/speechRecognition';
import { transcribeForTranslation } from '../services/translation';
import { tts } from '../services/tts';
import { loadSessions, saveSession } from '../storage/conversationStorage';
import {
  conversationReducer,
  initialConversationState,
  type TurnDraft,
} from './conversationReducer';
import type { AutoStopReason } from './silenceDetection';
import { useSilenceDetection } from './useSilenceDetection';

/** Reasonably-unique id for sessions and turns. */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Impure shell around `conversationReducer`: runs the audio / Whisper /
 * translation / TTS pipeline and dispatches the pure state transitions.
 */
export function useConversation(
  langA: string,
  langB: string,
  speakAloud: boolean,
) {
  const [state, dispatch] = useReducer(conversationReducer, undefined, () =>
    initialConversationState(createSession(generateId(), langA, langB, Date.now())),
  );

  // Progressive translation of the in-flight draft. Kept outside the reducer
  // because (a) it's UI-only — never persisted, never replayed — and (b) it
  // changes on every streamed token, which would churn the reducer's purity
  // contract and explode the unit-test surface for no test value. Cleared on
  // every state transition that ends or supersedes the draft.
  const [liveTranslation, setLiveTranslation] = useState('');
  // On-device live transcript while the user speaks. Updated by the speech-
  // recognition listener on every partial-result event; replaced by the
  // Whisper-derived final text on TRANSCRIBED, then cleared. Same UI-only
  // contract as `liveTranslation`.
  const [liveTranscript, setLiveTranscript] = useState('');

  // Persist the session once it has turns worth keeping.
  useEffect(() => {
    if (state.session.turns.length > 0) void saveSession(state.session);
  }, [state.session]);

  // Forward-declare endRecording so the silence-detection callback can
  // reach it before its real declaration below; it is assigned the actual
  // implementation in the useEffect-style ref pattern.
  const endRecordingRef = useRef<(() => Promise<void>) | null>(null);

  const handleAutoStop = useCallback(
    async (reason: Exclude<AutoStopReason, null>) => {
      if (reason === 'noSpeech') {
        // We never heard a level above threshold. Tear the recording
        // down and surface the "didn't catch that" prompt — no Whisper
        // call, no translation, the captured audio is silence by
        // definition.
        speechRecognition.stop();
        await stopRecording();
        setLiveTranscript('');
        dispatch({
          type: 'ERROR',
          message: "Didn't catch that — tap to try again.",
          errorType: AppErrorType.NoSpeech,
        });
        return;
      }
      // 'silence' (trailing) and 'maxDuration' both mean "we have speech,
      // stop and run the normal pipeline". The reducer's RECORDING_STOPPED
      // path handles both the same way; the difference is only in the
      // upper bound that triggered it.
      await endRecordingRef.current?.();
    },
    [],
  );

  const vad = useSilenceDetection({
    isRecording: state.status === 'recording',
    onAutoStop: handleAutoStop,
  });

  const beginRecording = useCallback(async () => {
    dispatch({ type: 'START_RECORDING' });
    setLiveTranscript('');
    try {
      const granted = await requestPermissions();
      if (!granted) {
        dispatch({ type: 'ERROR', message: 'Microphone access is required.' });
        return;
      }
      await startRecording(vad.onLevel);
      // Live transcript bias: pick `langA` — the user's primary side of the
      // conversation. If the user speaks `langB` instead, the partial may
      // read as gibberish, but Whisper still routes the committed turn
      // correctly via its own detected language, so the visible glitch is
      // confined to the in-flight preview bubble.
      void speechRecognition.start(langA, setLiveTranscript);
    } catch (e: unknown) {
      const err = classifyError(e);
      dispatch({ type: 'ERROR', message: userMessage(err), errorType: err.type });
    }
  }, [langA, vad.onLevel]);

  /**
   * Run the transcribe-and-translate pipeline from a recorded audio URI. The
   * audio URI is held in the reducer (via `RECORDING_STOPPED`) so a failure
   * here leaves enough state for {@link retryTurn} to resume.
   */
  const runFromAudio = useCallback(
    async (audioUri: string | null | undefined) => {
      try {
        const { text, detectedCode } = await transcribeForTranslation(audioUri);
        const dir = resolveDirection(
          detectedCode,
          state.session.langA,
          state.session.langB,
        );
        const draft: TurnDraft = {
          id: generateId(),
          sourceLang: dir.sourceLang,
          targetLang: dir.targetLang,
          // The language Whisper actually heard, normalized to an ISO code.
          // Kept distinct from the routed `sourceLang` so the UI can show both.
          detectedLang: findByCode(detectedCode)?.code,
          originalText: text,
          createdAt: Date.now(),
        };
        dispatch({ type: 'TRANSCRIBED', draft });

        // Stream the translation into a UI-only `liveTranslation` slot so the
        // dialogue preview can render character-by-character before the turn
        // commits. `setLiveTranslation` is cleared just before TRANSLATED
        // dispatches so the committed turn (rendered from `session.turns`)
        // never visibly overlaps with the in-flight preview.
        setLiveTranslation('');
        const translated = await translateTextStreaming(
          text,
          dir.sourceName,
          dir.targetName,
          setLiveTranslation,
        );
        setLiveTranslation('');
        dispatch({ type: 'TRANSLATED', translatedText: translated });

        // Speaking the translation aloud is opt-in (Settings → Voice).
        if (speakAloud) await tts.speak(translated, dir.targetLang);
        dispatch({ type: 'SPEAKING_DONE' });
      } catch (e: unknown) {
        setLiveTranslation('');
        const err = classifyError(e);
        dispatch({ type: 'ERROR', message: userMessage(err), errorType: err.type });
      }
    },
    [state.session.langA, state.session.langB, speakAloud],
  );

  /**
   * Re-run translation for a draft that survived a translate-stage failure —
   * the transcription does not need to be repeated.
   */
  const runFromDraft = useCallback(
    async (draft: TurnDraft) => {
      try {
        const dir = resolveDirection(
          draft.detectedLang ?? draft.sourceLang,
          state.session.langA,
          state.session.langB,
        );
        setLiveTranslation('');
        const translated = await translateTextStreaming(
          draft.originalText,
          dir.sourceName,
          dir.targetName,
          setLiveTranslation,
        );
        setLiveTranslation('');
        dispatch({ type: 'TRANSLATED', translatedText: translated });
        if (speakAloud) await tts.speak(translated, dir.targetLang);
        dispatch({ type: 'SPEAKING_DONE' });
      } catch (e: unknown) {
        setLiveTranslation('');
        const err = classifyError(e);
        dispatch({ type: 'ERROR', message: userMessage(err), errorType: err.type });
      }
    },
    [state.session.langA, state.session.langB, speakAloud],
  );

  const endRecording = useCallback(async () => {
    // Stop SR before Whisper's audio pipeline unwinds so a trailing
    // partial-result event cannot overwrite the committed turn.
    speechRecognition.stop();
    const audioUri = await stopRecording();
    dispatch({ type: 'RECORDING_STOPPED', audioUri });
    // Clear the partial: the next visible source text comes from Whisper
    // via TRANSCRIBED → state.draft.originalText. Keeping the SR text on
    // screen during the transcribing window would mislead the user into
    // thinking the partial was the committed transcription.
    setLiveTranscript('');
    await runFromAudio(audioUri);
  }, [runFromAudio]);

  // Wire the VAD callback to the live endRecording. Using a ref keeps the
  // callback identity stable across endRecording rebuilds — the hook does
  // not need to re-arm its interval just because runFromAudio changed.
  useEffect(() => {
    endRecordingRef.current = endRecording;
  }, [endRecording]);

  /**
   * Resume a failed turn from the most useful preserved checkpoint:
   * - NoSpeech (the captured audio was silent) — re-running Whisper on the
   *   same file would just repeat the error, so we start a fresh recording
   *   via `beginRecording`. Matches the single-mode Retry behaviour.
   * - the draft (translate stage) if transcription already succeeded;
   * - otherwise the audio URI (transcribe stage).
   *
   * Reducer's RETRY action mirrors the latter two choices and updates
   * `status` first; the impure pipeline is replayed here.
   */
  const retryTurn = useCallback(async () => {
    if (state.status !== 'error') return;
    if (state.errorType === AppErrorType.NoSpeech) {
      await beginRecording();
      return;
    }
    if (state.retryDraft) {
      const draft = state.retryDraft;
      dispatch({ type: 'RETRY' });
      await runFromDraft(draft);
      return;
    }
    if (state.pendingAudioUri) {
      const uri = state.pendingAudioUri;
      dispatch({ type: 'RETRY' });
      await runFromAudio(uri);
    }
  }, [
    state.status,
    state.errorType,
    state.retryDraft,
    state.pendingAudioUri,
    beginRecording,
    runFromAudio,
    runFromDraft,
  ]);

  const dismissError = useCallback(() => {
    dispatch({ type: 'DISMISS_ERROR' });
  }, []);

  const startNewSession = useCallback(() => {
    tts.stop();
    dispatch({
      type: 'NEW_SESSION',
      session: createSession(generateId(), langA, langB, Date.now()),
    });
  }, [langA, langB]);

  /**
   * Resume the most recent persisted conversation for the current language
   * pair, or start a fresh one if there is none. Called on entering
   * conversation mode so a chat survives an app restart.
   */
  const resumeOrStart = useCallback(async () => {
    tts.stop();
    try {
      const previous = pickLatestForPair(await loadSessions(), langA, langB);
      if (previous) {
        dispatch({ type: 'LOAD_SESSION', session: previous });
        return;
      }
    } catch {
      // Unreadable storage — fall through to a fresh session rather than crash.
    }
    dispatch({
      type: 'NEW_SESSION',
      session: createSession(generateId(), langA, langB, Date.now()),
    });
  }, [langA, langB]);

  /** Load a specific session — used by the History browser. */
  const loadSession = useCallback((session: ConversationSession) => {
    tts.stop();
    dispatch({ type: 'LOAD_SESSION', session });
  }, []);

  /**
   * Interrupt speak-aloud playback. Stopping the speech resolves the pending
   * `tts.speak` in `endRecording`, which then dispatches `SPEAKING_DONE` —
   * so the turn-taking machine returns to `idle` on its own.
   */
  const stopSpeaking = useCallback(() => {
    tts.stop();
  }, []);

  return {
    state,
    /**
     * In-flight streaming translation of the current draft — populated only
     * while `state.status === 'translating'`, empty otherwise. Consumers
     * render a preview turn from `(state.draft, liveTranslation)` so the
     * translation appears character-by-character before the turn commits.
     */
    liveTranslation,
    /**
     * On-device live transcript while the user speaks — populated only
     * while `state.status === 'recording'`, cleared on stop. Lets consumers
     * render a preview bubble with words appearing as the user speaks,
     * before Whisper has had a chance to upload the audio.
     */
    liveTranscript,
    beginRecording,
    endRecording,
    retryTurn,
    dismissError,
    startNewSession,
    resumeOrStart,
    loadSession,
    stopSpeaking,
    /**
     * Current input level normalised to 0..1 — drives the level bar on
     * the record button so the user can see the mic actually hearing
     * them. 0 when not recording.
     */
    level: vad.level,
    /**
     * Whether the on-device VAD has heard at least one frame above the
     * voice threshold since recording started — flips the record
     * button's caption from "Listening…" to "Heard you".
     */
    hasHeardSpeech: vad.hasHeardSpeech,
  };
}
