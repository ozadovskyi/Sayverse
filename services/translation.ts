import { AppError, AppErrorType } from './errors';
import { transcribeAudio } from './openai';

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

/**
 * Transcribe a finished voice recording for translation: returns the spoken
 * text (trimmed) and Whisper's detected language.
 *
 * Throws an {@link AppError} — caught by each mode's existing error handler —
 * when the recording is missing or silent. `transcribeAudio` already returns
 * an empty transcript for silent audio (the Whisper hallucination gate), so
 * an empty result here means "nothing was said".
 */
export async function transcribeForTranslation(
  audioUri: string | null | undefined,
): Promise<{ text: string; detectedCode: string }> {
  if (!audioUri) throw new AppError(AppErrorType.NoSpeech, NO_AUDIO);

  const { text, language } = await transcribeAudio(audioUri);
  const trimmed = text.trim();
  if (!trimmed) throw new AppError(AppErrorType.NoSpeech, NO_SPEECH);

  return { text: trimmed, detectedCode: language };
}
