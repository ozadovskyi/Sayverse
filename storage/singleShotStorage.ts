import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SingleShotEntry } from '../constants/historyEntry';

/**
 * Persistence for single-shot translation history. Mirrors the shape of
 * `conversationStorage`: a versioned `{ version, entries }` payload guarded
 * on read so an external boundary cannot push a malformed object into render.
 *
 * Single-shots are immutable — only `append` and `delete` are exposed; there
 * is no update path because the entry is captured at the moment translation
 * completes and never revised.
 */

const STORAGE_KEY = 'single_shot_history';
const SCHEMA_VERSION = 1;
/** Cap so the list does not grow unbounded — oldest entries fall off. */
const MAX_ENTRIES = 200;

interface StoredPayload {
  version: number;
  entries: SingleShotEntry[];
}

function isValidEntry(value: unknown): value is SingleShotEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return (
    e.kind === 'single' &&
    typeof e.id === 'string' &&
    typeof e.originalText === 'string' &&
    typeof e.translatedText === 'string' &&
    typeof e.sourceLang === 'string' &&
    typeof e.targetLang === 'string' &&
    typeof e.createdAt === 'number'
  );
}

export async function loadSingleShots(): Promise<SingleShotEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredPayload | null;
    const list = parsed?.entries ?? [];
    return Array.isArray(list) ? list.filter(isValidEntry) : [];
  } catch {
    return [];
  }
}

async function writeSingleShots(entries: SingleShotEntry[]): Promise<void> {
  try {
    const payload: StoredPayload = { version: SCHEMA_VERSION, entries };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Non-fatal — history is a convenience, not core state.
  }
}

/** Prepend the entry and trim past `MAX_ENTRIES`. */
export async function appendSingleShot(entry: SingleShotEntry): Promise<void> {
  const entries = await loadSingleShots();
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  await writeSingleShots(entries);
}

export async function deleteSingleShot(id: string): Promise<void> {
  const entries = await loadSingleShots();
  await writeSingleShots(entries.filter(e => e.id !== id));
}
