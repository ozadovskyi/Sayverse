/**
 * Pure helpers for interpreting Whisper transcription output.
 *
 * No SDK, no I/O — kept separate from `openai.ts` so it is unit-testable in
 * clean Node.
 */

/** The one field of a Whisper `verbose_json` segment used for silence detection. */
export interface WhisperSegment {
  /** Whisper's own probability that the segment is not speech (0–1). */
  no_speech_prob: number;
}

// Whisper's own default no-speech threshold. A real-speech segment scores
// near 0; silence scores near 1.
const NO_SPEECH_THRESHOLD = 0.6;

/**
 * Whether a clip is silence. Whisper hallucinates words ("you", "Thank you")
 * when handed silence, so an empty-text check is not enough — the text is
 * non-empty garbage. Here a clip counts as silence when it has no segments,
 * or every segment is confidently non-speech. Requiring *all* segments to be
 * non-speech keeps false positives near zero: one genuine utterance always
 * produces at least one low-`no_speech_prob` segment.
 */
export function isSilentTranscription(segments: WhisperSegment[]): boolean {
  if (segments.length === 0) return true;
  return segments.every(s => s.no_speech_prob > NO_SPEECH_THRESHOLD);
}
