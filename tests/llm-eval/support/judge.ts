import { evalClient } from './client';

/** A judge's verdict on one translation. */
export interface JudgeVerdict {
  /** Meaning preserved from source, 1 (wrong) – 5 (faithful). */
  accuracy: number;
  /** Reads naturally to a native speaker, 1 (broken) – 5 (native). */
  fluency: number;
  /** One short sentence explaining the scores. */
  notes: string;
}

/**
 * LLM-as-judge cross-check. The embedding score in `similarity.ts` is the
 * primary signal; this is a second, independent opinion used on a subset of
 * items. Two methods that disagree expose a blind spot in either — a useful
 * property when the thing being measured is itself a model.
 *
 * gpt-4o-mini scores accuracy and fluency 1–5 and returns strict JSON.
 */
export async function judgeTranslation(
  source: string,
  sourceLang: string,
  targetLang: string,
  candidate: string,
): Promise<JudgeVerdict> {
  const completion = await evalClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a professional bilingual translation reviewer. Score the ' +
          'candidate translation on two axes, each an integer 1-5: ' +
          '"accuracy" (is the meaning of the source preserved?) and ' +
          '"fluency" (does it read naturally to a native speaker?). ' +
          'Respond with ONLY a JSON object: ' +
          '{"accuracy": number, "fluency": number, "notes": string}.',
      },
      {
        role: 'user',
        content:
          `Source (${sourceLang}): ${source}\n` +
          `Candidate (${targetLang}): ${candidate}`,
      },
    ],
    temperature: 0,
    max_tokens: 200,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw) as Partial<JudgeVerdict>;
  return {
    accuracy: Number(parsed.accuracy ?? 0),
    fluency: Number(parsed.fluency ?? 0),
    notes: String(parsed.notes ?? ''),
  };
}
