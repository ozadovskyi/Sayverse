import OpenAI from 'openai';

/**
 * A dedicated OpenAI client for the eval suite's own scoring calls —
 * embeddings, language detection, the LLM judge. This is separate from the
 * app's `services/openai.ts` client on purpose: the suite scores the app,
 * so its measuring instrument must not share the app's state.
 *
 * The key comes from the environment. There is no BYOK UI here — the suite
 * runs in CI (the `nightly-llm-eval` workflow) or locally with the key
 * exported. Fail loudly and early if it is missing, rather than letting
 * every test fail with an opaque 401.
 */

const key = process.env.OPENAI_API_KEY;
if (!key) {
  throw new Error(
    'OPENAI_API_KEY is not set. The llm-eval suite makes real API calls — ' +
      'export the key before running `npm run eval`.',
  );
}

/** The verified-present API key, also handed to the app for `translateText`. */
export const API_KEY: string = key;

/** Client for the suite's own scoring calls (not the app's translation calls). */
export const evalClient = new OpenAI({ apiKey: API_KEY, timeout: 30_000 });
