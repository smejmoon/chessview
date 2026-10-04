import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';

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

const { clearGraph, putNode } = await import('../src/db.js');
const { START_FEN, canonicalPosition } = await import('../src/graph.js');
const { acquireExplorerReading } = await import('../src/knowledge-acquisition.js');
const { composeNodusStructure } = await import('../src/nodus-structure.js');

const center = canonicalPosition(START_FEN);

test('source-usable Explorer Reading stays on the structural frontier until reconciled', async () => {
  await clearGraph();
  const explorer = { white: 100, draws: 0, black: 0, moves: [] };
  await putNode({
    key: center,
    fen: START_FEN,
    explorer,
    explorerFetchedAt: Date.now(),
    games: 100,
  });
  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls += 1;
    throw new Error('fresh cache should not hit network');
  };

  const before = await composeNodusStructure({ center, mode: 'lines', max: 1 });
  assert.equal(networkCalls, 0);
  assert.deepEqual(before.readingFrontier, [center]);
  assert.equal(before.settling, true);

  await acquireExplorerReading(center);
  const after = await composeNodusStructure({ center, mode: 'lines', max: 1 });

  assert.equal(networkCalls, 0);
  assert.deepEqual(after.readingFrontier, []);
  assert.equal(after.settling, false);
});
