import type { Page } from '@playwright/test';

// Must match `KEY` in services/keyStorage.ts. That module cannot be imported
// here — it pulls in react-native — so the value is duplicated deliberately.
const API_KEY_STORAGE = 'openai_api_key';
const TEST_API_KEY = 'sk-test-playwright-key';

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
