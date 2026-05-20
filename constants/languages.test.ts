import * as fc from 'fast-check';

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

// Property-based tests assert *invariants* that hold for any input —
// catching whole classes of bug the example-based tests above cannot.
describe('routing — properties', () => {
  // Sample from the actual supported language codes so detection-equivalence
  // checks have a real chance of resolving via `findByCode`.
  const codeArb = fc.constantFrom(...LANGUAGES.map(l => l.code));
  const pairArb = fc
    .tuple(codeArb, codeArb)
    .filter(([a, b]) => a !== b);
  const maybeDetected = fc.oneof(
    codeArb,
    fc.constant(undefined),
    // A third language outside the pair tests the fallback path.
    fc.constant('klingon'),
  );

  it('routeLanguages always returns one of the two ordered pairs of the chosen languages', () => {
    fc.assert(
      fc.property(pairArb, maybeDetected, ([a, b], detected) => {
        const result = routeLanguages(detected, a, b);
        const isAB = result.sourceLang === a && result.targetLang === b;
        const isBA = result.sourceLang === b && result.targetLang === a;
        return isAB || isBA;
      }),
    );
  });

  it('routeLanguages chooses B→A only when detection is exactly langB; otherwise A→B', () => {
    fc.assert(
      fc.property(pairArb, maybeDetected, ([a, b], detected) => {
        const result = routeLanguages(detected, a, b);
        return detected === b
          ? result.sourceLang === b && result.targetLang === a
          : result.sourceLang === a && result.targetLang === b;
      }),
    );
  });

  it('resolveDirection names are the canonical display names of its codes', () => {
    fc.assert(
      fc.property(pairArb, maybeDetected, ([a, b], detected) => {
        const r = resolveDirection(detected, a, b);
        return (
          r.sourceName === findByCode(r.sourceLang)?.name &&
          r.targetName === findByCode(r.targetLang)?.name
        );
      }),
    );
  });

  it('resolveDirection treats Whisper full-names identically to ISO codes', () => {
    fc.assert(
      fc.property(pairArb, codeArb, ([a, b], detected) => {
        // The name and the code resolve to the same language; routing must
        // not depend on which form Whisper happens to return.
        const language = findByCode(detected);
        if (!language) return true;
        return (
          JSON.stringify(resolveDirection(detected, a, b)) ===
          JSON.stringify(resolveDirection(language.name, a, b))
        );
      }),
    );
  });
});
