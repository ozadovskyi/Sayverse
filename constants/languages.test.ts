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

  // The previous "default to A→B on inconclusive / third-language" tests
  // documented a bug as if it were a feature: Whisper biases to English on
  // short clips, the unhinted call returned `language: "english"` for a
  // Spanish utterance in an es/ru pair, the silent fallback then routed the
  // turn as if the user had spoken `langA` (Russian), and GPT received
  // already-Spanish text labelled "Russian → Spanish" — emitting it back
  // verbatim. Routing must now refuse to guess.
  it('throws when the detected language is outside the pair (third language)', () => {
    // English isn't in the es/ru pair; this used to silently fall back to A→B.
    expect(() => routeLanguages('en', 'es', 'ru')).toThrow(/not in the pair/);
  });

  it('throws when detection is the empty string (Whisper returned nothing)', () => {
    expect(() => routeLanguages('', 'es', 'ru')).toThrow(/not in the pair/);
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

  it('propagates the strict-routing throw for missing or unpaired detection', () => {
    // No silent fallback path remains — the impossible cases now surface.
    expect(() => resolveDirection(undefined, 'es', 'ru')).toThrow(/not in the pair/);
    expect(() => resolveDirection('klingon', 'es', 'ru')).toThrow(/not in the pair/);
    // English on an es/ru pair — the exact production scenario that
    // produced the wrong-direction bug. Routing now refuses to guess.
    expect(() => resolveDirection('en', 'es', 'ru')).toThrow(/not in the pair/);
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
  const codeArb = fc.constantFrom(...LANGUAGES.map(l => l.code));
  // Generate a pair *plus* an in-pair detected language in one shot so we
  // can sample from {langA, langB} rather than a fresh-from-all-LANGUAGES
  // value (which is almost never one of the pair). The chain via
  // `fc.constantFrom([a, b])` is fast-check's idiom for "dependent draws".
  const pairAndInPair = fc
    .tuple(codeArb, codeArb)
    .filter(([a, b]) => a !== b)
    .chain(([a, b]) =>
      fc.tuple(fc.constant(a), fc.constant(b), fc.constantFrom(a, b)),
    );

  it('routeLanguages always returns one of the two ordered pairs of the chosen languages', () => {
    fc.assert(
      fc.property(pairAndInPair, ([a, b, detected]) => {
        const result = routeLanguages(detected, a, b);
        const isAB = result.sourceLang === a && result.targetLang === b;
        const isBA = result.sourceLang === b && result.targetLang === a;
        return isAB || isBA;
      }),
    );
  });

  it('routeLanguages chooses B→A iff detection is exactly langB', () => {
    fc.assert(
      fc.property(pairAndInPair, ([a, b, detected]) => {
        const result = routeLanguages(detected, a, b);
        return detected === b
          ? result.sourceLang === b && result.targetLang === a
          : result.sourceLang === a && result.targetLang === b;
      }),
    );
  });

  it('routeLanguages throws for any detected language outside the pair', () => {
    // The strict-routing invariant: the function refuses to guess. This is
    // the property test the original suite was missing — the example tests
    // covered only an es/ru pair + English drift; this generalises to any
    // pair and any out-of-pair code.
    fc.assert(
      fc.property(
        fc.tuple(codeArb, codeArb).filter(([a, b]) => a !== b),
        codeArb,
        ([a, b], outside) => {
          if (outside === a || outside === b) return true; // skip in-pair samples
          expect(() => routeLanguages(outside, a, b)).toThrow();
          return true;
        },
      ),
    );
  });

  it('resolveDirection names are the canonical display names of its codes', () => {
    fc.assert(
      fc.property(pairAndInPair, ([a, b, detected]) => {
        const r = resolveDirection(detected, a, b);
        return (
          r.sourceName === findByCode(r.sourceLang)?.name &&
          r.targetName === findByCode(r.targetLang)?.name
        );
      }),
    );
  });

  it('resolveDirection treats Whisper full-names identically to ISO codes', () => {
    // The name and the code must resolve to the same routing — Whisper can
    // return either form ("ru" vs "russian") and we cannot afford the
    // direction to depend on which one it picked.
    fc.assert(
      fc.property(pairAndInPair, ([a, b, detected]) => {
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
