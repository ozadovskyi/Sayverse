import { expect, test } from '@playwright/test';

import type { ConversationSession } from '../../constants/conversation';
import { testIDs } from '../../constants/testIDs';
import { seedConversations, startTranslator } from './support/app';

// On web AsyncStorage is localStorage-backed, so persisted conversation
// history is web-testable: we seed sessions into storage before boot (the
// voice path that would normally create them needs a microphone) and verify
// the restore-on-enter behaviour and the History browser.

/** An es→ru session with one turn. */
const esru: ConversationSession = {
  id: 'seed-esru',
  langA: 'es',
  langB: 'ru',
  createdAt: 1000,
  updatedAt: 2000,
  turns: [
    {
      id: 'turn-esru-1',
      sourceLang: 'es',
      targetLang: 'ru',
      originalText: 'Hola desde el historial',
      translatedText: 'Привет из истории',
      createdAt: 1500,
    },
  ],
};

/** An en→fr session with one turn — a different pair, more recently updated. */
const enfr: ConversationSession = {
  id: 'seed-enfr',
  langA: 'en',
  langB: 'fr',
  createdAt: 2500,
  updatedAt: 3000,
  turns: [
    {
      id: 'turn-enfr-1',
      sourceLang: 'en',
      targetLang: 'fr',
      originalText: 'Hello from history',
      translatedText: 'Bonjour depuis l’historique',
      createdAt: 2700,
    },
  ],
};

test.describe('Conversation history', () => {
  test('entering conversation mode resumes the latest session for the pair', async ({
    page,
  }) => {
    // The default pair is es→ru, so the es→ru session should be restored —
    // not the more recently updated en→fr one.
    await seedConversations(page, [enfr, esru]);
    await startTranslator(page);

    await page.getByTestId(testIDs.mode.conversation).click();

    await expect(page.getByTestId(testIDs.conversation.turn('turn-esru-1'))).toBeVisible();
    await expect(page.getByText('Hola desde el historial')).toBeVisible();
  });

  test('the History browser lists, restores, and deletes sessions', async ({ page }) => {
    await seedConversations(page, [enfr, esru]);
    await startTranslator(page);
    await page.getByTestId(testIDs.mode.conversation).click();

    // Open History — both saved sessions are listed.
    await page.getByTestId(testIDs.conversation.historyButton).click();
    await expect(page.getByTestId(testIDs.conversation.historyModal)).toBeVisible();
    await expect(page.getByTestId(testIDs.conversation.session('seed-esru'))).toBeVisible();
    await expect(page.getByTestId(testIDs.conversation.session('seed-enfr'))).toBeVisible();

    // Selecting the en→fr session restores it and closes the modal.
    await page.getByTestId(testIDs.conversation.session('seed-enfr')).click();
    await expect(page.getByTestId(testIDs.conversation.historyModal)).toHaveCount(0);
    await expect(page.getByTestId(testIDs.conversation.turn('turn-enfr-1'))).toBeVisible();

    // Deleting a session removes it from the list; the other one stays.
    await page.getByTestId(testIDs.conversation.historyButton).click();
    await page
      .getByTestId(testIDs.conversation.sessionDeleteButton('seed-esru'))
      .click();
    await expect(page.getByTestId(testIDs.conversation.session('seed-esru'))).toHaveCount(0);
    await expect(page.getByTestId(testIDs.conversation.session('seed-enfr'))).toBeVisible();
  });
});
