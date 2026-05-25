import AsyncStorage from '@react-native-async-storage/async-storage';
import { render } from '@testing-library/react-native';

import App from '../../../App';
import type { ConversationSession } from '../../../constants/conversation';
import * as useNetworkStatusMod from '../../../hooks/useNetworkStatus';
import { AppError, AppErrorType } from '../../../services/errors';
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
 * (it reports the input language as `detected`), then the streaming
 * translator. The streaming mock invokes `onProgress` once with the final
 * string and returns it — token-by-token deltas would add fixture churn
 * without changing what the rendered card asserts on.
 */
export function mockTranslation(translated: string, detected = 'es') {
  jest.mocked(openai.detectLanguage).mockResolvedValue(detected);
  jest.mocked(openai.translateText).mockResolvedValue(translated);
  jest
    .mocked(openai.translateTextStreaming)
    .mockImplementation(async (_text, _src, _tgt, onProgress) => {
      onProgress(translated);
      return translated;
    });
}

/** Make the translation API fail — surfaces the on-screen error. */
export function mockTranslationError() {
  const fail = () => Promise.reject(new Error('Mocked API failure'));
  jest.mocked(openai.detectLanguage).mockImplementation(fail);
  jest.mocked(openai.translateText).mockImplementation(fail);
  jest.mocked(openai.translateTextStreaming).mockImplementation(fail);
}

/**
 * Simulate an expired / revoked API key: detection succeeds, then translation
 * rejects with the `Auth` error the real client produces on a 401.
 */
export function mockAuthError() {
  jest.mocked(openai.detectLanguage).mockResolvedValue('es');
  const authError = new AppError(AppErrorType.Auth, 'Invalid or expired API key.');
  jest.mocked(openai.translateText).mockRejectedValue(authError);
  jest.mocked(openai.translateTextStreaming).mockRejectedValue(authError);
}

/** Flip the global network-status mock to "offline" for the next render. */
export function mockOffline() {
  // `mockImplementation` (not `mockReturnValue`) so the override survives
  // `clearMocks` cleanly across tests within a file.
  jest
    .mocked(useNetworkStatusMod.useNetworkStatus)
    .mockImplementation(() => ({ isOffline: true }));
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
