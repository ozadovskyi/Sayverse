import { evalClient } from './client';

/**
 * Language detection for the `language-correctness` eval — it answers
 * "did the model actually translate INTO the target language, or did it
 * leave the text in the source language / drift to a third one?".
 *
 * Implemented as a tiny gpt-4o-mini call constrained to emit a bare ISO
 * 639-1 code. A library like `franc` is unreliable on the short, single-
 * sentence phrases this app handles, so we spend one cheap model call.
 */
export async function detectLanguage(text: string): Promise<string> {
  const completion = await evalClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'Identify the language of the user message. Respond with ONLY its ' +
          'ISO 639-1 code in lowercase (e.g. "en", "es", "ru", "uk"). No other text.',
      },
      { role: 'user', content: text },
    ],
    temperature: 0,
    max_tokens: 5,
  });
  return (completion.choices[0]?.message?.content ?? '').trim().toLowerCase();
}

/** Full English language name → ISO 639-1 code, for comparing against `detectLanguage`. */
export const LANGUAGE_CODES: Record<string, string> = {
  English: 'en',
  Spanish: 'es',
  Russian: 'ru',
  Ukrainian: 'uk',
};
