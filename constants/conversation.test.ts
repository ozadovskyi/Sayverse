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

  it('treats the pair as unordered — a swapped pair still matches', () => {
    // A conversation between es and ru is one thread regardless of which
    // side the picker currently shows; swapping the picker resumes the
    // same session, not a parallel one.
    const esru = sessionFor('a', 'es', 'ru', 100);
    expect(pickLatestForPair([esru], 'ru', 'es')).toBe(esru);
  });

  it('returns the latest of either orientation for the same pair', () => {
    // Two sessions for the same unordered pair, stored in different
    // orientations (one was started es→ru, the other ru→es). The most
    // recently updated one wins regardless of orientation.
    const older = sessionFor('old', 'es', 'ru', 100);
    const newer = sessionFor('new', 'ru', 'es', 300);
    expect(pickLatestForPair([older, newer], 'es', 'ru')).toBe(newer);
    expect(pickLatestForPair([older, newer], 'ru', 'es')).toBe(newer);
  });
});
