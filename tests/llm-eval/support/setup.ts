import { initOpenAI } from '../../../services/openai';
import { API_KEY } from './client';

/**
 * Jest `setupFiles` entry for the `llm-eval` project. Initialises the app's
 * own OpenAI client so the eval files can call the real `translateText` —
 * the suite tests the shipping code path, not a reimplementation of it.
 *
 * Importing `client.ts` also runs its missing-key guard, so a misconfigured
 * run fails here, once, before any test file loads.
 */
initOpenAI(API_KEY);
