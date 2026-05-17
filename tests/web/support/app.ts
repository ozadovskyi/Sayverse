import type { Page } from '@playwright/test';

import type { ConversationSession } from '../../../constants/conversation';

// Must match `KEY` in services/keyStorage.ts. That module cannot be imported
// here — it pulls in react-native — so the value is duplicated deliberately.
const API_KEY_STORAGE = 'openai_api_key';
const TEST_API_KEY = 'sk-test-playwright-key';

// Must match `STORAGE_KEY` in storage/conversationStorage.ts.
const CONVERSATIONS_STORAGE = 'conversation_sessions';

/**
 * Navigate straight to the translator screen by seeding an API key into
 * localStorage before the app boots, skipping the setup screen.
 */
export async function startTranslator(page: Page) {
  await page.addInitScript(
    ([storageKey, value]) => {
      window.localStorage.setItem(storageKey, value);
    },
    [API_KEY_STORAGE, TEST_API_KEY],
  );
  await page.goto('/');
}

/**
 * Seed persisted conversation sessions into localStorage before the app
 * boots. On web AsyncStorage is localStorage-backed, so this is exactly what
 * the app would read back. Call before `startTranslator`.
 */
export async function seedConversations(page: Page, sessions: ConversationSession[]) {
  await page.addInitScript(
    ([storageKey, json]) => {
      window.localStorage.setItem(storageKey, json);
    },
    [CONVERSATIONS_STORAGE, JSON.stringify(sessions)],
  );
}
