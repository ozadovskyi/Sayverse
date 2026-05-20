import { z } from 'zod';

/**
 * Pinned shape of Whisper's `verbose_json` response — *exactly* the fields
 * `transcribeAudio` reads in `services/openai.ts`. Acts as a contract: if
 * OpenAI renames or removes one of these, our reliance on that field becomes
 * explicit instead of failing silently with a cast.
 *
 * Extra fields the API returns (task, duration, tokens, …) are accepted —
 * zod by default passes them through. Only the *required* dependencies are
 * enforced. Add to this schema when production code starts to depend on a
 * new field, so the contract stays the single source of truth.
 */
export const WhisperVerboseJsonSchema = z.object({
  text: z.string(),
  language: z.string(),
  segments: z
    .array(
      z.object({
        no_speech_prob: z.number(),
        avg_logprob: z.number(),
      }),
    )
    .optional(),
});

