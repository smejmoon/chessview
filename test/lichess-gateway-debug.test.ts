import test from 'node:test';
import assert from 'node:assert/strict';
import { createLichessGateway } from '../src/lichess-gateway.ts';

function captureLog() {
  const entries = [];
  return {
    entries,
    log(event, detail, level = 'info') { entries.push({ event, detail, level }); },
  };
}

test('LichessGateway reports queued, dispatch, and response lifecycle without query details', async () => {
  const captured = captureLog();
  const gateway = createLichessGateway({
    minIntervalMs: 0,
    log: captured.log,
    fetchImpl: async () => ({ status: 200, ok: true }),
  });

  await gateway.request('https://explorer.lichess.org/lichess?fen=SECRET&moves=30', { priority: 'background' });

  assert.deepEqual(captured.entries.map(({ event }) => event), [
    'lichess gateway queued',
    'lichess gateway dispatch',
    'lichess gateway response',
  ]);
  assert.equal(captured.entries[0].detail.endpoint, 'explorer.lichess.org/lichess');
  assert.equal(captured.entries[0].detail.priority, 'background');
  assert.equal(JSON.stringify(captured.entries).includes('SECRET'), false);
});

test('LichessGateway reports rate-limit cooldown and the wait before later traffic', async () => {
  let clock = 1_000;
  const captured = captureLog();
  const statuses = [429, 200];
  const gateway = createLichessGateway({
    minIntervalMs: 0,
    cooldownMs: 60_000,
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    log: captured.log,
    fetchImpl: async () => {
      const status = statuses.shift();
      return { status, ok: status === 200 };
    },
  });

  await gateway.request('https://lichess.org/api/cloud-eval');
  await gateway.request('https://explorer.lichess.org/masters');

  const cooldown = captured.entries.find(({ event }) => event === 'lichess gateway cooldown');
  const wait = captured.entries.find(({ event }) => event === 'lichess gateway waiting');
  assert.equal(cooldown.detail.cooldownMs, 60_000);
  assert.equal(wait.detail.reason, 'cooldown');
  assert.equal(wait.detail.delayMs, 60_000);
});
