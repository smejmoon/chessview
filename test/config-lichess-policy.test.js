import test from 'node:test';
import assert from 'node:assert/strict';
import { LICHESS_REQUEST_MIN_INTERVAL_MS } from '../src/config.ts';
import { createLichessGateway } from '../src/lichess-gateway.js';

test('LichessGateway default spacing comes from central Chessview policy', async () => {
  let clock = 1_000;
  const waits = [];
  const gateway = createLichessGateway({
    now: () => clock,
    sleep: async (ms) => {
      waits.push(ms);
      clock += ms;
    },
    fetchImpl: async () => ({ status: 200 }),
  });

  await gateway.request('first');
  await gateway.request('second');

  assert.deepEqual(waits, [LICHESS_REQUEST_MIN_INTERVAL_MS]);
});
