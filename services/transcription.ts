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
 * Whether a transcript is a Whisper repetition loop — the decoder falling
 * into a degenerate regime where it emits the same phrase 2+ times on a
 * short or silent clip ("Hello, how are you? Hello, how are you?", "Thank
 * you for watching. Thank you for watching."). These pass the
 * `no_speech_prob` and `avg_logprob` gates because the model is
 * confidently wrong: high-probability tokens, low silence score, but the
 * output is still hallucination.
 *
 * Heuristic: a contiguous sequence of ≥2 words and ≥8 characters that
 * appears 2+ times in the output. The 8-character floor avoids flagging
 * natural repetition of common stop-word pairs ("the the"); the 2-word
 * floor avoids flagging single-word emphasis. Requires ≥6 total words
 * before checking — shorter outputs do not have room for a repetition
 * signal that is confidently distinct from real speech.
 */
export function isRepetitive(text: string): boolean {
  const words = text
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0);
  if (words.length < 6) return false;

  // Walk from the longest possible repeating phrase down to 2 words.
  // First match wins — we don't need the maximal one.
  for (let n = Math.floor(words.length / 2); n >= 2; n--) {
    for (let i = 0; i <= words.length - n * 2; i++) {
      const phrase = words.slice(i, i + n).join(' ');
      if (phrase.length < 8) continue;
      const rest = words.slice(i + n).join(' ');
      if (rest.includes(phrase)) return true;
    }
  }
  return false;
}

/**
 * Whether a clip carries no translatable speech. Whisper hallucinates on
 * non-speech audio — inventing words on silence ("you", "Thank you"),
 * note glyphs on music ("♪ ♪"), and falling into repetition loops on
 * short clips — so an empty-text check is not enough.
 *
 * A clip counts as non-speech when any of these hold:
 *  - the transcript is only non-lexical annotation ({@link isNonLexicalText});
 *  - it has no segments at all;
 *  - the output is a repetition loop ({@link isRepetitive}) — confidently
 *    wrong rather than confidently silent, which slips past the
 *    probability gates below;
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
  if (isRepetitive(text)) return true;
  return segments.every(isNonSpeechSegment);
}
