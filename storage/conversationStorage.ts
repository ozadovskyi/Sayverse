import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ConversationSession } from '../constants/conversation';

/**
 * Persistence for conversation sessions, in AsyncStorage (localStorage-backed
 * on web). Sessions are stored as a single JSON array, newest first.
 */

const STORAGE_KEY = 'conversation_sessions';

export async function loadSessions(): Promise<ConversationSession[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ConversationSession[]) : [];
  } catch {
    // Corrupt or unreadable storage — start fresh rather than crash.
    return [];
  }
}

/** Insert or update a session, then keep the list ordered newest-first. */
export async function saveSession(session: ConversationSession): Promise<void> {
  const sessions = await loadSessions();
  const index = sessions.findIndex(s => s.id === session.id);
  if (index >= 0) sessions[index] = session;
  else sessions.push(session);
  sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export async function deleteSession(id: string): Promise<void> {
  const sessions = await loadSessions();
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(sessions.filter(s => s.id !== id)),
  );
}
