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

async function putExplorer(position, explorer, fetchedAt = Date.now()) {
  await putNode({
    key: position.key ?? position,
    fen: position.fen ?? START_FEN,
    explorer,
    explorerFetchedAt: fetchedAt,
    games: explorer.white + explorer.draws + explorer.black,
  });
}

async function putFreshStartExplorer(explorer = cachedStartExplorer()) {
  await putExplorer({ key: center, fen: START_FEN }, explorer);
}

async function putStaleStartExplorer(explorer = cachedStartExplorer()) {
  await putExplorer(
    { key: center, fen: START_FEN },
    explorer,
    Date.now() - EXPLORER_TTL_MS - 1,
  );
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

function assertCanonicalStoredShape(edge) {
  assert.equal('games' in edge, false);
  assert.equal('share' in edge, false);
  assert.equal('updatedAt' in edge, false);
  assert.equal('manual' in edge, false);
  assert.equal('derived' in edge, false);
}

test('401 clears the stored Lichess access token', async () => {
  await clearGraph();
  localStorage.setItem('chessview.lichess.accessToken', 'expired-token');
  globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => 'unauthorized' });
  await assert.rejects(loadExplorerReading(center), (error) => error?.status === 401);
  assert.equal(localStorage.getItem('chessview.lichess.accessToken'), null);
});

test('Explorer provider admits a usable Reading without owning Edge Admission', async () => {
  await clearGraph();
  localStorage.setItem('chessview.lichess.accessToken', 'test-token');
  const explorer = explorerWithMoves([['e2e4', 60]], 100);
  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls += 1;
    return { ok: true, status: 200, json: async () => explorer, text: async () => '' };
  };

  assert.deepEqual(await loadExplorerReading(center), explorer);
  assert.deepEqual(await loadExplorerReading(center), explorer);
  assert.equal(networkCalls, 1);
  assert.deepEqual(await getOutgoing(center), []);
});

test('Knowledge Acquisition alone reconciles a fresh cached Explorer Reading into graph topology', async () => {
  await clearGraph();
  await putFreshStartExplorer();
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls += 1; throw new Error('fresh cache should avoid network'); };

  const before = await composeNodusStructure({ center, mode: 'lines', max: 3 });
  assert.equal(networkCalls, 0);
  assert.deepEqual(await getOutgoing(center), []);
  assert.deepEqual(before.composition.relationships, []);

  await loadExplorer(center);
  const stored = await getOutgoing(center);
  assert.equal(networkCalls, 0);
  assert.deepEqual(stored.map((edge) => edge.uci).sort(), ['d2d4', 'e2e4']);

  const after = await composeNodusStructure({ center, mode: 'lines', max: 1 });
  assert.deepEqual(after.composition.relationships.map((relationship) => relationship.edge.uci), ['e2e4']);
});

test('sufficiently sampled Explorer Reading Edge Admits a rare returned legal move without persisting evidence on the edge', async () => {
  await clearGraph();
  localStorage.setItem('chessview.lichess.accessToken', 'test-token');
  const rare = resolveMove(center, { uci: 'a2a3' });
  const explorer = explorerWithMoves([['a2a3', 1]], 1000);
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => explorer, text: async () => '' });

  await loadExplorer(center);

  const stored = (await getOutgoing(center)).find((edge) => edge.uci === 'a2a3');
  assert.ok(stored);
  assert.equal(stored.target, rare.target);
  assertCanonicalStoredShape(stored);
});

test('insufficient Explorer Reading leaves known topology unchanged and does not Edge Admit an unknown move', async () => {
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

  await loadExplorer(center);

  const edges = await getOutgoing(center);
  const stored = edges.find((edge) => edge.uci === 'e2e4');
  assert.equal(stored.explicit, true);
  assertCanonicalStoredShape(stored);
  assert.equal(edges.some((edge) => edge.target === c4.target), false);
});

test('composition exposes missing center Explorer as refinement frontier without starting network work', async () => {
  await clearGraph();
  const isolated = positionAfter(['a3']);
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls += 1; throw new Error('composition must not fetch'); };

  const structure = await composeNodusStructure({ center: isolated.key, mode: 'lines', max: 3 });

  assert.equal(networkCalls, 0);
  assert.deepEqual(structure.composition.relationships, []);
  assert.deepEqual(structure.readingFrontier, [isolated.key]);
});

test('composition exposes only selected descendant positions whose Explorer facts are still missing', async () => {
  await clearGraph();
  await putFreshStartExplorer();
  await loadExplorer(center);
  const e4 = positionAfter(['e4']);
  const d4 = positionAfter(['d4']);
  await putExplorer(e4, explorerWithMoves([['e7e5', 60]]));

  const structure = await composeNodusStructure({ center, mode: 'lines', max: 3 });

  assert.ok(structure.composition.nodes.some((node) => node.key === e4.key));
  assert.ok(structure.composition.nodes.some((node) => node.key === d4.key));
  assert.ok(structure.readingFrontier.includes(d4.key));
  assert.equal(structure.readingFrontier.includes(center), false);
});

test('stale cached Explorer remains usable structural evidence without composition attempting refresh', async () => {
  await clearGraph();
  await putStaleStartExplorer();
  const e4 = resolveMove(center, { uci: 'e2e4' });
  const edge = { id: '', source: center, target: e4.target, uci: e4.uci, san: e4.san, explicit: false };
  edge.id = edgeId(edge);
  await putEdges([edge]);
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls += 1; throw new Error('composition must not refresh'); };

  const structure = await composeNodusStructure({ center, mode: 'lines', max: 1 });

  assert.equal(networkCalls, 0);
  assert.deepEqual(structure.composition.relationships.map((relationship) => relationship.edge.uci), ['e2e4']);
});

test('Explorer source failure cannot make known graph structure fail during composition', async () => {
  await clearGraph();
  const isolated = positionAfter(['h3']);
  const next = resolveMove(isolated.key, { uci: 'a7a6' });
  const edge = {
    id: '',
    source: isolated.key,
    target: next.target,
    uci: next.uci,
    san: next.san,
    explicit: true,
  };
  edge.id = edgeId(edge);
  await putEdges([edge]);
  globalThis.fetch = async () => { throw new Error('offline without cache'); };

  const structure = await composeNodusStructure({ center: isolated.key, mode: 'lines', max: 1 });

  assert.equal(structure.composition.relationships.length, 0);
  assert.deepEqual(structure.readingFrontier, [isolated.key]);
  assert.ok((await getOutgoing(isolated.key)).some((stored) => stored.uci === 'a7a6'));
});

test('Explorer refresh grows admitted topology without rewriting or retracting known edges', async () => {
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
  await loadExplorer(center);

  const edges = await getOutgoing(center);
  const byUci = new Map(edges.map((edge) => [edge.uci, edge]));
  assert.equal(edges.length, 3);
  assert.equal(byUci.get('e2e4').explicit, true);
  assert.ok(byUci.has('d2d4'));
  assert.equal(byUci.get('c2c4').target, c4.target);
  edges.forEach(assertCanonicalStoredShape);
});
