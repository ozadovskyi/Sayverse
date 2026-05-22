import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SingleShotEntry } from '../constants/historyEntry';
import {
  appendSingleShot,
  deleteSingleShot,
  loadSingleShots,
} from './singleShotStorage';

// AsyncStorage is a native module — stub it. Jest hoists `jest.mock` above
// the imports so the import resolves to this stub.
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const store = jest.mocked(AsyncStorage);

function entry(id: string, createdAt: number): SingleShotEntry {
  return {
    kind: 'single',
    id,
    originalText: 'hola',
    translatedText: 'привет',
    sourceLang: 'es',
    targetLang: 'ru',
    createdAt,
  };
}

describe('loadSingleShots', () => {
  beforeEach(() => {
    store.getItem.mockReset();
  });

  it('returns [] when storage is empty', async () => {
    store.getItem.mockResolvedValue(null);
    expect(await loadSingleShots()).toEqual([]);
  });

  it('returns the persisted entries from the versioned payload', async () => {
    const e = entry('a', 100);
    store.getItem.mockResolvedValue(JSON.stringify({ version: 1, entries: [e] }));
    expect(await loadSingleShots()).toEqual([e]);
  });

  it('filters out malformed entries — boundary guard against bad storage', async () => {
    const good = entry('good', 200);
    const bad = { ...entry('bad', 1), kind: 'something-else' };
    store.getItem.mockResolvedValue(
      JSON.stringify({ version: 1, entries: [bad, good] }),
    );
    expect(await loadSingleShots()).toEqual([good]);
  });

  it('returns [] when the stored JSON is corrupt rather than crashing', async () => {
    store.getItem.mockResolvedValue('{not-json');
    expect(await loadSingleShots()).toEqual([]);
  });
});

describe('appendSingleShot', () => {
  beforeEach(() => {
    store.getItem.mockReset();
    store.setItem.mockReset();
  });

  it('prepends the new entry so the newest is first', async () => {
    const older = entry('older', 100);
    store.getItem.mockResolvedValue(
      JSON.stringify({ version: 1, entries: [older] }),
    );
    const newer = entry('newer', 200);
    await appendSingleShot(newer);
    const written = JSON.parse(store.setItem.mock.calls[0][1]);
    expect(written.entries).toEqual([newer, older]);
  });

  it('writes a versioned payload (the v1 schema, not a bare array)', async () => {
    store.getItem.mockResolvedValue(null);
    await appendSingleShot(entry('a', 1));
    const written = JSON.parse(store.setItem.mock.calls[0][1]);
    expect(written).toMatchObject({ version: 1, entries: expect.any(Array) });
  });
});

describe('deleteSingleShot', () => {
  beforeEach(() => {
    store.getItem.mockReset();
    store.setItem.mockReset();
  });

  it('removes only the entry with the matching id', async () => {
    const keep = entry('keep', 100);
    const drop = entry('drop', 50);
    store.getItem.mockResolvedValue(
      JSON.stringify({ version: 1, entries: [keep, drop] }),
    );
    await deleteSingleShot('drop');
    const written = JSON.parse(store.setItem.mock.calls[0][1]);
    expect(written.entries).toEqual([keep]);
  });
});
