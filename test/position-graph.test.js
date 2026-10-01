import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { canonicalPosition, edgeId, resolveMove, START_FEN } from '../src/graph.js';

globalThis.indexedDB = fakeIndexedDB;

const { clearGraph, putEdges } = await import('../src/db.js');
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

function assertNoExplorerEvidence(edge) {
  assert.equal('games' in edge, false);
  assert.equal('share' in edge, false);
  assert.equal('qualifies' in edge, false);
  assert.equal('updatedAt' in edge, false);
}

test('PositionGraph canonicalizes queries and persists only durable relationship state', async () => {
  await clearGraph();
  const edge = explorerBackedE4();
  const stored = await positionGraph.ensureEdge({ ...edge, id: 'ignored-id' });
  const source = canonicalPosition(edge.source);
  const target = canonicalPosition(edge.target);

  assert.equal(stored.source, source);
  assert.equal(stored.target, target);
  assert.equal(stored.id, edgeId(stored));
  assertNoExplorerEvidence(stored);

  const outgoing = await positionGraph.outgoing(START_FEN);
  const incoming = await positionGraph.incoming(edge.target);
  assert.equal(outgoing.length, 1);
  assert.equal(incoming.length, 1);
  assert.equal(outgoing[0].id, incoming[0].id);
  assertNoExplorerEvidence(outgoing[0]);
});

test('ensuring an existing edge scrubs legacy evidence while provenance accumulates', async () => {
  await clearGraph();
  const edge = explorerBackedE4();
  const legacy = { ...edge, id: edgeId(edge), manual: false, derived: false };
  await putEdges([legacy]);

  const manual = await positionGraph.ensureEdge(edge, { manual: true });
  assertNoExplorerEvidence(manual);
  assert.equal(manual.manual, true);

  const derived = await positionGraph.ensureEdge(edge, { derived: true });
  assert.equal(derived.manual, true);
  assert.equal(derived.derived, true);
  assertNoExplorerEvidence(derived);
  assert.equal((await positionGraph.outgoing(edge.source)).length, 1);
});

test('updateEdge changes no source evidence and preserves identity/provenance', async () => {
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
  assertNoExplorerEvidence(created);
  assertNoExplorerEvidence(refreshed);
  assert.equal((await positionGraph.outgoing(edge.source)).length, 1);
});

test('updateEdge never establishes retention provenance from its payload', async () => {
  await clearGraph();
  const edge = explorerBackedE4();

  const created = await positionGraph.updateEdge({
    ...edge,
    manual: true,
    derived: true,
  }, { create: true });
  assert.equal(created.manual, false);
  assert.equal(created.derived, false);
  assertNoExplorerEvidence(created);

  const refreshed = await positionGraph.updateEdge({
    ...edge,
    manual: true,
    derived: true,
    games: 250,
    share: 0.25,
    updatedAt: 3,
  });
  assert.equal(refreshed.manual, false);
  assert.equal(refreshed.derived, false);
  assertNoExplorerEvidence(refreshed);
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
  assertNoExplorerEvidence(stored);
});

test('concurrent refresh-shaped input and provenance addition retain topology and provenance only', async () => {
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
  assertNoExplorerEvidence(stored);
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
