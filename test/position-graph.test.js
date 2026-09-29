import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { canonicalPosition, edgeId, resolveMove, START_FEN } from '../src/graph.js';

globalThis.indexedDB = fakeIndexedDB;

const { clearGraph } = await import('../src/db.js');
const { positionGraph } = await import('../src/position-graph.js');

function explorerBackedE4() {
  const source = canonicalPosition(START_FEN);
  const resolved = resolveMove(source, { uci: 'e2e4' });
  return {
    source: START_FEN,
    target: resolved.fen,
    uci: resolved.uci,
    san: resolved.san,
    games: 600,
    share: 0.6,
    qualifies: true,
    updatedAt: 1,
  };
}

test('PositionGraph canonicalizes queries and persists one canonical relationship', async () => {
  await clearGraph();
  const edge = explorerBackedE4();
  const stored = await positionGraph.ensureEdge({ ...edge, id: 'ignored-id' });
  const source = canonicalPosition(edge.source);
  const target = canonicalPosition(edge.target);

  assert.equal(stored.source, source);
  assert.equal(stored.target, target);
  assert.equal(stored.id, edgeId(stored));

  const outgoing = await positionGraph.outgoing(START_FEN);
  const incoming = await positionGraph.incoming(edge.target);
  assert.equal(outgoing.length, 1);
  assert.equal(incoming.length, 1);
  assert.equal(outgoing[0].id, incoming[0].id);
});

test('ensuring an existing edge preserves statistics while provenance accumulates', async () => {
  await clearGraph();
  const edge = explorerBackedE4();
  await positionGraph.ensureEdge(edge);

  const manual = await positionGraph.ensureEdge({
    ...edge,
    games: 0,
    share: 0,
    qualifies: false,
    updatedAt: 2,
  }, { manual: true });
  assert.equal(manual.games, 600);
  assert.equal(manual.share, 0.6);
  assert.equal(manual.qualifies, true);
  assert.equal(manual.updatedAt, 1);
  assert.equal(manual.manual, true);

  const derived = await positionGraph.ensureEdge(edge, { derived: true });
  assert.equal(derived.manual, true);
  assert.equal(derived.derived, true);
  assert.equal((await positionGraph.outgoing(edge.source)).length, 1);
});

test('updateEdge changes mutable statistics without changing identity or established provenance', async () => {
  await clearGraph();
  const edge = explorerBackedE4();

  assert.equal(await positionGraph.updateEdge(edge), null);
  assert.equal((await positionGraph.outgoing(edge.source)).length, 0);

  const created = await positionGraph.updateEdge(edge, { create: true });
  const manual = await positionGraph.ensureEdge(edge, { manual: true });
  const refreshed = await positionGraph.updateEdge({
    ...edge,
    games: 40,
    share: 0.04,
    qualifies: false,
    updatedAt: 2,
  });

  assert.equal(created.id, manual.id);
  assert.equal(refreshed.id, created.id);
  assert.equal(refreshed.source, created.source);
  assert.equal(refreshed.target, created.target);
  assert.equal(refreshed.uci, created.uci);
  assert.equal(refreshed.manual, true);
  assert.equal(refreshed.games, 40);
  assert.equal(refreshed.share, 0.04);
  assert.equal(refreshed.qualifies, false);
  assert.equal(refreshed.updatedAt, 2);
  assert.equal((await positionGraph.outgoing(edge.source)).length, 1);
});

test('concurrent provenance additions accumulate on one edge', async () => {
  await clearGraph();
  const edge = explorerBackedE4();
  await positionGraph.updateEdge(edge, { create: true });

  await Promise.all([
    positionGraph.ensureEdge(edge, { manual: true }),
    positionGraph.ensureEdge(edge, { derived: true }),
  ]);

  const [stored] = await positionGraph.outgoing(edge.source);
  assert.equal(stored.manual, true);
  assert.equal(stored.derived, true);
  assert.equal(stored.games, 600);
});

test('concurrent statistical refresh and provenance addition retain both results', async () => {
  await clearGraph();
  const edge = explorerBackedE4();
  await positionGraph.updateEdge(edge, { create: true });

  await Promise.all([
    positionGraph.ensureEdge({
      ...edge,
      games: 0,
      share: 0,
      qualifies: false,
      updatedAt: 1,
    }, { manual: true }),
    positionGraph.updateEdge({
      ...edge,
      games: 250,
      share: 0.25,
      qualifies: true,
      updatedAt: 3,
    }),
  ]);

  const [stored] = await positionGraph.outgoing(edge.source);
  assert.equal(stored.manual, true);
  assert.equal(stored.games, 250);
  assert.equal(stored.share, 0.25);
  assert.equal(stored.updatedAt, 3);
});

test('PositionGraph rejects an edge whose target does not match its legal move', async () => {
  await clearGraph();
  const source = canonicalPosition(START_FEN);
  const wrongTarget = resolveMove(source, { uci: 'd2d4' }).target;

  await assert.rejects(
    positionGraph.ensureEdge({ source, target: wrongTarget, uci: 'e2e4' }),
    /target does not match/,
  );
  assert.equal((await positionGraph.outgoing(source)).length, 0);
});
