import { describe, expect, it } from 'vitest';

import { DEFAULT_SOURCE, DEFAULT_TARGET, findByCode, LANGUAGES } from './languages';

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

describe('language constants', () => {
  it('has distinct default source and target', () => {
    expect(DEFAULT_SOURCE.code).not.toBe(DEFAULT_TARGET.code);
  });

  it('has unique language codes', () => {
    const codes = LANGUAGES.map(l => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
