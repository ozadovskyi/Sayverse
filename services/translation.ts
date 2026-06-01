import { AppError, AppErrorType } from './errors';
import { transcribeAudio, type Transcription } from './openai';

/**
 * Shared steps of the voice-translation pipeline.
 *
 * Single-shot mode (`App.tsx`) and conversation mode (`useConversation`) both
 * record audio, transcribe it, and reject empty input. That sequence used to
 * be written out in each — and had already drifted (different "no speech"
 * copy). It now lives here once; each mode keeps only its own orchestration
 * (flat state vs. the reducer's intermediate transitions).
 */

/** Identical copy in both modes — recording produced no usable input. */
const NO_AUDIO = 'No audio recorded — try again.';
const NO_SPEECH = 'No speech detected — try again.';
const AMBIGUOUS =
  "Couldn't tell which language you spoke — try a slightly longer phrase.";

/**
 * Transcribe a finished voice recording for translation: returns the spoken
 * text (trimmed) and Whisper's detected language.
 *
 * `languageHint` (ISO-639-1 lowercase) is forwarded to Whisper to remove the
 * auto-detection step on clips where the expected source language is known
 * — single-shot mode passes the picker's source. Conversation mode uses
 * {@link transcribeBilingual} instead so both languages of the pair are
 * covered by hinted calls in parallel.
 *
 * Throws an {@link AppError} — caught by each mode's existing error handler —
 * when the recording is missing or silent. `transcribeAudio` already returns
 * an empty transcript for silent audio (the Whisper hallucination gate), so
 * an empty result here means "nothing was said".
 */
export async function transcribeForTranslation(
  audioUri: string | null | undefined,
  languageHint?: string,
): Promise<{ text: string; detectedCode: string }> {
  if (!audioUri) throw new AppError(AppErrorType.NoSpeech, NO_AUDIO);

  const { text, language } = await transcribeAudio(audioUri, languageHint);
  const trimmed = text.trim();
  if (!trimmed) throw new AppError(AppErrorType.NoSpeech, NO_SPEECH);

  return { text: trimmed, detectedCode: language };
}

/**
 * Confidence floor for accepting a transcription as real speech. Whisper's
 * own `avg_logprob` sits near `0` for confident output and drops well below
 * `-1` on hallucination — `-0.9` rejects clips where neither hinted call
 * landed on real speech, without rejecting genuine but quiet utterances.
 */
const MIN_ACCEPTED_LOGPROB = -0.9;

/**
 * Bilingual transcription for conversation mode: call Whisper twice in
 * parallel — once hinted as `langA`, once as `langB` — and pick the result
 * Whisper itself believes more (higher `avgLogprob`). This is what Apple
 * Translate and Google Translate Conversation do: each parallel decoder is
 * anchored to one of the pair's languages, so neither can drift to a third
 * language (the cause of the wrong-direction routing bug Whisper's
 * unconstrained auto-detect produced on short clips).
 *
 * Single-hint failure modes the unhinted call was vulnerable to:
 *  - English-bias on short Spanish/Russian clips (Whisper biases toward its
 *    dominant training language) → the un-hinted `language` field came back
 *    as `english` and routing then defaulted to the wrong source.
 *  - Empty `language` on very short or quiet audio → same fallback path.
 *
 * Cost: 2× Whisper per turn in conversation mode (`whisper-1` is $0.006/min,
 * so ~$0.0002 per 2-second turn — negligible against the translation cost).
 * Latency is unchanged — the two calls race and the slower one waits in
 * `Promise.allSettled`.
 *
 * The returned `detectedCode` is guaranteed to be either `langA` or `langB`,
 * so downstream {@link routeLanguages} cannot land on the third-language
 * fallback path that produced the original bug.
 */
export async function transcribeBilingual(
  audioUri: string | null | undefined,
  langA: string,
  langB: string,
): Promise<{ text: string; detectedCode: string }> {
  if (!audioUri) throw new AppError(AppErrorType.NoSpeech, NO_AUDIO);

  const [resA, resB] = await Promise.allSettled([
    transcribeAudio(audioUri, langA),
    transcribeAudio(audioUri, langB),
  ]);

  // Keep only successful results whose transcripts survived the
  // non-speech / hallucination gate inside `transcribeAudio`. A rejection
  // here is a Whisper / network error — the other call can still be used.
  const candidates: { lang: string; result: Transcription }[] = [];
  if (resA.status === 'fulfilled' && resA.value.text.trim()) {
    candidates.push({ lang: langA, result: resA.value });
  }
  if (resB.status === 'fulfilled' && resB.value.text.trim()) {
    candidates.push({ lang: langB, result: resB.value });
  }

  // Both empty / both rejected — either silence or both calls hit a network
  // failure. If both rejected, propagate the first rejection so the user
  // sees a real error rather than the soft "no speech" prompt.
  if (candidates.length === 0) {
    if (resA.status === 'rejected' && resB.status === 'rejected') {
      throw resA.reason;
    }
    throw new AppError(AppErrorType.NoSpeech, NO_SPEECH);
  }

  // Pick by Whisper's own confidence — higher `avgLogprob` is the call that
  // matches the audio's actual language. The non-winning call still
  // transcribed *something* (a hinted Whisper will produce text even from
  // wrong-language audio), but at a much lower confidence — that gap is
  // the routing signal.
  const winner = candidates.reduce((best, cur) =>
    cur.result.avgLogprob > best.result.avgLogprob ? cur : best,
  );

  // Both candidates are below the hallucination floor — neither hinted
  // pass actually heard speech. Reject the turn rather than commit to a
  // direction we're not confident about. Quiet but real speech sits well
  // above this floor.
  if (winner.result.avgLogprob < MIN_ACCEPTED_LOGPROB) {
    throw new AppError(AppErrorType.NoSpeech, AMBIGUOUS);
  }

  return { text: winner.result.text.trim(), detectedCode: winner.lang };
}
