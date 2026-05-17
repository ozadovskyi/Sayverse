import { describe, expect, it } from 'vitest';

import { translateText } from '../../services/openai';
import { detectLanguage, LANGUAGE_CODES } from './support/detect';
import { goldenItems } from './support/golden';

/**
 * Language correctness — a translation can be semantically close to the
 * reference yet still be in the wrong language (the model echoes the source,
 * or drifts to a third language). Similarity scoring alone will not catch
 * that reliably, so this eval detects the output language directly and
 * asserts it is the requested target.
 */
describe('language correctness — output is in the target language', () => {
  for (const item of goldenItems) {
    const expectedCode = LANGUAGE_CODES[item.targetLang];

    it(`${item.id}: output detected as ${item.targetLang} (${expectedCode})`, async () => {
      const output = await translateText(item.source, item.sourceLang, item.targetLang);
      expect(output).not.toBe('');

      const detected = await detectLanguage(output);
      expect(
        detected,
        `expected ${expectedCode} for "${output}", detected ${detected}`,
      ).toBe(expectedCode);
    });
  }
});
