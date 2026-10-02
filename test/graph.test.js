import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import {
  canonicalPosition,
  decorateExplorerMoves,
  resolveMove,
  START_FEN,
} from '../src/graph.js';
import { chooseLineNeighborhood } from '../src/visible-graph.js';

function play(sequence) {
  const chess = new Chess();
  sequence.forEach((move) => chess.move(move));
  return chess.fen();
}

function candidate(source, target, uci, share) {
  const edge = { id: `${source}|${uci}|${target}`, source, target, uci, san: uci };
  return { edge, frequency: { share }, automatic: true, rare: share < 0.05, positive: false, rescued: false, negative: false, omitFirst: false };
}

test('canonical identity ignores FEN counters', () => {
  const a = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const b = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 47 99';
  assert.equal(canonicalPosition(a), canonicalPosition(b));
});

test('Resolve Move returns the canonical target and move notation', () => {
  const source = canonicalPosition(START_FEN);
  const resolved = resolveMove(source, { uci: 'e2e4' });
  const chess = new Chess(START_FEN);
  const played = chess.move('e4');

  assert.equal(resolved.target, canonicalPosition(chess.fen()));
  assert.equal(resolved.fen, chess.fen());
  assert.equal(resolved.san, played.san);
  assert.equal(resolved.uci, 'e2e4');
});

test('canonical identity preserves only relevant en-passant state', () => {
  const relevant = play(['e4', 'h5', 'e5', 'd5']);
  assert.match(canonicalPosition(relevant), / d6$/);

  const irrelevant = '8/8/8/3p4/8/8/8/4K2k w - d6 0 1';
  assert.match(canonicalPosition(irrelevant), / -$/);
});

test('different move orders converge on one canonical position', () => {
  const a = play(['Nf3', 'd5', 'g3', 'Nf6', 'Bg2', 'g6']);
  const b = play(['g3', 'd5', 'Nf3', 'Nf6', 'Bg2', 'g6']);
  assert.equal(canonicalPosition(a), canonicalPosition(b));
});

test('Explorer move decoration derives local games and share without classification', () => {
  const explorer = {
    white: 50,
    draws: 20,
    black: 30,
    moves: [
      { uci: 'e2e4', white: 3, draws: 1, black: 1 },
      { uci: 'd2d4', white: 2, draws: 1, black: 1 },
    ],
  };
  const moves = decorateExplorerMoves(explorer);
  assert.equal(moves[0].games, 5);
  assert.equal(moves[0].share, 0.05);
  assert.equal(moves[1].games, 4);
  assert.equal(moves[1].share, 0.04);
});

test('branch-balanced neighborhood gives roots space before going deeper', () => {
  const outgoingBySource = new Map([
    ['center', [candidate('center', 'a1', 'a', 0.6), candidate('center', 'b1', 'b', 0.3)]],
    ['a1', [candidate('a1', 'a2', 'a2', 0.8)]],
    ['a2', [candidate('a2', 'a3', 'a3', 0.8)]],
    ['b1', [candidate('b1', 'b2', 'b2', 0.7)]],
  ]);

  const selected = chooseLineNeighborhood({ center: 'center', outgoingBySource, max: 4 });
  assert.deepEqual(selected.nodes.map((item) => item.key), ['a1', 'b1', 'a2', 'b2']);
  assert.deepEqual(selected.nodes.map((item) => item.lineShare), [0.6, 0.3, 0.6, 0.3]);
  assert.equal(selected.nodes.find((item) => item.key === 'a1')?.merge, false);
  assert.equal(selected.nodes.length, 4);
});

test('bushy Line siblings remain reachable before extra equal-cost depth', () => {
  const outgoingBySource = new Map([
    ['center', [candidate('center', 'a1', 'a', 0.6), candidate('center', 'b1', 'b', 0.3)]],
    ['a1', [candidate('a1', 'a2', 'a2', 0.7), candidate('a1', 'ax', 'ax', 0.2)]],
    ['a2', [candidate('a2', 'a3', 'a3', 0.8)]],
    ['a3', [candidate('a3', 'a4', 'a4', 0.8)]],
    ['b1', [candidate('b1', 'b2', 'b2', 0.7)]],
    ['b2', [candidate('b2', 'b3', 'b3', 0.7)]],
  ]);

  const selected = chooseLineNeighborhood({ center: 'center', outgoingBySource, max: 7 });
  assert.deepEqual(selected.nodes.map((item) => item.key), ['a1', 'b1', 'a2', 'b2', 'ax', 'a3', 'b3']);
  assert.equal(selected.nodes.find((item) => item.key === 'ax')?.branch, 'a');
});

test('Line convergence keeps one board and every visible family relationship', () => {
  const outgoingBySource = new Map([
    ['center', [candidate('center', 'a', 'line-a', 0.6), candidate('center', 'b', 'line-b', 0.25)]],
    ['a', [candidate('a', 'shared', 'a-shared', 0.7)]],
    ['b', [candidate('b', 'shared', 'b-shared', 0.8)]],
    ['shared', [candidate('shared', 'after', 'shared-after', 0.9)]],
  ]);

  const selected = chooseLineNeighborhood({ center: 'center', outgoingBySource, max: 4 });
  assert.deepEqual(selected.nodes.map((item) => item.key), ['a', 'b', 'shared', 'after']);
  assert.deepEqual(selected.nodes.find((item) => item.key === 'shared')?.families, ['line-a', 'line-b']);
  assert.deepEqual(selected.nodes.find((item) => item.key === 'after')?.families, ['line-a', 'line-b']);
  assert.equal(selected.nodes.find((item) => item.key === 'shared')?.merge, true);
  assert.equal(selected.nodes.find((item) => item.key === 'after')?.merge, false);

  const intoShared = selected.relationships.filter((relationship) => relationship.target === 'shared');
  assert.equal(intoShared.length, 2);
  assert.deepEqual(intoShared.map((relationship) => relationship.families), [['line-a'], ['line-b']]);

  const sharedAfter = selected.relationships.find((relationship) => relationship.id === 'shared|shared-after|after');
  assert.deepEqual(sharedAfter?.families, ['line-a', 'line-b']);
  assert.deepEqual(
    sharedAfter?.families.map((family) => selected.families.find((item) => item.id === family)?.lineShare),
    [0.6, 0.25],
  );
  assert.equal(Object.hasOwn(sharedAfter ?? {}, 'lineShare'), false);
  assert.deepEqual(selected.relationships.filter((relationship) => relationship.source === 'shared'), [sharedAfter]);
  assert.equal(selected.nodes.length, 4);
});

test('Line convergence still records zero-cost relationships when the board budget is full', () => {
  const outgoingBySource = new Map([
    ['center', [candidate('center', 'a', 'line-a', 0.6), candidate('center', 'b', 'line-b', 0.25)]],
    ['a', [candidate('a', 'shared', 'a-shared', 0.7)]],
    ['b', [candidate('b', 'shared', 'b-shared', 0.8)]],
  ]);

  const selected = chooseLineNeighborhood({ center: 'center', outgoingBySource, max: 3 });
  assert.deepEqual(selected.nodes.map((item) => item.key), ['a', 'b', 'shared']);
  assert.deepEqual(selected.nodes.find((item) => item.key === 'shared')?.families, ['line-a', 'line-b']);
  assert.equal(selected.relationships.filter((relationship) => relationship.target === 'shared').length, 2);
});

test('visible Line composition exposes only the canonical value shape', () => {
  const outgoingBySource = new Map([['center', [candidate('center', 'a', 'line-a', 0.6)]]]);
  const selected = chooseLineNeighborhood({ center: 'center', outgoingBySource, max: 2 });

  assert.deepEqual(Object.keys(selected).sort(), ['families', 'nodes', 'relationships']);
  assert.deepEqual(selected.families, [{ id: 'line-a', lineShare: 0.6, rootEdgeId: 'center|line-a|a' }]);
  assert.equal(selected.relationships[0].id, 'center|line-a|a');
  assert.equal(selected.nodes[0].key, 'a');
  assert.equal(Object.hasOwn(selected, 'direction'), false);
  assert.equal(Object.hasOwn(selected, 'nodeByKey'), false);
  assert.equal(Object.hasOwn(selected, 'familyById'), false);
  assert.equal(Object.hasOwn(selected, 'relationshipsFor'), false);
});

test('Line neighborhood selection is deterministic and preserves supplied same-source order', () => {
  const outgoingBySource = new Map([
    ['center', [candidate('center', 'b', 'b', 0.2), candidate('center', 'a', 'a', 0.2)]],
  ]);
  const first = chooseLineNeighborhood({ center: 'center', outgoingBySource, max: 2 });
  const second = chooseLineNeighborhood({ center: 'center', outgoingBySource, max: 2 });
  assert.deepEqual(first, second);
  assert.deepEqual(first.nodes.map((item) => item.key), ['b', 'a']);
});
