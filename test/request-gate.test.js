import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestGate } from '../src/request-gate.js';

test('request gate never overlaps network requests', async () => {
  let active = 0;
  let maxActive = 0;
  const fetchImpl = async (input) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await Promise.resolve();
    active -= 1;
    return { status: 200, input };
  };

  const gate = createRequestGate({ fetchImpl, minIntervalMs: 0 });
  await Promise.all([gate.run('a'), gate.run('b'), gate.run('c')]);
  assert.equal(maxActive, 1);
});

test('request gate waits a full cooldown after 429', async () => {
  let clock = 1_000;
  const waits = [];
  const statuses = [429, 200];
  const gate = createRequestGate({
    fetchImpl: async () => ({ status: statuses.shift() }),
    now: () => clock,
    sleep: async (ms) => {
      waits.push(ms);
      clock += ms;
    },
    cooldownMs: 60_000,
    minIntervalMs: 0,
  });

  assert.equal((await gate.run('first')).status, 429);
  assert.equal((await gate.run('second')).status, 200);
  assert.deepEqual(waits, [60_000]);
});
