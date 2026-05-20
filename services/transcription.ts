/**
 * Pure helpers for interpreting Whisper transcription output.
 *
 * No SDK, no I/O — kept separate from `openai.ts` so it is unit-testable in
 * clean Node.
 */

/** The Whisper `verbose_json` segment fields used for non-speech detection. */
export interface WhisperSegment {
  /** Whisper's own probability that the segment is not speech (0–1). */
  no_speech_prob: number;
  /**
   * Average token log-probability for the segment — the model's own
   * confidence. Genuine speech sits near 0 (≈ -0.1…-0.5); hallucinated
   * output on music or noise drops well below -1.
   */
  avg_logprob: number;
}

// Whisper's own default no-speech threshold. A real-speech segment scores
// near 0; silence scores near 1.
const NO_SPEECH_THRESHOLD = 0.6;

// Whisper's own default log-probability threshold. A segment the model is
// this unsure of is hallucinated output, not speech — this is the signal
// that catches music and noise, which no-speech detection alone misses.
const LOGPROB_THRESHOLD = -1.0;

/**
 * Whether a transcript carries no actual words — only Whisper's non-lexical
 * annotations for non-speech audio: musical notes (`♪ ♪`), `[Music]`,
 * `(upbeat music)`, `[BLANK_AUDIO]` and the like. Whisper emits these for
 * music it cannot transcribe; on their own they are not a translatable
 * utterance.
 *
 * Conservative by construction: it strips bracketed/parenthesised annotations,
 * note glyphs and punctuation, and reports `true` only when *nothing* is left.
 * Real speech is never made entirely of these, so false positives are nil.
 */
export function isNonLexicalText(text: string): boolean {
  const lexical = text
    .replace(/\[[^\]]*\]/g, ' ') // [Music], [BLANK_AUDIO]
    .replace(/\([^)]*\)/g, ' ') // (upbeat music)
    .replace(/[\p{P}\p{S}\s]/gu, ''); // note glyphs, punctuation, symbols, whitespace
  return lexical.length === 0;
}

/** Whether a single segment reads as non-speech rather than a spoken word. */
function isNonSpeechSegment(s: WhisperSegment): boolean {
  return s.no_speech_prob > NO_SPEECH_THRESHOLD || s.avg_logprob < LOGPROB_THRESHOLD;
}

/**
 * Whether a clip carries no translatable speech. Whisper hallucinates on
 * non-speech audio — inventing words on silence ("you", "Thank you") and
 * note glyphs on music ("♪ ♪") — so an empty-text check is not enough.
 *
 * A clip counts as non-speech when any of these hold:
 *  - the transcript is only non-lexical annotation ({@link isNonLexicalText});
 *  - it has no segments at all;
 *  - every segment reads as non-speech — confidently silent (`no_speech_prob`)
 *    or too low-confidence to be real words (`avg_logprob`).
 *
 * Requiring *all* segments to be non-speech keeps false positives near zero:
 * one genuine utterance always produces at least one speech-like segment.
 */
export function isNonSpeechTranscription(
  text: string,
  segments: WhisperSegment[],
): boolean {
  if (isNonLexicalText(text)) return true;
  if (segments.length === 0) return true;
  return segments.every(isNonSpeechSegment);
}
