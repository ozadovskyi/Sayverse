import { evalClient } from './client';

/**
 * Semantic similarity scoring. Translation quality cannot be checked with
 * string equality — there are many correct translations of one sentence —
 * so we embed both texts and take the cosine of the two vectors. A score
 * near 1 means the two texts carry the same meaning, regardless of wording.
 */

const EMBEDDING_MODEL = 'text-embedding-3-small';

/** Embed a single text into its vector representation. */
async function embed(text: string): Promise<number[]> {
  const res = await evalClient.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return res.data[0].embedding;
}

/** Cosine similarity of two equal-length vectors, in [-1, 1]. */
function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Semantic similarity of two texts, in [-1, 1] (in practice ~0 to 1 for
 * natural language). Embeds both in parallel, then takes the cosine.
 */
export async function semanticSimilarity(a: string, b: string): Promise<number> {
  const [va, vb] = await Promise.all([embed(a), embed(b)]);
  return cosine(va, vb);
}
