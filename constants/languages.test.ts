import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SOURCE,
  DEFAULT_TARGET,
  findByCode,
  LANGUAGES,
  resolveDirection,
  routeLanguages,
} from './languages';

describe('findByCode', () => {
  it('resolves a language by ISO code', () => {
    expect(findByCode('en')?.name).toBe('English');
    expect(findByCode('uk')?.name).toBe('Ukrainian');
  });

  it("resolves a language by Whisper's full English name", () => {
    // Whisper verbose_json returns the detected language as a full name.
    expect(findByCode('english')?.code).toBe('en');
    expect(findByCode('spanish')?.code).toBe('es');
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(findByCode('  English  ')?.code).toBe('en');
    expect(findByCode('RU')?.code).toBe('ru');
  });

  it('returns undefined for an empty or unknown value', () => {
    expect(findByCode('')).toBeUndefined();
    expect(findByCode('klingon')).toBeUndefined();
  });
});

describe('routeLanguages', () => {
  it('routes B→A when the spoken language is langB', () => {
    expect(routeLanguages('ru', 'es', 'ru')).toEqual({
      sourceLang: 'ru',
      targetLang: 'es',
    });
  });

  it('routes A→B when the spoken language is langA', () => {
    expect(routeLanguages('es', 'es', 'ru')).toEqual({
      sourceLang: 'es',
      targetLang: 'ru',
    });
  });

  it('defaults to A→B when detection is inconclusive', () => {
    expect(routeLanguages(undefined, 'es', 'ru')).toEqual({
      sourceLang: 'es',
      targetLang: 'ru',
    });
  });

  it('defaults to A→B when a third, unpaired language is detected', () => {
    // Spoke English while the pair is es/ru — fall back to the pair's A→B.
    expect(routeLanguages('en', 'es', 'ru')).toEqual({
      sourceLang: 'es',
      targetLang: 'ru',
    });
  });
});

describe('resolveDirection', () => {
  it('resolves codes and display names for a B→A turn', () => {
    expect(resolveDirection('ru', 'es', 'ru')).toEqual({
      sourceLang: 'ru',
      targetLang: 'es',
      sourceName: 'Russian',
      targetName: 'Spanish',
    });
  });

  it('resolves A→B when the detected language is langA', () => {
    expect(resolveDirection('es', 'es', 'ru')).toEqual({
      sourceLang: 'es',
      targetLang: 'ru',
      sourceName: 'Spanish',
      targetName: 'Russian',
    });
  });

  it("normalizes Whisper's full-name detection before routing", () => {
    // Whisper returns "russian" — it must still route B→A for an es/ru pair.
    expect(resolveDirection('Russian', 'es', 'ru')).toMatchObject({
      sourceLang: 'ru',
      targetLang: 'es',
    });
  });

  it('falls back to A→B when detection is missing or unpaired', () => {
    expect(resolveDirection(undefined, 'es', 'ru')).toMatchObject({
      sourceLang: 'es',
      targetLang: 'ru',
    });
    expect(resolveDirection('klingon', 'es', 'ru')).toMatchObject({
      sourceLang: 'es',
      targetLang: 'ru',
    });
  });
});

describe('language constants', () => {
  it('has distinct default source and target', () => {
    expect(DEFAULT_SOURCE.code).not.toBe(DEFAULT_TARGET.code);
  });

  it('has unique language codes', () => {
    const codes = LANGUAGES.map(l => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
