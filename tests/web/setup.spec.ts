import { expect, test } from '@playwright/test';

import { testIDs } from '../../constants/testIDs';
import { SetupScreen } from './pom/SetupScreen';

test.describe('Setup screen', () => {
  test('renders the API-key setup screen on first launch', async ({ page }) => {
    const setup = new SetupScreen(page);
    await setup.goto();

    await expect(setup.screen).toBeVisible();
    await expect(setup.apiKeyInput).toBeVisible();
    await expect(setup.saveButton).toBeVisible();
  });

  test('the setup card fits within the viewport', async ({ page }) => {
    const setup = new SetupScreen(page);
    await setup.goto();

    const viewport = page.viewportSize()!;
    const box = (await setup.saveButton.boundingBox())!;
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  });

  test('a valid key advances to the translator screen', async ({ page }) => {
    const setup = new SetupScreen(page);
    await setup.goto();

    await setup.enterKey('sk-test-playwright-key');

    await expect(page.getByTestId(testIDs.record.button)).toBeVisible();
  });
});
