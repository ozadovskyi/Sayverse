import { expect, test } from '@playwright/test';

import { testIDs } from '../../constants/testIDs';
import { startTranslator } from './support/app';

// The conversation voice flow needs a microphone, which web has no access
// to — that path is covered by the Maestro native layer. These tests cover
// what is web-testable: the mode switch and the dialogue view rendering.
test.describe('Conversation mode', () => {
  test('switching to conversation mode shows the dialogue view', async ({ page }) => {
    await startTranslator(page);

    await page.getByTestId(testIDs.mode.conversation).click();

    await expect(page.getByTestId(testIDs.conversation.view)).toBeVisible();
    // The typed-text path belongs to single-shot mode only.
    await expect(page.getByTestId(testIDs.textInput.field)).toHaveCount(0);
  });

  test('switching back restores single-shot mode', async ({ page }) => {
    await startTranslator(page);

    await page.getByTestId(testIDs.mode.conversation).click();
    await page.getByTestId(testIDs.mode.singleShot).click();

    await expect(page.getByTestId(testIDs.textInput.field)).toBeVisible();
  });
});
