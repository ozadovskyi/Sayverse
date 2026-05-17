import { expect, test } from '@playwright/test';

import { testIDs } from '../../constants/testIDs';
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

  test('auto-detects the language and routes the direction', async ({ page }) => {
    // The picker defaults to Spanish→Russian. Detection reports the input is
    // Russian, so the translation must route Russian→Spanish instead.
    await mockTranslation(page, 'Hola', 'ru');
    await startTranslator(page);
    const screen = new TranslatorScreen(page);

    await screen.translateText('Привет');

    await expect(screen.translatedText).toHaveText('Hola');
    // The result card labels the source panel Russian and the target Spanish.
    await expect(
      page.getByTestId(`${testIDs.translation.card}-original`),
    ).toContainText('Russian');
    await expect(
      page.getByTestId(`${testIDs.translation.card}-translated`),
    ).toContainText('Spanish');
  });

  test('reverses the translation direction on demand', async ({ page }) => {
    // Detection defaults to Spanish, so the first pass routes Spanish→Russian.
    await mockTranslation(page, 'resultado');
    await startTranslator(page);
    const screen = new TranslatorScreen(page);

    await screen.translateText('hello');
    await expect(
      page.getByTestId(`${testIDs.translation.card}-original`),
    ).toContainText('Spanish');

    // Tapping reverse re-translates the same text the other way.
    await page.getByTestId(testIDs.translation.reverseButton).click();
    await expect(
      page.getByTestId(`${testIDs.translation.card}-original`),
    ).toContainText('Russian');
    await expect(
      page.getByTestId(`${testIDs.translation.card}-translated`),
    ).toContainText('Spanish');
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
