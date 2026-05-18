import dataset from '../data/golden-translations.json';

/** One curated translation example with its scoring threshold. */
export interface GoldenItem {
  /** Stable identifier, e.g. `dining-02`. Used as the test title. */
  id: string;
  /** Topical group, e.g. `housing` — lets reports break down by category. */
  category: string;
  /** The text to translate. */
  source: string;
  /** Source language as a full English name ("Spanish") — `translateText` takes names. */
  sourceLang: string;
  /** Target language as a full English name ("Russian"). */
  targetLang: string;
  /** A human-quality reference translation to score the model's output against. */
  reference: string;
  /** Minimum acceptable cosine similarity between model output and `reference`. */
  minSimilarity: number;
}

/** Every golden example, typed. */
export const goldenItems: GoldenItem[] = dataset.items;
