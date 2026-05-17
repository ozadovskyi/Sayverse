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
