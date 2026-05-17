import { describe, expect, it } from 'vitest';

import {
  createSession,
  pickLatestForPair,
  type ConversationSession,
} from './conversation';

/** A session for `(langA, langB)` last updated at `updatedAt`. */
function sessionFor(
  id: string,
  langA: string,
  langB: string,
  updatedAt: number,
): ConversationSession {
  return { ...createSession(id, langA, langB, 0), updatedAt };
}

describe('pickLatestForPair', () => {
  it('returns undefined for an empty list', () => {
    expect(pickLatestForPair([], 'es', 'ru')).toBeUndefined();
  });

  it('returns undefined when no session matches the language pair', () => {
    const sessions = [sessionFor('a', 'en', 'fr', 100)];
    expect(pickLatestForPair(sessions, 'es', 'ru')).toBeUndefined();
  });

  it('returns the only matching session', () => {
    const match = sessionFor('a', 'es', 'ru', 100);
    expect(pickLatestForPair([match], 'es', 'ru')).toBe(match);
  });

  it('returns the most recently updated matching session', () => {
    const older = sessionFor('old', 'es', 'ru', 100);
    const newer = sessionFor('new', 'es', 'ru', 300);
    const middle = sessionFor('mid', 'es', 'ru', 200);
    expect(pickLatestForPair([older, newer, middle], 'es', 'ru')).toBe(newer);
  });

  it('ignores non-matching sessions even when they are newer', () => {
    const match = sessionFor('match', 'es', 'ru', 100);
    const newerOtherPair = sessionFor('other', 'en', 'fr', 999);
    expect(pickLatestForPair([match, newerOtherPair], 'es', 'ru')).toBe(match);
  });

  it('treats the pair as ordered — a swapped pair does not match', () => {
    // A session created as es→ru is not resumed when the picker is ru→es;
    // the History browser surfaces it instead.
    const esru = sessionFor('a', 'es', 'ru', 100);
    expect(pickLatestForPair([esru], 'ru', 'es')).toBeUndefined();
  });
});
