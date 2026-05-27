/**
 * Pure decision logic for on-device silence detection during voice
 * recording. Kept separate from the React hook so it is exhaustively
 * unit-testable in clean Node — every transition the device cares about
 * is covered without spinning up renderers or fake timers in the hook.
 *
 * 2026 best-practice targets (research-derived, see plan docs):
 *  - dictation / single-utterance translator is stricter than
 *    conversational AI (ChatGPT Realtime ~500 ms) but more lenient than
 *    Apple Dictation (30 s).
 *  - voice threshold of −40 dBFS catches indoor speech reliably without
 *    flagging quiet rooms; OpenAI Realtime VAD lands in roughly the
 *    same band.
 *  - a 500 ms startup grace blocks the recorder's "no metering yet"
 *    period from triggering an immediate "no speech".
 */

/** Why the recording was auto-stopped. `null` means it is still running. */
export type AutoStopReason = 'noSpeech' | 'silence' | 'maxDuration' | null;

export interface SilenceDetectionInput {
  /** Current monotonic time in milliseconds. */
  now: number;
  /** When the recording started, on the same clock as `now`. */
  startedAt: number;
  /**
   * Last time the input level was at or above the speech threshold, on
   * the same clock as `now`. `null` if no level update has yet crossed
   * the threshold since recording started.
   */
  lastVoiceAt: number | null;
}

export interface SilenceDetectionConfig {
  /** dBFS at or above which a level reading counts as voice. */
  voiceThresholdDb: number;
  /** Startup grace before "no speech" can fire — masks recorder warmup. */
  startupGraceMs: number;
  /**
   * Once startup grace has passed, if no voice has been heard yet, fire
   * `noSpeech` this many ms later.
   */
  initialTimeoutMs: number;
  /** Silence ms after voice was last heard before `silence` fires. */
  trailingTimeoutMs: number;
  /** Hard ceiling — recording cannot run longer than this. */
  maxDurationMs: number;
}

/**
 * Default configuration tuned for a single-utterance voice translator.
 * Conversational AI agents want lower trailing values (500–800 ms); a
 * translator wants users to be able to compose a sentence with a small
 * pause in the middle. See research notes.
 */
export const DEFAULT_SILENCE_CONFIG: SilenceDetectionConfig = {
  voiceThresholdDb: -40,
  startupGraceMs: 500,
  initialTimeoutMs: 2000,
  trailingTimeoutMs: 1800,
  maxDurationMs: 60_000,
};

/**
 * Decide whether to stop the recording, given the current clock + last
 * voice timestamp. Pure — no side effects, no timers, no React. The
 * caller (the hook) drives this on every level update and on every
 * scheduled tick.
 *
 * Priority: maxDuration > silence (after voice) > noSpeech (before voice).
 * Returning `null` means keep going.
 */
export function evaluateSilence(
  { now, startedAt, lastVoiceAt }: SilenceDetectionInput,
  config: SilenceDetectionConfig = DEFAULT_SILENCE_CONFIG,
): AutoStopReason {
  const elapsed = now - startedAt;
  if (elapsed >= config.maxDurationMs) return 'maxDuration';

  if (lastVoiceAt !== null) {
    // Voice has been heard at least once — watch for trailing silence.
    if (now - lastVoiceAt >= config.trailingTimeoutMs) return 'silence';
    return null;
  }

  // No voice yet. Hold off during the startup grace so the recorder's
  // first quiet 100 ms doesn't fire a false "no speech".
  if (elapsed < config.startupGraceMs + config.initialTimeoutMs) return null;
  return 'noSpeech';
}

/** Whether a given dBFS reading counts as voice under the active config. */
export function isVoiceLevel(
  db: number,
  config: SilenceDetectionConfig = DEFAULT_SILENCE_CONFIG,
): boolean {
  return db >= config.voiceThresholdDb;
}
