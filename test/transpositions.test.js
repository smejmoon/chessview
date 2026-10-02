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

function assertNoLegacyState(edge) {
  assert.equal('games' in edge, false);
  assert.equal('share' in edge, false);
  assert.equal('updatedAt' in edge, false);
  assert.equal('manual' in edge, false);
  assert.equal('derived' in edge, false);
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
  for (const edge of result.paths.flat()) {
    assertNoLegacyState(edge);
    assert.equal('explicit' in edge, false);
  }
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

test('persisting a transposition path scrubs legacy state without establishing explicit materialization', async () => {
  await clearGraph();
  const topology = pathFromUci(['e2e4'])[0];
  const known = {
    ...topology,
    games: 600,
    share: 0.6,
    manual: false,
    derived: true,
    updatedAt: 1,
  };
  known.id = edgeId(known);
  await putEdges([known]);

  const result = await persistTranspositionPaths([[{ ...topology, id: known.id }]]);
  const stored = (await positionGraph.outgoing(known.source))[0];

  assert.equal(result.addedEdges, 0);
  assertNoLegacyState(stored);
  assert.equal(stored.explicit, false);
});
