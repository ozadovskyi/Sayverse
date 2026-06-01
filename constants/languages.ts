export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export const LANGUAGES: Language[] = [
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
];

export const DEFAULT_SOURCE = LANGUAGES[0]; // Spanish
export const DEFAULT_TARGET = LANGUAGES[1]; // Russian

/**
 * Resolve a `Language` from either an ISO code (`en`) or an English name
 * (`english`). Whisper's `verbose_json` returns the detected language as a
 * full English name, while ISO codes are used elsewhere — this normalizes
 * both. Matching is case-insensitive; returns `undefined` if nothing matches.
 */
export function findByCode(value: string): Language | undefined {
  if (!value) return undefined;
  const needle = value.trim().toLowerCase();
  return LANGUAGES.find(
    lang => lang.code.toLowerCase() === needle || lang.name.toLowerCase() === needle,
  );
}

/**
 * Auto-detect routing for a two-language pair. Given the language detected in
 * the input, decide which way to translate: if the speaker used `langB`,
 * translate to `langA`; if they used `langA`, translate `langA → langB`.
 *
 * Detection MUST land on one of the pair. The earlier silent fallback to
 * `langA → langB` for inconclusive / third-language detection was the root
 * cause of the wrong-direction bug in conversation mode (Whisper biased to
 * English on short clips, falling through the fallback and routing Spanish
 * speech as Russian-source). The pipeline now produces a pair-anchored
 * detected language by construction — voice via {@link transcribeBilingual}
 * (parallel hinted Whisper calls), typed-text via a re-detection routine
 * confined to the pair — and this function is the loud guarantee they did
 * their job. A third language reaching here is a bug; throwing here surfaces
 * it instead of silently mistranslating.
 */
export function routeLanguages(
  detectedCode: string,
  langA: string,
  langB: string,
): { sourceLang: string; targetLang: string } {
  if (detectedCode === langA) return { sourceLang: langA, targetLang: langB };
  if (detectedCode === langB) return { sourceLang: langB, targetLang: langA };
  throw new Error(
    `routeLanguages: detected "${detectedCode}" is not in the pair (${langA}, ${langB}). ` +
      `Upstream transcription/detection must produce one of the pair.`,
  );
}

/** A resolved translation direction: routed ISO codes plus display names. */
export interface TranslationDirection {
  sourceLang: string;
  targetLang: string;
  /** Full English name passed to the translation model. */
  sourceName: string;
  targetName: string;
}

/**
 * Resolve a complete translation direction for a two-language pair: normalize
 * the detected language, route it via {@link routeLanguages}, and look up the
 * full display names the model is prompted with.
 *
 * The single home for auto-detect routing + name resolution — both
 * single-shot and conversation mode call this so the two cannot drift.
 * Propagates the strict-routing throw from `routeLanguages` when the
 * detected language is outside the pair.
 */
export function resolveDirection(
  detectedCode: string | undefined,
  langA: string,
  langB: string,
): TranslationDirection {
  // Whisper may return a full name ("russian"), a detection call an ISO code
  // — normalize to an ISO code so routing compares like with like. An
  // unresolved name surfaces as an empty string so `routeLanguages` throws
  // with the original input rather than silently falling through.
  const detected = detectedCode ? findByCode(detectedCode)?.code ?? detectedCode : '';
  const { sourceLang, targetLang } = routeLanguages(detected, langA, langB);
  return {
    sourceLang,
    targetLang,
    sourceName: findByCode(sourceLang)?.name ?? sourceLang,
    targetName: findByCode(targetLang)?.name ?? targetLang,
  };
}
