import assert from 'node:assert/strict';
import test from 'node:test';
import { Chess } from 'chess.js';
import { canonicalPosition } from '../src/graph.js';
import {
  discoverSampledPredecessors,
  representativeSampleComplete,
  sampleGameIds,
} from '../src/sampled-predecessors.js';

function positionAfter(moves) {
  const chess = new Chess();
  for (const move of moves) chess.move(move);
  return canonicalPosition(chess.fen());
}

test('sample game ids preserve top then recent order and deduplicate', () => {
  assert.deepEqual(sampleGameIds({
    topGames: [{ id: 'abcdefgh' }, { id: 'ijklmnop' }],
    recentGames: [{ id: 'abcdefgh' }, { id: 'qrstuvwx' }],
  }), ['abcdefgh', 'ijklmnop', 'qrstuvwx']);
});

test('representative sample completeness detects legacy partial samples', () => {
  assert.equal(representativeSampleComplete({
    white: 50,
    draws: 25,
    black: 25,
    topGames: [{ id: 'abcdefgh' }, { id: 'ijklmnop' }],
    recentGames: [{ id: 'qrstuvwx' }, { id: 'yzabcdef' }],
  }), false);

  assert.equal(representativeSampleComplete({
    white: 50,
    draws: 25,
    black: 25,
    topGames: [
      { id: 'abcdefgh' },
      { id: 'ijklmnop' },
      { id: 'qrstuvwx' },
      { id: 'yzabcdef' },
    ],
    recentGames: [
      { id: 'ghijklmn' },
      { id: 'opqrstuv' },
      { id: 'wxyzabcd' },
      { id: 'efghijkl' },
    ],
  }), true);

  assert.equal(representativeSampleComplete({
    white: 2,
    draws: 1,
    black: 0,
    recentGames: [{ id: 'abcdefgh' }, { id: 'ijklmnop' }, { id: 'qrstuvwx' }],
  }), true);
});

test('sampled games nominate the observed move immediately before the exact Nodus', async () => {
  const target = positionAfter(['e4', 'c5', 'Nf3']);
  let request = null;
  const nominations = await discoverSampledPredecessors(target, ['abcdefgh', 'ijklmnop'], {
    request: async (input, init) => {
      request = { input, init };
      return {
        ok: true,
        status: 200,
        text: async () => [
          JSON.stringify({ id: 'abcdefgh', moves: 'e4 c5 Nf3 d6' }),
          JSON.stringify({ id: 'ijklmnop', moves: 'e4 c5 Nf3 Nc6' }),
        ].join('\n'),
      };
    },
  });

  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.body, 'abcdefgh,ijklmnop');
  assert.equal(nominations.length, 1);
  assert.equal(nominations[0].source, positionAfter(['e4', 'c5']));
  assert.equal(nominations[0].uci, 'g1f3');
});

test('sampled game that never reaches the canonical Nodus nominates nothing', async () => {
  const target = positionAfter(['d4', 'd5']);
  const nominations = await discoverSampledPredecessors(target, ['abcdefgh'], {
    request: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 'abcdefgh', moves: 'e4 e5' }),
    }),
  });
  assert.deepEqual(nominations, []);
});


test('sampled-game replay honors an exported initial FEN', async () => {
  const initial = '8/8/8/8/8/4k3/4P3/4K3 w - - 0 1';
  const chess = new Chess(initial);
  chess.move('Kf1');
  const target = canonicalPosition(chess.fen());

  const nominations = await discoverSampledPredecessors(target, ['abcdefgh'], {
    request: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        id: 'abcdefgh',
        initialFen: initial,
        moves: 'Kf1',
      }),
    }),
  });

  assert.equal(nominations.length, 1);
  assert.equal(nominations[0].source, canonicalPosition(initial));
  assert.equal(nominations[0].uci, 'e1f1');
});
