import { describe, expect, it } from 'vitest';

import { translateText } from '../../services/openai';
import { goldenItems } from './support/golden';
import { semanticSimilarity } from './support/similarity';

/**
 * Stability — the app sends `temperature: 0.3`, so output is not fully
 * deterministic. That is fine for wording, but the *meaning* must be stable:
 * a user retrying the same phrase should never get a materially different
 * translation. We translate one phrase five times and require every pair of
 * results to be near-identical in meaning.
 */
describe('stability — repeated translations stay consistent in meaning', () => {
  const TRIALS = 5;
  const PAIRWISE_MIN = 0.9;

  // A handful of phrases across language pairs — enough to catch instability
  // without five API calls × the whole dataset.
  const sample = [
    goldenItems.find(i => i.id === 'housing-01')!,
    goldenItems.find(i => i.id === 'healthcare-03')!,
    goldenItems.find(i => i.id === 'social-02')!,
  ];

  for (const item of sample) {
    it(`${item.id}: ${TRIALS} runs are pairwise ≥ ${PAIRWISE_MIN} similar`, async () => {
      const runs = await Promise.all(
        Array.from({ length: TRIALS }, () =>
          translateText(item.source, item.sourceLang, item.targetLang),
        ),
      );

      for (let i = 0; i < runs.length; i++) {
        for (let j = i + 1; j < runs.length; j++) {
          const score = await semanticSimilarity(runs[i], runs[j]);
          expect(
            score,
            `run ${i} "${runs[i]}" vs run ${j} "${runs[j]}" scored ${score.toFixed(3)}`,
          ).toBeGreaterThanOrEqual(PAIRWISE_MIN);
        }
      }
    });
  }
});
