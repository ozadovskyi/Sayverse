import { describe, expect, it } from 'vitest';

import { translateText } from '../../services/openai';
import { goldenItems } from './support/golden';

/**
 * Prompt compliance — the app's system prompt ends "Return ONLY the
 * translation, nothing else." A model that prepends "Here is the
 * translation:" or wraps the result in quotes would have its output
 * spoken verbatim by TTS and rendered in the UI. This eval guards that
 * instruction by checking the raw output is the translation and nothing else.
 */
describe('prompt compliance — output is the bare translation', () => {
  // Phrases a non-compliant model commonly leaks into the response.
  const PREAMBLE = /^(here('?s| is)|translation|translated|sure[,:]|the translation)/i;
  const TRAILING_NOTE = /\b(note:|explanation:|literally:)/i;

  for (const item of goldenItems) {
    it(`${item.id}: no preamble, quote-wrapping, or notes`, async () => {
      const output = await translateText(item.source, item.sourceLang, item.targetLang);
      expect(output).not.toBe('');

      expect(output, 'should not start with a preamble phrase').not.toMatch(PREAMBLE);
      expect(output, 'should not append an explanatory note').not.toMatch(TRAILING_NOTE);

      // Not wrapped in matching quotes — the source phrases are not quoted,
      // so a quoted output means the model added them.
      const quoted =
        (output.startsWith('"') && output.endsWith('"')) ||
        (output.startsWith('“') && output.endsWith('”')) ||
        (output.startsWith("'") && output.endsWith("'"));
      expect(quoted, `output was quote-wrapped: ${output}`).toBe(false);

      // A single short phrase in, a single phrase out — no multi-line
      // commentary appended below the translation.
      expect(output.split('\n').length, 'should be a single line').toBe(1);
    });
  }
});
