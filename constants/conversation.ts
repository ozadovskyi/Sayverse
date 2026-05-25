/**
 * Data model for bilingual conversation mode.
 *
 * Pure types — no React, no React Native — so the reducer and its unit
 * tests stay in clean Node.
 */

/** One exchange: what was said in one language and its translation. */
export interface ConversationTurn {
  id: string;
  /**
   * ISO code of the source language the translation was made *from* — the
   * routed slot within the pair. When auto-detect is inconclusive or hears a
   * third language this is a fallback, so it may differ from `detectedLang`.
   */
  sourceLang: string;
  /** ISO code of the language it was translated into. */
  targetLang: string;
  /**
   * ISO code Whisper actually detected, normalized — the ground truth of what
   * was spoken. Absent on turns persisted before this field existed; differs
   * from `sourceLang` when the spoken language fell outside the pair.
   */
  detectedLang?: string;
  originalText: string;
  translatedText: string;
  /** Epoch ms. */
  createdAt: number;
}

/** A conversation — a fixed language pair and the turns spoken so far. */
export interface ConversationSession {
  id: string;
  /** The two languages of the conversation, as ISO codes. */
  langA: string;
  langB: string;
  turns: ConversationTurn[];
  createdAt: number;
  updatedAt: number;
}

/** Build an empty session. `id` and `now` are passed in to keep this pure. */
export function createSession(
  id: string,
  langA: string,
  langB: string,
  now: number,
): ConversationSession {
  return { id, langA, langB, turns: [], createdAt: now, updatedAt: now };
}

/**
 * The most recently updated session for the language pair `{langA, langB}`
 * (unordered), or `undefined` if there is none. Used to resume a conversation
 * when the user re-enters conversation mode or swaps the picker.
 *
 * The pair is matched as a *set*: a conversation between es and ru is one
 * thread regardless of which side the picker currently shows. Earlier this
 * matched the ordered pair, which meant swapping the picker resumed a
 * different history — there is conceptually only ever one es/ru thread, the
 * swap just changes which speaker the picker opens to next.
 */
export function pickLatestForPair(
  sessions: ConversationSession[],
  langA: string,
  langB: string,
): ConversationSession | undefined {
  return sessions
    .filter(
      s =>
        (s.langA === langA && s.langB === langB) ||
        (s.langA === langB && s.langB === langA),
    )
    .reduce<ConversationSession | undefined>(
      (latest, s) => (!latest || s.updatedAt > latest.updatedAt ? s : latest),
      undefined,
    );
}
