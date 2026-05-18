export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export const LANGUAGES: Language[] = [
  { code: 'es', name: 'Spanish', nativeName: 'Espanol' },
  { code: 'ru', name: 'Russian', nativeName: 'Russkij' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Ukrainska' },
  { code: 'fr', name: 'French', nativeName: 'Francais' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Portugues' },
  { code: 'zh', name: 'Chinese', nativeName: 'Zhongwen' },
  { code: 'ja', name: 'Japanese', nativeName: 'Nihongo' },
  { code: 'ko', name: 'Korean', nativeName: 'Hangugeo' },
  { code: 'ar', name: 'Arabic', nativeName: 'Al-Arabiyyah' },
  { code: 'hi', name: 'Hindi', nativeName: 'Hindi' },
  { code: 'tr', name: 'Turkish', nativeName: 'Turkce' },
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
 * translate to `langA`; otherwise (they used `langA`, or detection was
 * inconclusive / a third language) translate `langA → langB`.
 *
 * Used by both conversation mode and single-shot — `detectedCode` comes from
 * Whisper for voice, or a language-detection call for typed text.
 */
export function routeLanguages(
  detectedCode: string | undefined,
  langA: string,
  langB: string,
): { sourceLang: string; targetLang: string } {
  return detectedCode === langB
    ? { sourceLang: langB, targetLang: langA }
    : { sourceLang: langA, targetLang: langB };
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
 */
export function resolveDirection(
  detectedCode: string | undefined,
  langA: string,
  langB: string,
): TranslationDirection {
  // Whisper may return a full name ("russian"), a detection call an ISO code
  // — normalize to an ISO code so routing compares like with like.
  const detected = detectedCode ? findByCode(detectedCode)?.code : undefined;
  const { sourceLang, targetLang } = routeLanguages(detected, langA, langB);
  return {
    sourceLang,
    targetLang,
    sourceName: findByCode(sourceLang)?.name ?? sourceLang,
    targetName: findByCode(targetLang)?.name ?? targetLang,
  };
}
