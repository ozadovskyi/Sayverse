import { expect, test } from '@playwright/test';

import { testIDs } from '../../constants/testIDs';
import { TranslatorScreen } from './pom/TranslatorScreen';
import { startTranslator } from './support/app';

test.describe('Language picker', () => {
  test('changes the source language', async ({ page }) => {
    await startTranslator(page);
    const screen = new TranslatorScreen(page);

    await expect(screen.sourceButton).toContainText('Spanish');
    await screen.pickLanguage('source', 'en');

    await expect(screen.sourceButton).toContainText('English');
  });

  test('swaps the source and target languages', async ({ page }) => {
    await startTranslator(page);
    const screen = new TranslatorScreen(page);

    // Defaults: source Spanish, target Russian.
    await screen.swapButton.click();

    await expect(screen.sourceButton).toContainText('Russian');
    await expect(screen.targetButton).toContainText('Spanish');
  });

  test('closes the picker with the Cancel button', async ({ page }) => {
    await startTranslator(page);
    const screen = new TranslatorScreen(page);

    await screen.sourceButton.click();
    await expect(page.getByTestId(testIDs.language.option('en'))).toBeVisible();

    await page.getByTestId(testIDs.language.cancelButton).click();
    await expect(page.getByTestId(testIDs.language.option('en'))).toHaveCount(0);
  });

  test('closes the picker by tapping the backdrop', async ({ page }) => {
    await startTranslator(page);
    const screen = new TranslatorScreen(page);

    await screen.sourceButton.click();
    await expect(page.getByTestId(testIDs.language.option('en'))).toBeVisible();

    // Tap the empty region of the backdrop, above the sheet.
    await page
      .getByTestId(testIDs.language.modalBackdrop)
      .click({ position: { x: 40, y: 40 } });
    await expect(page.getByTestId(testIDs.language.option('en'))).toHaveCount(0);
  });
});
