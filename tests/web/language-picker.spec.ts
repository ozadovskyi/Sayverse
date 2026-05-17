import { expect, test } from '@playwright/test';

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
});
