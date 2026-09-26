import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { canonicalPosition, edgeId, moveToChild, START_FEN } from '../src/graph.js';

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

const { clearGraph, getOutgoing, putEdges, putNode } = await import('../src/db.js');
const { discoverForViewport, ensureManualEdge, loadExplorer } = await import('../src/explorer.js');

const center = canonicalPosition(START_FEN);

function cachedStartExplorer() {
  return {
    white: 500,
    draws: 200,
    black: 300,
    moves: [
      { uci: 'e2e4', san: 'e4', white: 300, draws: 120, black: 180 },
      { uci: 'd2d4', san: 'd4', white: 125, draws: 50, black: 75 },
    ],
  };
}

async function putFreshStartExplorer(explorer = cachedStartExplorer()) {
  await putNode({
    key: center,
    fen: START_FEN,
    explorer,
    explorerFetchedAt: Date.now(),
    games: explorer.white + explorer.draws + explorer.black,
  });
}

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

test('manually exploring a cached Explorer move preserves its statistics', async () => {
  await clearGraph();
  await putFreshStartExplorer();
  globalThis.fetch = async () => {
    throw new Error('fresh Explorer cache should avoid network');
  };

  await loadExplorer(center);
  const before = (await getOutgoing(center)).find((edge) => edge.uci === 'e2e4');
  assert.ok(before);
  assert.equal(before.games, 600);
  assert.equal(before.share, 0.6);
  assert.equal(before.qualifies, true);

  await ensureManualEdge(center, 'e2', 'e4');
  const after = (await getOutgoing(center)).find((edge) => edge.uci === 'e2e4');
  assert.ok(after);
  assert.equal(after.manual, true);
  assert.equal(after.games, 600);
  assert.equal(after.share, 0.6);
  assert.equal(after.qualifies, true);
});

test('fresh cached Explorer snapshot repairs a corrupted manual edge without network', async () => {
  await clearGraph();
  const explorer = cachedStartExplorer();
  await putFreshStartExplorer(explorer);
  const child = moveToChild(center, { uci: 'e2e4' });
  const corrupted = {
    id: '',
    source: center,
    target: child.key,
    uci: child.uci,
    san: child.san,
    games: 0,
    share: 0,
    qualifies: false,
    manual: true,
    updatedAt: 1,
  };
  corrupted.id = edgeId(corrupted);
  await putEdges([corrupted]);

  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls += 1;
    throw new Error('fresh Explorer cache should avoid network');
  };

  await loadExplorer(center);

  assert.equal(networkCalls, 0);
  const repaired = (await getOutgoing(center)).find((edge) => edge.uci === 'e2e4');
  assert.ok(repaired);
  assert.equal(repaired.manual, true);
  assert.equal(repaired.games, 600);
  assert.equal(repaired.share, 0.6);
  assert.equal(repaired.qualifies, true);
});
