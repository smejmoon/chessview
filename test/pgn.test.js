import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPgnMoves, formatPgnSuffix, reconstructPgn, reconstructPgnPath } from '../src/pgn.js';

function edge(source, target, san, games = 0) {
  return { source, target, san, uci: san, games, share: 0.1 };
}

test('formats SAN moves with PGN move numbers', () => {
  assert.equal(formatPgnMoves([
    edge('s', 'a', 'e4'),
    edge('a', 'b', 'c6'),
    edge('b', 'c', 'd4'),
    edge('c', 'd', 'd5'),
    edge('d', 'e', 'exd5'),
  ]), '1. e4 c6 2. d4 d5 3. exd5');
});

test('formats a Root breadcrumb from the ending and keeps absolute move numbers', () => {
  const moves = [
    edge('s', 'a', 'e4'),
    edge('a', 'b', 'c6'),
    edge('b', 'c', 'd4'),
    edge('c', 'd', 'd5'),
    edge('d', 'e', 'exd5'),
    edge('e', 'f', 'cxd5'),
    edge('f', 'g', 'c4'),
  ];
  assert.equal(formatPgnSuffix(moves, 4), '… 2... d5 3. exd5 cxd5 4. c4');
});

test('reconstructs a deterministic known path back to start', () => {
  const incomingByTarget = new Map([
    ['root', [edge('b', 'root', 'exd5')]],
    ['b', [edge('a', 'b', 'd5')]],
    ['a', [edge('start', 'a', 'e4')]],
  ]);
  assert.equal(reconstructPgn('root', incomingByTarget, 'start'), '1. e4 d5 2. exd5');
  assert.deepEqual(reconstructPgnPath('root', incomingByTarget, 'start').map((item) => item.san), ['e4', 'd5', 'exd5']);
});

test('returns null when known ancestry does not reach start', () => {
  const incomingByTarget = new Map([
    ['root', [edge('x', 'root', 'd5')]],
  ]);
  assert.equal(reconstructPgn('root', incomingByTarget, 'start'), null);
  assert.equal(reconstructPgnPath('root', incomingByTarget, 'start'), null);
});
