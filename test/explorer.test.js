import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { canonicalPosition, START_FEN } from '../src/graph.js';

globalThis.indexedDB = fakeIndexedDB;

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.window = { location: { href: 'https://example.test/chessview/', search: '' } };
globalThis.history = { state: null, replaceState() {} };

const { clearGraph, putEdges, putNode } = await import('../src/db.js');
const { discoverForViewport, loadExplorer } = await import('../src/explorer.js');

const center = canonicalPosition(START_FEN);

test('401 clears the stored Lichess access token', async () => {
  await clearGraph();
  localStorage.setItem('chessview.lichess.accessToken', 'expired-token');
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    text: async () => 'unauthorized',
  });

  await assert.rejects(loadExplorer(center, { force: true }), (error) => error?.status === 401);
  assert.equal(localStorage.getItem('chessview.lichess.accessToken'), null);
});

test('aborted discovery stops before requesting descendant positions', async () => {
  await clearGraph();
  const explorer = {
    white: 60,
    draws: 20,
    black: 20,
    moves: [],
  };
  await putNode({
    key: center,
    fen: START_FEN,
    explorer,
    explorerFetchedAt: Date.now(),
    games: 100,
  });
  await putEdges([
    {
      id: `${center}|e2e4|child`,
      source: center,
      target: 'child',
      uci: 'e2e4',
      san: 'e4',
      games: 60,
      share: 0.6,
      qualifies: true,
      manual: false,
    },
  ]);

  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls += 1;
    throw new Error('network should not be reached');
  };

  const controller = new AbortController();
  await discoverForViewport(center, 10, () => controller.abort(), { signal: controller.signal });
  assert.equal(networkCalls, 0);
});
