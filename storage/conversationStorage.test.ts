import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ConversationSession } from '../constants/conversation';
import { loadSessions, saveSession } from './conversationStorage';

// AsyncStorage is a native module — stub it with an in-spec getItem/setItem.
// Jest hoists `jest.mock` above the imports above, so the import resolves
// to this stub.
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const store = jest.mocked(AsyncStorage);

const turn = (id: string) => ({
  id,
  sourceLang: 'es',
  targetLang: 'ru',
  originalText: 'hola',
  translatedText: 'привет',
  createdAt: 1,
});

const session = (
  id: string,
  updatedAt: number,
  turns: ReturnType<typeof turn>[] = [],
): ConversationSession => ({
  id,
  langA: 'es',
  langB: 'ru',
  turns,
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

  it('keeps a session whose turns are well-formed', async () => {
    const ok = session('a', 5, [turn('t1')]);
    store.getItem.mockResolvedValue(JSON.stringify({ version: 1, sessions: [ok] }));
    expect(await loadSessions()).toEqual([ok]);
  });

  it('drops a session whose turns are malformed', async () => {
    // A turn missing required fields would crash the thread view on render.
    const withBadTurn = { ...session('a', 5), turns: [{ id: 'only-an-id' }] };
    store.getItem.mockResolvedValue(
      JSON.stringify({ version: 1, sessions: [withBadTurn, session('b', 6)] }),
    );
    expect(await loadSessions()).toEqual([session('b', 6)]);
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
