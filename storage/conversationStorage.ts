import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ConversationSession } from '../constants/conversation';

/**
 * Persistence for conversation sessions, in AsyncStorage (localStorage-backed
 * on web).
 *
 * The payload is versioned — `{ version, sessions }` — so a future change to
 * the `ConversationSession` shape has a migration hook instead of silently
 * loading stale-shaped objects. `loadSessions` still reads the original
 * unversioned bare-array format (v0) written by earlier builds.
 */

const STORAGE_KEY = 'conversation_sessions';
const SCHEMA_VERSION = 1;

interface StoredPayload {
  version: number;
  sessions: ConversationSession[];
}

/** Guard a single turn — see {@link isValidSession}. */
function isValidTurn(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    typeof t.sourceLang === 'string' &&
    typeof t.targetLang === 'string' &&
    typeof t.originalText === 'string' &&
    typeof t.translatedText === 'string' &&
    typeof t.createdAt === 'number'
  );
}

/**
 * Guard a persisted entry: storage is an external boundary, so an object of
 * the wrong shape (an old build, a hand-edited value) is dropped rather than
 * handed to the reducer and the UI, where a missing field would crash render.
 * Turns are checked too — a session is only as safe to render as its turns.
 */
function isValidSession(value: unknown): value is ConversationSession {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.langA === 'string' &&
    typeof s.langB === 'string' &&
    Array.isArray(s.turns) &&
    s.turns.every(isValidTurn) &&
    typeof s.createdAt === 'number' &&
    typeof s.updatedAt === 'number'
  );
}

export async function loadSessions(): Promise<ConversationSession[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // v0 stored a bare array; v1+ wraps it as `{ version, sessions }`.
    const list = Array.isArray(parsed)
      ? parsed
      : ((parsed as StoredPayload | null)?.sessions ?? []);
    return Array.isArray(list) ? list.filter(isValidSession) : [];
  } catch {
    // Corrupt or unreadable storage — start fresh rather than crash.
    return [];
  }
}

/** Write the session list as the current versioned payload. */
async function writeSessions(sessions: ConversationSession[]): Promise<void> {
  try {
    const payload: StoredPayload = { version: SCHEMA_VERSION, sessions };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // A failed write is non-fatal — history is a convenience, not core state.
  }
}

/** Insert or update a session, then keep the list ordered newest-first. */
export async function saveSession(session: ConversationSession): Promise<void> {
  const sessions = await loadSessions();
  const index = sessions.findIndex(s => s.id === session.id);
  if (index >= 0) sessions[index] = session;
  else sessions.push(session);
  sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  await writeSessions(sessions);
}

export async function deleteSession(id: string): Promise<void> {
  const sessions = await loadSessions();
  await writeSessions(sessions.filter(s => s.id !== id));
}
