import { expect, test } from '@playwright/test';

import { TranslatorScreen } from './pom/TranslatorScreen';
import { startTranslator } from './support/app';
import { mockOpenAIError, mockTranslation } from './support/openai-mock';

test.describe('Text translation', () => {
  test('translates typed text via the typed-text path', async ({ page }) => {
    await mockTranslation(page, 'Привет, мир');
    await startTranslator(page);
    const screen = new TranslatorScreen(page);

    await screen.translateText('Hola mundo');

    await expect(screen.translatedText).toHaveText('Привет, мир');
    await expect(screen.originalText).toHaveText('Hola mundo');
  });

  test('surfaces an error when the API call fails', async ({ page }) => {
    await mockOpenAIError(page);
    await startTranslator(page);
    const screen = new TranslatorScreen(page);

    await screen.translateText('Hola mundo');

    await expect(screen.errorText).toBeVisible();
    await expect(screen.translatedText).toHaveCount(0);
  });
});
