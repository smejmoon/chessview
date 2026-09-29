import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { START_FEN, canonicalPosition, edgeId } from '../src/graph.js';
import { enumerateMoveOrderTranspositions, persistTranspositionPaths } from '../src/transpositions.js';
import { positionGraph } from '../src/position-graph.js';

globalThis.indexedDB = fakeIndexedDB;

const { clearGraph, putEdges } = await import('../src/db.js');

function pathFromUci(moves) {
  const chess = new Chess(START_FEN);
  return moves.map((uci) => {
    const source = canonicalPosition(chess.fen());
    const played = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.slice(4) || undefined,
    });
    assert.ok(played, `expected legal move ${uci}`);
    return {
      source,
      target: canonicalPosition(chess.fen()),
      uci: `${played.from}${played.to}${played.promotion ?? ''}`,
      san: played.san,
    };
  });
}

function uciLine(path) {
  return path.map((edge) => edge.uci).join(' ');
}

test('enumerates legal move-order transpositions into the Panov position', () => {
  const reference = pathFromUci([
    'e2e4', 'c7c6',
    'd2d4', 'd7d5',
    'e4d5', 'c6d5',
    'c2c4',
  ]);
  const target = reference.at(-1).target;

  const result = enumerateMoveOrderTranspositions(reference, target, {
    maxPaths: 256,
    maxStates: 75_000,
  });
  const lines = new Set(result.paths.map(uciLine));

  assert.ok(lines.size > 1);
  assert.ok(lines.has('e2e4 c7c6 d2d4 d7d5 e4d5 c6d5 c2c4'));
  assert.ok(lines.has('d2d4 d7d5 e2e4 c7c6 e4d5 c6d5 c2c4'));
  assert.ok(result.paths.every((path) => path.at(-1).target === target));
});

test('keeps transposition search bounded', () => {
  const reference = pathFromUci([
    'e2e4', 'c7c6',
    'd2d4', 'd7d5',
    'e4d5', 'c6d5',
    'c2c4',
  ]);
  const target = reference.at(-1).target;
  const result = enumerateMoveOrderTranspositions(reference, target, {
    maxPaths: 1,
    maxStates: 20,
  });

  assert.ok(result.paths.length <= 1);
  assert.ok(result.states <= 20);
  assert.equal(result.truncated, true);
});

test('persisting a derived path adds provenance without replacing known statistics', async () => {
  await clearGraph();
  const known = {
    ...pathFromUci(['e2e4'])[0],
    games: 600,
    share: 0.6,
    qualifies: true,
    manual: false,
    updatedAt: 1,
  };
  known.id = edgeId(known);
  await putEdges([known]);

  const derived = {
    ...known,
    games: 0,
    share: 0,
    qualifies: false,
    derived: true,
    updatedAt: 2,
  };
  const result = await persistTranspositionPaths([[derived]]);
  const stored = (await positionGraph.outgoing(known.source))[0];

  assert.equal(result.addedEdges, 0);
  assert.equal(stored.games, 600);
  assert.equal(stored.share, 0.6);
  assert.equal(stored.qualifies, true);
  assert.equal(stored.updatedAt, 1);
  assert.equal(stored.derived, true);
});
