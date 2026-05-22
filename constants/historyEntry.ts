/**
 * Unified history model — both single-shot translations and conversation
 * sessions live behind one discriminated `HistoryEntry`. The History screen
 * renders a single list across both kinds; storage stays split (conversations
 * keep their existing key + reducer integration; single-shots get their own).
 *
 * Pure types — no React, no React Native — so they can be exercised in clean
 * Node tests alongside the reducer.
 */

import type { ConversationSession } from './conversation';

/** A one-off translation captured from single-shot mode. */
export interface SingleShotEntry {
  kind: 'single';
  id: string;
  /** The user's input — what they spoke or typed. */
  originalText: string;
  /** The model's output. */
  translatedText: string;
  /**
   * The source language *of the translation call* — already resolved by the
   * direction picker, so re-opening the entry can reproduce labels without
   * re-running language detection.
   */
  sourceLang: string;
  targetLang: string;
  /** Epoch ms — single-shots are immutable, so `createdAt` is also the sort key. */
  createdAt: number;
}

/** A conversation thread captured from conversation mode. */
export interface ConversationHistoryEntry {
  kind: 'conversation';
  session: ConversationSession;
}

export type HistoryEntry = SingleShotEntry | ConversationHistoryEntry;

/** The timestamp the merged History list sorts by. */
export function entryUpdatedAt(entry: HistoryEntry): number {
  return entry.kind === 'single' ? entry.createdAt : entry.session.updatedAt;
}

/** Stable id used as a React `key` and as the delete target. */
export function entryId(entry: HistoryEntry): string {
  return entry.kind === 'single' ? entry.id : entry.session.id;
}
