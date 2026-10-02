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
    updatedAt: 1,
  };
}

function assertCanonicalStoredShape(edge) {
  assert.equal('games' in edge, false);
  assert.equal('share' in edge, false);
  assert.equal('updatedAt' in edge, false);
  assert.equal('manual' in edge, false);
  assert.equal('derived' in edge, false);
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
  assert.equal(stored.explicit, false);
  assertCanonicalStoredShape(stored);

  const outgoing = await positionGraph.outgoing(START_FEN);
  const incoming = await positionGraph.incoming(edge.target);
  assert.equal(outgoing.length, 1);
  assert.equal(incoming.length, 1);
  assert.equal(outgoing[0].id, incoming[0].id);
  assertCanonicalStoredShape(outgoing[0]);
});

test('ensureEdge scrubs legacy fields and only its explicit option establishes explicit materialization', async () => {
  await clearGraph();
  const edge = explorerBackedE4();
  const legacy = {
    ...edge,
    id: edgeId(edge),
    manual: true,
    derived: true,
  };
  await putEdges([legacy]);

  const ordinary = await positionGraph.ensureEdge({
    ...edge,
    manual: true,
    derived: true,
  });
  assert.equal(ordinary.explicit, false);
  assertCanonicalStoredShape(ordinary);

  const explicit = await positionGraph.ensureEdge(edge, { explicit: true });
  assert.equal(explicit.explicit, true);
  assertCanonicalStoredShape(explicit);
  assert.equal((await positionGraph.outgoing(edge.source)).length, 1);
});

test('concurrent ensures retain one canonical relationship and explicit materialization', async () => {
  await clearGraph();
  const edge = explorerBackedE4();

  await Promise.all([
    positionGraph.ensureEdge(edge),
    positionGraph.ensureEdge(edge, { explicit: true }),
  ]);

  const [stored] = await positionGraph.outgoing(edge.source);
  assert.equal(stored.explicit, true);
  assert.equal(stored.id, edgeId(stored));
  assertCanonicalStoredShape(stored);
});

test('PositionGraph exposes no mutable-evidence update operation', () => {
  assert.equal('updateEdge' in positionGraph, false);
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
