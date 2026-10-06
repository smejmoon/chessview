import assert from 'node:assert/strict';
import test from 'node:test';
import { Chess } from 'chess.js';
import { canonicalPosition } from '../src/graph.js';
import {
  discoverSampledPredecessors,
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
          JSON.stringify({ id: 'abcdefgh', moves: 'e2e4 c7c5 g1f3 d7d6' }),
          JSON.stringify({ id: 'ijklmnop', moves: 'e2e4 c7c5 g1f3 b8c6' }),
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
      text: async () => JSON.stringify({ id: 'abcdefgh', moves: 'e2e4 e7e5' }),
    }),
  });
  assert.deepEqual(nominations, []);
});
