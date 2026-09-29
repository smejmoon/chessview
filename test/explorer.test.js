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
const { discoverForViewport, loadExplorer } = await import('../src/explorer.js');
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

function explorerWithMoves(moves) {
  return {
    white: 50,
    draws: 20,
    black: 30,
    moves: moves.map(([uci, games]) => ({ uci, white: games, draws: 0, black: 0 })),
  };
}

async function putFreshExplorer(position, moves) {
  const explorer = explorerWithMoves(moves);
  await putNode({
    key: position.key,
    fen: position.fen,
    explorer,
    explorerFetchedAt: Date.now(),
    games: 100,
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

test('discovery reaches a qualifying sibling instead of collapsing to one descendant spine', async () => {
  await clearGraph();
  const e4 = positionAfter(['e4']);
  const d4 = positionAfter(['d4']);
  const e4e5 = positionAfter(['e4', 'e5']);
  const e4c5 = positionAfter(['e4', 'c5']);
  const d4d5 = positionAfter(['d4', 'd5']);
  const e4e5nf3 = positionAfter(['e4', 'e5', 'Nf3']);

  await putFreshExplorer({ key: center, fen: START_FEN }, [['e2e4', 60], ['d2d4', 30]]);
  await putFreshExplorer(e4, [['e7e5', 60], ['c7c5', 30]]);
  await putFreshExplorer(d4, [['d7d5', 70]]);
  await putFreshExplorer(e4e5, [['g1f3', 70]]);
  await putFreshExplorer(d4d5, []);
  await putFreshExplorer(e4e5nf3, []);
  await putFreshExplorer(e4c5, [['g1f3', 70]]);

  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls += 1;
    throw new Error('fresh Explorer cache should avoid network');
  };

  await discoverForViewport(center, 6);

  assert.equal(networkCalls, 0);
  assert.ok((await getOutgoing(e4c5.key)).some((edge) => edge.uci === 'g1f3'));
});

test('fresh cached Explorer snapshot repairs a corrupted manual edge without network', async () => {
  await clearGraph();
  const explorer = cachedStartExplorer();
  await putFreshStartExplorer(explorer);
  const resolved = resolveMove(center, { uci: 'e2e4' });
  const corrupted = {
    id: '',
    source: center,
    target: resolved.target,
    uci: resolved.uci,
    san: resolved.san,
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

test('composition reconciles a fresh cached Explorer snapshot before reading outgoing edges', async () => {
  await clearGraph();
  await putFreshStartExplorer();

  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls += 1;
    throw new Error('fresh Explorer cache should avoid network');
  };

  const structure = await composeNodusStructure({ center, mode: 'lines', max: 1 });

  assert.equal(networkCalls, 0);
  assert.deepEqual((await getOutgoing(center)).map((edge) => edge.uci).sort(), ['d2d4', 'e2e4']);
  assert.deepEqual(structure.composition.relationships.map((relationship) => relationship.edge.uci), ['e2e4']);
});

test('composition can use and reconcile stale Explorer when refresh fails', async () => {
  await clearGraph();
  await putStaleStartExplorer();
  localStorage.setItem('chessview.lichess.accessToken', 'test-token');

  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls += 1;
    throw new Error('offline');
  };

  const structure = await composeNodusStructure({ center, mode: 'lines', max: 1 });

  assert.equal(networkCalls, 1);
  assert.ok((await getOutgoing(center)).some((edge) => edge.uci === 'e2e4'));
  assert.deepEqual(structure.composition.relationships.map((relationship) => relationship.edge.uci), ['e2e4']);
});

test('composition propagates structural Explorer failure when no cached evidence exists', async () => {
  await clearGraph();
  localStorage.setItem('chessview.lichess.accessToken', 'test-token');
  globalThis.fetch = async () => {
    throw new Error('offline without cache');
  };

  await assert.rejects(
    composeNodusStructure({ center, mode: 'lines', max: 1 }),
    /offline without cache/,
  );
});

test('Explorer refresh grows topology, updates returned statistics, and never retracts known edges', async () => {
  await clearGraph();
  localStorage.setItem('chessview.lichess.accessToken', 'test-token');

  const e4 = resolveMove(center, { uci: 'e2e4' });
  const d4 = resolveMove(center, { uci: 'd2d4' });
  const c4 = resolveMove(center, { uci: 'c2c4' });
  const existing = [
    {
      id: '',
      source: center,
      target: e4.target,
      uci: e4.uci,
      san: e4.san,
      games: 600,
      share: 0.6,
      qualifies: true,
      manual: true,
      derived: false,
      updatedAt: 1,
    },
    {
      id: '',
      source: center,
      target: d4.target,
      uci: d4.uci,
      san: d4.san,
      games: 250,
      share: 0.25,
      qualifies: true,
      manual: false,
      derived: false,
      updatedAt: 1,
    },
  ];
  existing.forEach((edge) => { edge.id = edgeId(edge); });
  await putEdges(existing);

  const refreshedExplorer = {
    white: 500,
    draws: 200,
    black: 300,
    moves: [
      { uci: 'e2e4', san: 'e4', white: 20, draws: 10, black: 10 },
      { uci: 'c2c4', san: 'c4', white: 100, draws: 50, black: 50 },
    ],
  };
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => refreshedExplorer,
    text: async () => '',
  });

  await loadExplorer(center, { force: true });

  const edges = await getOutgoing(center);
  const byUci = new Map(edges.map((edge) => [edge.uci, edge]));
  assert.equal(edges.length, 3);
  assert.equal(byUci.get('e2e4').games, 40);
  assert.equal(byUci.get('e2e4').share, 0.04);
  assert.equal(byUci.get('e2e4').qualifies, false);
  assert.equal(byUci.get('e2e4').manual, true);
  assert.equal(byUci.get('d2d4').games, 250);
  assert.equal(byUci.get('d2d4').share, 0.25);
  assert.equal(byUci.get('c2c4').games, 200);
  assert.equal(byUci.get('c2c4').share, 0.2);
  assert.equal(byUci.get('c2c4').target, c4.target);
});
