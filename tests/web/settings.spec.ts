import { expect, test } from '@playwright/test';

import { testIDs } from '../../constants/testIDs';
import { TranslatorScreen } from './pom/TranslatorScreen';
import { startTranslator } from './support/app';

test.describe('Settings', () => {
  test('opens the settings sheet', async ({ page }) => {
    await startTranslator(page);
    const screen = new TranslatorScreen(page);

    await screen.settingsButton.click();

    await expect(page.getByTestId(testIDs.settings.screen)).toBeVisible();
  });

  test('resetting the API key returns to the setup screen', async ({ page }) => {
    await startTranslator(page);
    const screen = new TranslatorScreen(page);

    await screen.settingsButton.click();
    await page.getByTestId(testIDs.settings.logoutButton).click();

    await expect(page.getByTestId(testIDs.setup.screen)).toBeVisible();
  });

  test('speak-aloud is off by default and toggles on', async ({ page }) => {
    await startTranslator(page);
    const screen = new TranslatorScreen(page);

    await screen.settingsButton.click();
    const toggle = page.getByTestId(testIDs.settings.speakAloudToggle);

    // Speech is opt-in — a fresh install starts with it off.
    await expect(toggle).toContainText('Off');
    await toggle.click();
    await expect(toggle).toContainText('On');
  });

  test('the speak-aloud preference persists across a reload', async ({ page }) => {
    await startTranslator(page);
    const screen = new TranslatorScreen(page);

    await screen.settingsButton.click();
    await page.getByTestId(testIDs.settings.speakAloudToggle).click();
    await expect(page.getByTestId(testIDs.settings.speakAloudToggle)).toContainText(
      'On',
    );

    await page.reload();
    await screen.settingsButton.click();
    await expect(page.getByTestId(testIDs.settings.speakAloudToggle)).toContainText(
      'On',
    );
  });
});
