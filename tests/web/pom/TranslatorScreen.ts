import type { Locator, Page } from '@playwright/test';

import { testIDs } from '../../../constants/testIDs';

/** Page Object for the main translator screen. */
export class TranslatorScreen {
  readonly recordButton: Locator;
  readonly textField: Locator;
  readonly translateButton: Locator;
  readonly settingsButton: Locator;
  readonly sourceButton: Locator;
  readonly targetButton: Locator;
  readonly swapButton: Locator;
  readonly originalText: Locator;
  readonly translatedText: Locator;
  readonly errorText: Locator;

  constructor(private readonly page: Page) {
    this.recordButton = page.getByTestId(testIDs.record.button);
    this.textField = page.getByTestId(testIDs.textInput.field);
    this.translateButton = page.getByTestId(testIDs.textInput.translateButton);
    this.settingsButton = page.getByTestId(testIDs.header.settingsButton);
    this.sourceButton = page.getByTestId(testIDs.language.sourceButton);
    this.targetButton = page.getByTestId(testIDs.language.targetButton);
    this.swapButton = page.getByTestId(testIDs.language.swapButton);
    this.originalText = page.getByTestId(testIDs.translation.originalText);
    this.translatedText = page.getByTestId(testIDs.translation.translatedText);
    this.errorText = page.getByTestId(testIDs.translation.errorText);
  }

  /** Type text and submit it via the typed-text translation path. */
  async translateText(text: string) {
    await this.textField.fill(text);
    // The button enables once the field is non-empty; Playwright's
    // actionability wait covers the React re-render.
    await this.translateButton.click();
  }

  /** Open the language picker and choose a language by its ISO code. */
  async pickLanguage(which: 'source' | 'target', code: string) {
    await (which === 'source' ? this.sourceButton : this.targetButton).click();
    await this.page.getByTestId(testIDs.language.option(code)).click();
  }
}
