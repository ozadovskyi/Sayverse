import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConversationSession } from '../constants/conversation';
import { loadSessions, saveSession } from './conversationStorage';

// AsyncStorage is a native module — stub it with an in-spec getItem/setItem.
// Vitest hoists `vi.mock` above the imports above, so the import resolves
// to this stub.
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));

const store = vi.mocked(AsyncStorage);

const session = (id: string, updatedAt: number): ConversationSession => ({
  id,
  langA: 'es',
  langB: 'ru',
  turns: [],
  createdAt: 1,
  updatedAt,
});

describe('loadSessions', () => {
  beforeEach(() => {
    store.getItem.mockReset();
    store.setItem.mockReset();
  });

  it('reads the v1 versioned payload', async () => {
    store.getItem.mockResolvedValue(
      JSON.stringify({ version: 1, sessions: [session('a', 5)] }),
    );
    expect(await loadSessions()).toEqual([session('a', 5)]);
  });

  it('reads the legacy unversioned bare-array format (v0)', async () => {
    store.getItem.mockResolvedValue(JSON.stringify([session('a', 5)]));
    expect(await loadSessions()).toEqual([session('a', 5)]);
  });

  it('returns [] for missing or corrupt storage', async () => {
    store.getItem.mockResolvedValue(null);
    expect(await loadSessions()).toEqual([]);
    store.getItem.mockResolvedValue('not json{');
    expect(await loadSessions()).toEqual([]);
  });

  it('drops malformed session entries', async () => {
    store.getItem.mockResolvedValue(
      JSON.stringify({ version: 1, sessions: [session('a', 5), { id: 'bad' }, null] }),
    );
    expect(await loadSessions()).toEqual([session('a', 5)]);
  });
});

describe('saveSession', () => {
  beforeEach(() => {
    store.getItem.mockReset();
    store.setItem.mockReset();
  });

  it('persists the versioned payload', async () => {
    store.getItem.mockResolvedValue(null);
    await saveSession(session('a', 5));
    const [, written] = store.setItem.mock.calls[0];
    expect(JSON.parse(written)).toEqual({ version: 1, sessions: [session('a', 5)] });
  });
});
