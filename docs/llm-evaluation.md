# LLM evaluation

The translation feature is powered by a language model, so its output is
probabilistic — a pass/fail string comparison does not apply. The `llm-eval`
suite evaluates that output the way model output should be evaluated: by
scoring **properties** of the translation, not exact text.

It is a second Vitest project (`tests/llm-eval/`, `*.eval.ts`). It exercises
the app's real `translateText` against the live OpenAI API.

```
npm run eval        # needs OPENAI_API_KEY in the environment
```

Because it hits the real API it is **non-deterministic and costs money** — it
is excluded from the PR gate and runs only on manual dispatch
(`llm-eval.yml`), so every run is a deliberate, budgeted decision.

## Golden dataset

`data/golden-translations.json` — 20 "life in Spain" phrases across the
language pairs the app is built for (EN↔ES, ES↔RU, ES↔UK), grouped into five
topical categories (errands, housing, healthcare, dining, social). Each item
carries a human-quality reference translation and a per-item similarity
threshold.

> Thresholds are **calibrated from observed scores**: each item's
> `minSimilarity` is its measured first-run semantic similarity minus a ~0.10
> margin (capped at 0.82). A threshold therefore flags a genuine regression,
> not ordinary rewording — the margin absorbs the synonym variance that the
> embedding metric is known to penalise. Re-calibrate from the `[eval-score]`
> log lines if the dataset or the model changes.

## Scoring methods

- **Semantic similarity** (primary) — both the model output and the reference
  are embedded with `text-embedding-3-small`; the score is the cosine of the
  two vectors. This rewards meaning, not wording — a sentence has many correct
  translations.
- **LLM-as-judge** (cross-check) — `gpt-4o-mini` scores accuracy and fluency
  1–5 with a fixed rubric. Used on a subset. An independent second method
  guards against a systematic blind spot in the embedding score: when the
  thing being measured is itself a model, one metric is not enough.
- **Language detection** — a tiny constrained model call returns the ISO code
  of a text, used to confirm the output is actually in the target language.

## The five evals

Each file is a distinct, non-overlapping quality axis:

| File | Asks |
|---|---|
| `translation-quality.eval.ts` | Is the output semantically close to the reference? (+ judge cross-check, one item per category) |
| `stability.eval.ts` | Translated five times, does the same phrase stay consistent in meaning? (pairwise ≥ 0.9) |
| `prompt-compliance.eval.ts` | Is the output the bare translation — no preamble, quote-wrapping or appended notes? |
| `language-correctness.eval.ts` | Is the output actually in the requested target language? |
| `robustness.eval.ts` | Embedded instructions translated not obeyed; emoji / mixed scripts / long passages survive |

## Out of scope (v1)

**Whisper transcription accuracy** is not evaluated here. Doing it well needs
a curated set of golden audio recordings — disproportionate for v1. It is a
planned v2 layer (synthetic-audio fixtures: TTS-generated speech with injected
noise, scored against expected transcripts). The voice path is still exercised
end to end by the Maestro layer.

## Support modules

`tests/llm-eval/support/` — `client.ts` (a dedicated OpenAI client for the
suite's own scoring calls, separate from the app's), `setup.ts` (initialises
the app client so the real `translateText` runs), `golden.ts` (typed dataset
loader), `similarity.ts`, `detect.ts`, `judge.ts`.
