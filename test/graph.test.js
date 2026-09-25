import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import {
  canonicalPosition,
  chooseNeighborhood,
  decorateExplorerMoves,
  omittedShare,
} from '../src/graph.js';

function play(sequence) {
  const chess = new Chess();
  sequence.forEach((move) => chess.move(move));
  return chess.fen();
}

test('canonical identity ignores FEN counters', () => {
  const a = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const b = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 47 99';
  assert.equal(canonicalPosition(a), canonicalPosition(b));
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

test('5 percent qualification is local to each source sample', () => {
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
  assert.equal(moves[0].share, 0.05);
  assert.equal(moves[0].qualifies, true);
  assert.equal(moves[1].qualifies, false);
  assert.equal(omittedShare(explorer), 0.04);
});

test('small samples stop automatic expansion', () => {
  const explorer = {
    white: 30,
    draws: 20,
    black: 29,
    moves: [{ uci: 'e2e4', white: 25, draws: 15, black: 20 }],
  };
  assert.equal(decorateExplorerMoves(explorer)[0].qualifies, false);
});

test('branch-balanced neighborhood gives roots space before going deeper', () => {
  const outgoingBySource = new Map([
    ['center', [
      { source: 'center', target: 'a1', uci: 'a', share: 0.6, qualifies: true },
      { source: 'center', target: 'b1', uci: 'b', share: 0.3, qualifies: true },
    ]],
    ['a1', [{ source: 'a1', target: 'a2', uci: 'a2', share: 0.8, qualifies: true }]],
    ['a2', [{ source: 'a2', target: 'a3', uci: 'a3', share: 0.8, qualifies: true }]],
    ['b1', [{ source: 'b1', target: 'b2', uci: 'b2', share: 0.7, qualifies: true }]],
  ]);

  const selected = chooseNeighborhood({ center: 'center', outgoingBySource, max: 4 });
  assert.deepEqual(selected.map((item) => item.key), ['a1', 'b1', 'a2', 'b2']);
  assert.deepEqual(selected.map((item) => item.lineShare), [0.6, 0.3, 0.6, 0.3]);
  assert.equal(selected.length, 4);
});

test('neighborhood selection is deterministic', () => {
  const outgoingBySource = new Map([
    ['center', [
      { source: 'center', target: 'b', uci: 'b', share: 0.2, qualifies: true },
      { source: 'center', target: 'a', uci: 'a', share: 0.2, qualifies: true },
    ]],
  ]);
  const first = chooseNeighborhood({ center: 'center', outgoingBySource, max: 2 });
  const second = chooseNeighborhood({ center: 'center', outgoingBySource, max: 2 });
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((item) => item.key), ['a', 'b']);
});
