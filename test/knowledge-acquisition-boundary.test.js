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

const { clearGraph, getNode, putNode } = await import('../src/db.js');
const { EXPLORER_TTL_MS, START_FEN, canonicalPosition, resolveMove } = await import('../src/graph.js');
const { loadExplorerReading } = await import('../src/explorer.js');
const { createKnowledgeAcquisition } = await import('../src/knowledge-acquisition.js');

const center = canonicalPosition(START_FEN);

function reading(moves = [{ uci: 'e2e4', white: 60, draws: 0, black: 0 }]) {
  return { white: 100, draws: 0, black: 0, moves };
}

test('Explorer does not cache or expose a malformed Reading', async () => {
  await clearGraph();
  localStorage.setItem('chessview.lichess.accessToken', 'test-token');
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ white: 100, draws: 0, black: 0, moves: {} }),
    text: async () => '',
  });

  await assert.rejects(
    loadExplorerReading(center, { force: true }),
    (error) => error?.kind === 'invalid-data',
  );
  assert.equal((await getNode(center))?.explorer, undefined);
});

test('Explorer does not treat malformed cached data as a fresh Reading', async () => {
  await clearGraph();
  localStorage.setItem('chessview.lichess.accessToken', 'test-token');
  await putNode({
    key: center,
    fen: START_FEN,
    explorer: { white: 100, draws: 0, black: 0, moves: {} },
    explorerFetchedAt: Date.now(),
  });

  let networkCalls = 0;
  const fresh = reading();
  globalThis.fetch = async () => {
    networkCalls += 1;
    return { ok: true, status: 200, json: async () => fresh, text: async () => '' };
  };

  assert.deepEqual(await loadExplorerReading(center), fresh);
  assert.equal(networkCalls, 1);
  assert.deepEqual((await getNode(center)).explorer, fresh);
});

test('Knowledge Acquisition skips an uninterpretable move but admits other legal topology', async () => {
  const ensured = [];
  const merged = [];
  const acquisition = createKnowledgeAcquisition({
    loadExplorer: async () => reading([
      { uci: 'e2e5', white: 20, draws: 0, black: 0 },
      { uci: 'e2e4', white: 60, draws: 0, black: 0 },
    ]),
    graph: {
      outgoing: async () => [],
      ensureEdge: async (edge) => {
        ensured.push(edge);
        return edge;
      },
    },
    repository: {
      merge: async (key, fields) => { merged.push([key, fields]); },
    },
  });

  await acquisition.acquireExplorerReading(center);

  assert.deepEqual(ensured.map((edge) => edge.uci), ['e2e4']);
  assert.equal('games' in ensured[0], false);
  assert.equal('share' in ensured[0], false);
  assert.equal('updatedAt' in ensured[0], false);
  assert.equal(merged.length, 1);
});

test('ChartedGraph Edge Admission uses source sample sufficiency without a move-share cutoff', async () => {
  const ensured = [];
  const acquisition = createKnowledgeAcquisition({
    loadExplorer: async () => ({
      white: 80,
      draws: 0,
      black: 0,
      moves: [{ uci: 'e2e4', white: 1, draws: 0, black: 0 }],
    }),
    graph: {
      outgoing: async () => [],
      ensureEdge: async (edge) => {
        ensured.push(edge);
        return edge;
      },
    },
    repository: { merge: async () => {} },
  });

  await acquisition.acquireExplorerReading(center);
  assert.deepEqual(ensured.map((edge) => edge.uci), ['e2e4']);
});

test('ChartedGraph Edge Admission declines unknown relationships below the source sample floor', async () => {
  let edgeEnsures = 0;
  const acquisition = createKnowledgeAcquisition({
    loadExplorer: async () => ({
      white: 79,
      draws: 0,
      black: 0,
      moves: [{ uci: 'e2e4', white: 79, draws: 0, black: 0 }],
    }),
    graph: {
      outgoing: async () => [],
      ensureEdge: async (edge) => {
        edgeEnsures += 1;
        return edge;
      },
    },
    repository: { merge: async () => {} },
  });

  await acquisition.acquireExplorerReading(center);
  assert.equal(edgeEnsures, 0);
});

test('Knowledge Acquisition propagates target persistence failure after admitting an edge', async () => {
  let edgeEnsures = 0;
  let targetWrites = 0;
  const acquisition = createKnowledgeAcquisition({
    loadExplorer: async () => reading(),
    graph: {
      outgoing: async () => [],
      ensureEdge: async (edge) => {
        edgeEnsures += 1;
        return edge;
      },
    },
    repository: {
      merge: async () => {
        targetWrites += 1;
        throw new Error('target persistence failed');
      },
    },
  });

  await assert.rejects(
    acquisition.acquireExplorerReading(center),
    /target persistence failed/,
  );
  assert.equal(edgeEnsures, 1);
  assert.equal(targetWrites, 1);
});

test('known Explorer relationships repair target records without rewriting graph topology', async () => {
  const resolved = resolveMove(center, { uci: 'e2e4' });
  const existing = {
    id: 'known-e4',
    source: center,
    target: resolved.target,
    uci: resolved.uci,
    san: resolved.san,
  };
  let edgeEnsures = 0;
  const merged = [];
  const acquisition = createKnowledgeAcquisition({
    loadExplorer: async () => reading(),
    graph: {
      outgoing: async () => [existing],
      ensureEdge: async (edge) => {
        edgeEnsures += 1;
        return edge;
      },
    },
    repository: {
      merge: async (key, fields) => { merged.push([key, fields]); },
    },
  });

  await acquisition.acquireExplorerReading(center);

  assert.equal(edgeEnsures, 0);
  assert.deepEqual(merged, [[resolved.target, { fen: resolved.fen }]]);
});

test('Explorer rejects move counts outside the source sample', async () => {
  await clearGraph();
  localStorage.setItem('chessview.lichess.accessToken', 'test-token');
  const stale = reading();
  const staleFetchedAt = Date.now() - EXPLORER_TTL_MS - 1;
  await putNode({
    key: center,
    fen: START_FEN,
    explorer: stale,
    explorerFetchedAt: staleFetchedAt,
  });
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => reading([{ uci: 'e2e4', white: 101, draws: 0, black: 0 }]),
    text: async () => '',
  });

  assert.deepEqual(await loadExplorerReading(center, { force: true }), stale);
  const stored = await getNode(center);
  assert.deepEqual(stored.explorer, stale);
  assert.equal(stored.explorerFetchedAt, staleFetchedAt);
});
