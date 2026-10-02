import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import {
  EXPLORER_TTL_MS,
  canonicalPosition,
  edgeId,
  resolveMove,
  START_FEN,
} from '../src/graph.js';

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
const { loadExplorerReading } = await import('../src/explorer.js');
const { acquireExplorerReading: loadExplorer } = await import('../src/knowledge-acquisition.js');
const { discoverSelectedLines } = await import('../src/constellation-discovery.js');
const { composeNodusStructure } = await import('../src/nodus-structure.js');

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

async function putStaleStartExplorer(explorer = cachedStartExplorer()) {
  await putNode({
    key: center,
    fen: START_FEN,
    explorer,
    explorerFetchedAt: Date.now() - EXPLORER_TTL_MS - 1,
    games: explorer.white + explorer.draws + explorer.black,
  });
}

function positionAfter(sequence) {
  const chess = new Chess();
  sequence.forEach((move) => chess.move(move));
  return { key: canonicalPosition(chess.fen()), fen: chess.fen() };
}

function explorerWithMoves(moves, total = 100) {
  const moveGames = moves.reduce((sum, [, games]) => sum + games, 0);
  if (moveGames > total) throw new Error('move games exceed source sample');
  return {
    white: total,
    draws: 0,
    black: 0,
    moves: moves.map(([uci, games]) => ({ uci, white: games, draws: 0, black: 0 })),
  };
}

async function putFreshExplorer(position, moves, total = 100) {
  const explorer = explorerWithMoves(moves, total);
  await putNode({
    key: position.key,
    fen: position.fen,
    explorer,
    explorerFetchedAt: Date.now(),
    games: total,
  });
}

function assertCanonicalStoredShape(edge) {
  assert.equal('games' in edge, false);
  assert.equal('share' in edge, false);
  assert.equal('qualifies' in edge, false);
  assert.equal('updatedAt' in edge, false);
  assert.equal('manual' in edge, false);
  assert.equal('derived' in edge, false);
}

test('401 clears the stored Lichess access token', async () => {
  await clearGraph();
  localStorage.setItem('chessview.lichess.accessToken', 'expired-token');
  globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => 'unauthorized' });
  await assert.rejects(loadExplorerReading(center, { force: true }), (error) => error?.status === 401);
  assert.equal(localStorage.getItem('chessview.lichess.accessToken'), null);
});

test('Explorer source delivery caches a usable Reading without owning Edge Admission', async () => {
  await clearGraph();
  localStorage.setItem('chessview.lichess.accessToken', 'test-token');
  const explorer = {
    white: 1000,
    draws: 0,
    black: 0,
    moves: [{ uci: 'e2e4', white: 600, draws: 0, black: 0 }],
  };
  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls += 1;
    return { ok: true, status: 200, json: async () => explorer, text: async () => '' };
  };

  assert.deepEqual(await loadExplorerReading(center, { force: true }), explorer);
  assert.deepEqual(await loadExplorerReading(center), explorer);
  assert.equal(networkCalls, 1);
  assert.deepEqual(await getOutgoing(center), []);
});

test('selected Line acquisition reads only positions exposed by the structural Reading frontier', async () => {
  await clearGraph();
  const e4 = positionAfter(['e4']);
  const d4 = positionAfter(['d4']);
  await putFreshExplorer(e4, [['e7e5', 60]]);
  await putFreshExplorer(d4, [['d7d5', 70]]);

  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls += 1;
    throw new Error('fresh Explorer cache should avoid network');
  };

  const structure = {
    composition: { nodes: [{ key: e4.key }, { key: d4.key }] },
    readingFrontier: [e4.key],
  };
  await discoverSelectedLines(center, structure, async () => ({ ...structure, readingFrontier: [] }));

  assert.equal(networkCalls, 0);
  assert.deepEqual((await getOutgoing(e4.key)).map((edge) => edge.uci), ['e7e5']);
  assert.deepEqual(await getOutgoing(d4.key), []);
});

test('selected Line acquisition stops when recomposition clears the structural Reading frontier', async () => {
  await clearGraph();
  const e4 = positionAfter(['e4']);
  await putFreshExplorer(e4, []);
  let progressCalls = 0;
  const structure = {
    composition: { nodes: [{ key: e4.key }] },
    readingFrontier: [e4.key],
  };
  await discoverSelectedLines(center, structure, async () => {
    progressCalls += 1;
    return { composition: { nodes: [{ key: e4.key }] }, readingFrontier: [] };
  });
  assert.equal(progressCalls, 1);
});

test('fresh cached Explorer Reading leaves known explicit topology unchanged without network', async () => {
  await clearGraph();
  await putFreshStartExplorer();
  const resolved = resolveMove(center, { uci: 'e2e4' });
  const known = {
    id: '', source: center, target: resolved.target, uci: resolved.uci, san: resolved.san,
    explicit: true,
  };
  known.id = edgeId(known);
  await putEdges([known]);

  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls += 1; throw new Error('fresh cache should avoid network'); };
  await loadExplorer(center);

  const stored = (await getOutgoing(center)).find((edge) => edge.uci === 'e2e4');
  assert.equal(networkCalls, 0);
  assert.ok(stored);
  assert.equal(stored.explicit, true);
  assertCanonicalStoredShape(stored);
});

test('sufficiently sampled Explorer Reading Edge Admits a rare returned legal move without persisting its evidence', async () => {
  await clearGraph();
  localStorage.setItem('chessview.lichess.accessToken', 'test-token');
  const rare = resolveMove(center, { uci: 'a2a3' });
  const explorer = {
    white: 1000,
    draws: 0,
    black: 0,
    moves: [{ uci: 'a2a3', white: 1, draws: 0, black: 0 }],
  };
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => explorer, text: async () => '' });

  await loadExplorer(center, { force: true });

  const stored = (await getOutgoing(center)).find((edge) => edge.uci === 'a2a3');
  assert.ok(stored);
  assert.equal(stored.target, rare.target);
  assertCanonicalStoredShape(stored);
});

test('insufficient Explorer Reading leaves known topology unchanged and does not Edge Admit an unknown one', async () => {
  await clearGraph();
  localStorage.setItem('chessview.lichess.accessToken', 'test-token');
  const e4 = resolveMove(center, { uci: 'e2e4' });
  const c4 = resolveMove(center, { uci: 'c2c4' });
  const known = {
    id: '', source: center, target: e4.target, uci: e4.uci, san: e4.san,
    explicit: true,
  };
  known.id = edgeId(known);
  await putEdges([known]);

  const explorer = {
    white: 50, draws: 0, black: 0,
    moves: [
      { uci: 'e2e4', white: 20, draws: 0, black: 0 },
      { uci: 'c2c4', white: 10, draws: 0, black: 0 },
    ],
  };
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => explorer, text: async () => '' });

  await loadExplorer(center, { force: true });

  const edges = await getOutgoing(center);
  const stored = edges.find((edge) => edge.uci === 'e2e4');
  assert.equal(stored.explicit, true);
  assertCanonicalStoredShape(stored);
  assert.equal(edges.some((edge) => edge.target === c4.target), false);
});

test('composition reconciles a fresh cached Explorer Reading before reading outgoing edges', async () => {
  await clearGraph();
  await putFreshStartExplorer();
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls += 1; throw new Error('fresh cache should avoid network'); };

  const structure = await composeNodusStructure({ center, mode: 'lines', max: 1 });

  assert.equal(networkCalls, 0);
  assert.deepEqual((await getOutgoing(center)).map((edge) => edge.uci).sort(), ['d2d4', 'e2e4']);
  assert.deepEqual(structure.composition.relationships.map((relationship) => relationship.edge.uci), ['e2e4']);
  assert.deepEqual(structure.readingFrontier, []);
});

test('composition reconciles a selected descendant cached Reading before treating it as known', async () => {
  await clearGraph();
  await putFreshStartExplorer();
  const e4 = positionAfter(['e4']);
  const e5 = positionAfter(['e4', 'e5']);
  await putFreshExplorer(e4, [['e7e5', 60]]);
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls += 1; throw new Error('fresh cache should avoid network'); };

  const structure = await composeNodusStructure({ center, mode: 'lines', max: 3 });

  assert.equal(networkCalls, 0);
  assert.deepEqual((await getOutgoing(e4.key)).map((edge) => edge.uci), ['e7e5']);
  assert.ok(structure.composition.nodes.some((node) => node.key === e5.key));
});

test('composition exposes unresolved Reading frontier only while selected Lines can still grow', async () => {
  await clearGraph();
  await putFreshStartExplorer();
  const e4 = positionAfter(['e4']);
  const d4 = positionAfter(['d4']);
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls += 1; throw new Error('no Explorer request is expected'); };

  const open = await composeNodusStructure({ center, mode: 'lines', max: 3 });
  assert.deepEqual(open.readingFrontier.slice().sort(), [d4.key, e4.key].sort());

  const settled = await composeNodusStructure({ center, mode: 'lines', max: 1 });
  assert.equal(settled.composition.nodes.length, 1);
  assert.deepEqual(settled.readingFrontier, []);

  let progressCalls = 0;
  await discoverSelectedLines(center, settled, async () => {
    progressCalls += 1;
    return settled;
  });
  assert.equal(progressCalls, 0);
  assert.equal(networkCalls, 0);
});

test('composition can use and reconcile a stale Explorer Reading when refresh fails', async () => {
  await clearGraph();
  await putStaleStartExplorer();
  localStorage.setItem('chessview.lichess.accessToken', 'test-token');
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls += 1; throw new Error('offline'); };

  const structure = await composeNodusStructure({ center, mode: 'lines', max: 1 });

  assert.equal(networkCalls, 1);
  assert.ok((await getOutgoing(center)).some((edge) => edge.uci === 'e2e4'));
  assert.deepEqual(structure.composition.relationships.map((relationship) => relationship.edge.uci), ['e2e4']);
});

test('composition propagates structural Explorer failure when no cached Reading exists', async () => {
  await clearGraph();
  localStorage.setItem('chessview.lichess.accessToken', 'test-token');
  globalThis.fetch = async () => { throw new Error('offline without cache'); };
  await assert.rejects(composeNodusStructure({ center, mode: 'lines', max: 1 }), /offline without cache/);
});

test('Explorer Reading refresh grows admitted topology without rewriting or retracting known edges', async () => {
  await clearGraph();
  localStorage.setItem('chessview.lichess.accessToken', 'test-token');

  const e4 = resolveMove(center, { uci: 'e2e4' });
  const d4 = resolveMove(center, { uci: 'd2d4' });
  const c4 = resolveMove(center, { uci: 'c2c4' });
  const existing = [
    { id: '', source: center, target: e4.target, uci: e4.uci, san: e4.san, explicit: true },
    { id: '', source: center, target: d4.target, uci: d4.uci, san: d4.san, explicit: false },
  ];
  existing.forEach((edge) => { edge.id = edgeId(edge); });
  await putEdges(existing);

  const refreshedExplorer = {
    white: 500, draws: 200, black: 300,
    moves: [
      { uci: 'e2e4', san: 'e4', white: 20, draws: 10, black: 10 },
      { uci: 'c2c4', san: 'c4', white: 100, draws: 50, black: 50 },
    ],
  };
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => refreshedExplorer, text: async () => '' });
  await loadExplorer(center, { force: true });

  const edges = await getOutgoing(center);
  const byUci = new Map(edges.map((edge) => [edge.uci, edge]));
  assert.equal(edges.length, 3);
  assert.equal(byUci.get('e2e4').explicit, true);
  assert.ok(byUci.has('d2d4'));
  assert.equal(byUci.get('c2c4').target, c4.target);
  edges.forEach(assertCanonicalStoredShape);
});
