import AsyncStorage from '@react-native-async-storage/async-storage';
import { render } from '@testing-library/react-native';

import App from '../../../App';
import type { ConversationSession } from '../../../constants/conversation';
import * as keyStorage from '../../../services/keyStorage';
import * as openai from '../../../services/openai';

/**
 * Test helpers for the component layer. The service modules are mocked
 * globally in setup.ts; these functions arrange a scenario by configuring
 * those mocks, then `renderApp` mounts the real, assembled `<App />`.
 */

/** Mount the full app. Pair with `findBy*` — the first-run effects are async. */
export function renderApp() {
  return render(<App />);
}

/** A stored API key is present — the app boots straight to the translator. */
export function mockSignedIn() {
  jest.mocked(keyStorage.getApiKey).mockResolvedValue('sk-test-component-key');
}

/** No stored key — the app shows the first-run setup screen. */
export function mockSignedOut() {
  jest.mocked(keyStorage.getApiKey).mockResolvedValue(null);
}

/**
 * Make the typed-text path succeed. The path calls `detectLanguage` first
 * (it reports the input language as `detected`), then `translateText`.
 */
export function mockTranslation(translated: string, detected = 'es') {
  jest.mocked(openai.detectLanguage).mockResolvedValue(detected);
  jest.mocked(openai.translateText).mockResolvedValue(translated);
}

/** Make the translation API fail — surfaces the on-screen error. */
export function mockTranslationError() {
  const fail = () => Promise.reject(new Error('Mocked API failure'));
  jest.mocked(openai.detectLanguage).mockImplementation(fail);
  jest.mocked(openai.translateText).mockImplementation(fail);
}

/** Seed persisted conversation sessions, exactly as `conversationStorage` writes them. */
export async function seedSessions(sessions: ConversationSession[]) {
  await AsyncStorage.setItem(
    'conversation_sessions',
    JSON.stringify({ version: 1, sessions }),
  );
}

/** Wipe AsyncStorage — call in `beforeEach` so persisted state can't leak. */
export async function clearStorage() {
  await AsyncStorage.clear();
}
