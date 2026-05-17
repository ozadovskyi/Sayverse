/**
 * Data model for bilingual conversation mode.
 *
 * Pure types — no React, no React Native — so the reducer and its unit
 * tests stay in clean Node.
 */

/** One exchange: what was said in one language and its translation. */
export interface ConversationTurn {
  id: string;
  /** ISO code of the language that was spoken (Whisper-detected). */
  sourceLang: string;
  /** ISO code of the language it was translated into. */
  targetLang: string;
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
