import type { Locator, Page } from '@playwright/test';

import { testIDs } from '../../../constants/testIDs';

/** Page Object for the first-run API-key setup screen. */
export class SetupScreen {
  readonly screen: Locator;
  readonly apiKeyInput: Locator;
  readonly saveButton: Locator;

  constructor(private readonly page: Page) {
    this.screen = page.getByTestId(testIDs.setup.screen);
    this.apiKeyInput = page.getByTestId(testIDs.setup.apiKeyInput);
    this.saveButton = page.getByTestId(testIDs.setup.saveButton);
  }

  async goto() {
    await this.page.goto('/');
  }

  /** Fill the API key and submit — advances to the translator screen. */
  async enterKey(key: string) {
    await this.apiKeyInput.fill(key);
    await this.saveButton.click();
  }
}
