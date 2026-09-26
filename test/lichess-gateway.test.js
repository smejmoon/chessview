import test from 'node:test';
import assert from 'node:assert/strict';
import { createLichessGateway } from '../src/lichess-gateway.js';

test('LichessGateway serializes requests across clients', async () => {
  let active = 0;
  let maxActive = 0;
  const seen = [];
  const gateway = createLichessGateway({
    minIntervalMs: 0,
    fetchImpl: async (input) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      seen.push(input);
      await Promise.resolve();
      active -= 1;
      return { status: 200, ok: true };
    },
  });

  await Promise.all([
    gateway.request('rated-explorer'),
    gateway.request('masters'),
    gateway.request('cloud-eval'),
  ]);

  assert.equal(maxActive, 1);
  assert.deepEqual(seen, ['rated-explorer', 'masters', 'cloud-eval']);
});

test('a 429 from one client pauses later Lichess traffic', async () => {
  let clock = 1_000;
  const waits = [];
  const statuses = [429, 200];
  const gateway = createLichessGateway({
    minIntervalMs: 0,
    cooldownMs: 60_000,
    now: () => clock,
    sleep: async (ms) => {
      waits.push(ms);
      clock += ms;
    },
    fetchImpl: async () => ({ status: statuses.shift(), ok: false }),
  });

  assert.equal((await gateway.request('masters')).status, 429);
  assert.equal((await gateway.request('cloud-eval')).status, 200);
  assert.deepEqual(waits, [60_000]);
});

test('queued aborted work is not sent', async () => {
  let releaseFirst;
  const firstDone = new Promise((resolve) => { releaseFirst = resolve; });
  const seen = [];
  const gateway = createLichessGateway({
    minIntervalMs: 0,
    fetchImpl: async (input) => {
      seen.push(input);
      if (input === 'first') await firstDone;
      return { status: 200, ok: true };
    },
  });

  const controller = new AbortController();
  const first = gateway.request('first');
  const stale = gateway.request('stale', { signal: controller.signal });
  controller.abort();
  releaseFirst();

  await first;
  await assert.rejects(stale, (error) => error?.name === 'AbortError');
  assert.deepEqual(seen, ['first']);
});
