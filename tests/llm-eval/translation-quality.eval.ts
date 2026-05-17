import { describe, expect, it } from 'vitest';

import { translateText } from '../../services/openai';
import { goldenItems } from './support/golden';
import { judgeTranslation } from './support/judge';
import { semanticSimilarity } from './support/similarity';

/**
 * Translation quality — the core eval. For every golden item, translate the
 * source with the app's real `translateText` and score the output's semantic
 * similarity to a human-quality reference. Embeddings (not string equality)
 * because a sentence has many correct translations.
 *
 * A subset is additionally cross-checked by an LLM judge: an independent
 * scoring method guards against a systematic blind spot in the embedding one.
 */
describe('translation quality — semantic similarity to reference', () => {
  for (const item of goldenItems) {
    it(`${item.id}: ${item.sourceLang}→${item.targetLang} ≥ ${item.minSimilarity}`, async () => {
      const output = await translateText(item.source, item.sourceLang, item.targetLang);
      expect(output, 'translation should not be empty').not.toBe('');

      const score = await semanticSimilarity(output, item.reference);
      expect(
        score,
        `"${output}" vs reference "${item.reference}" scored ${score.toFixed(3)}`,
      ).toBeGreaterThanOrEqual(item.minSimilarity);
    });
  }
});

describe('translation quality — LLM-judge cross-check (one per category)', () => {
  // One representative item per category — keeps judge cost bounded while
  // still covering every topical area.
  const seen = new Set<string>();
  const subset = goldenItems.filter(i => {
    if (seen.has(i.category)) return false;
    seen.add(i.category);
    return true;
  });

  for (const item of subset) {
    it(`${item.id}: judge rates accuracy & fluency ≥ 4/5`, async () => {
      const output = await translateText(item.source, item.sourceLang, item.targetLang);
      const verdict = await judgeTranslation(
        item.source,
        item.sourceLang,
        item.targetLang,
        output,
      );
      expect(verdict.accuracy, verdict.notes).toBeGreaterThanOrEqual(4);
      expect(verdict.fluency, verdict.notes).toBeGreaterThanOrEqual(4);
    });
  }
});
