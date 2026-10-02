import test from 'node:test';
import assert from 'node:assert/strict';
import { LICHESS_REQUEST_MIN_INTERVAL_MS } from '../src/config.ts';
import { createRequestGate } from '../src/request-gate.js';

test('request gate default spacing comes from central Chessview policy', async () => {
  let clock = 1_000;
  const waits = [];
  const gate = createRequestGate({
    now: () => clock,
    sleep: async (ms) => {
      waits.push(ms);
      clock += ms;
    },
    fetchImpl: async () => ({ status: 200 }),
  });

  await gate.run('first');
  await gate.run('second');

  assert.deepEqual(waits, [LICHESS_REQUEST_MIN_INTERVAL_MS]);
});
