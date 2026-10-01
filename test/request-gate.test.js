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

test('foreground work passes queued background work after the in-flight request', async () => {
  let releaseFirst;
  let firstStarted;
  const firstStartedPromise = new Promise((resolve) => { firstStarted = resolve; });
  const firstHold = new Promise((resolve) => { releaseFirst = resolve; });
  const seen = [];
  const gate = createRequestGate({
    minIntervalMs: 0,
    fetchImpl: async (input) => {
      seen.push(input);
      if (input === 'in-flight') {
        firstStarted();
        await firstHold;
      }
      return { status: 200, input };
    },
  });

  const inFlight = gate.run('in-flight');
  await firstStartedPromise;
  const background = gate.run('background', { priority: 'background' });
  const foreground = gate.run('foreground', { priority: 'foreground' });
  releaseFirst();
  await Promise.all([inFlight, background, foreground]);

  assert.deepEqual(seen, ['in-flight', 'foreground', 'background']);
});

test('queued work observes live priority changes without reinsertion', async () => {
  let releaseFirst;
  let firstStarted;
  let promoted = false;
  const firstStartedPromise = new Promise((resolve) => { firstStarted = resolve; });
  const firstHold = new Promise((resolve) => { releaseFirst = resolve; });
  const seen = [];
  const gate = createRequestGate({
    minIntervalMs: 0,
    fetchImpl: async (input) => {
      seen.push(input);
      if (input === 'in-flight') {
        firstStarted();
        await firstHold;
      }
      return { status: 200, input };
    },
  });

  const inFlight = gate.run('in-flight');
  await firstStartedPromise;
  const live = gate.run('live', { priority: () => promoted ? 'foreground' : 'background' });
  const background = gate.run('background', { priority: 'background' });
  promoted = true;
  releaseFirst();
  await Promise.all([inFlight, live, background]);

  assert.deepEqual(seen, ['in-flight', 'live', 'background']);
});

test('foreground arriving during cooldown receives the next dispatch slot', async () => {
  let clock = 1_000;
  let releaseCooldown;
  let markWaiting;
  const waiting = new Promise((resolve) => { markWaiting = resolve; });
  const seen = [];
  const gate = createRequestGate({
    now: () => clock,
    sleep: async (ms) => {
      assert.equal(ms, 60_000);
      markWaiting();
      await new Promise((resolve) => {
        releaseCooldown = () => {
          clock += ms;
          resolve();
        };
      });
    },
    cooldownMs: 60_000,
    minIntervalMs: 0,
    fetchImpl: async (input) => {
      seen.push(input);
      return { status: input === 'rate-limited' ? 429 : 200, input };
    },
  });

  assert.equal((await gate.run('rate-limited')).status, 429);
  const background = gate.run('background', { priority: 'background' });
  await waiting;
  const foreground = gate.run('foreground', { priority: 'foreground' });
  releaseCooldown();
  await Promise.all([background, foreground]);

  assert.deepEqual(seen, ['rate-limited', 'foreground', 'background']);
});

test('foreground arriving during request spacing receives the next dispatch slot', async () => {
  let clock = 1_000;
  let releaseSpacing;
  let markWaiting;
  let waits = 0;
  const waiting = new Promise((resolve) => { markWaiting = resolve; });
  const seen = [];
  const gate = createRequestGate({
    now: () => clock,
    sleep: async (ms) => {
      waits += 1;
      if (waits === 1) {
        assert.equal(ms, 250);
        markWaiting();
        await new Promise((resolve) => {
          releaseSpacing = () => {
            clock += ms;
            resolve();
          };
        });
        return;
      }
      clock += ms;
    },
    minIntervalMs: 250,
    fetchImpl: async (input) => {
      seen.push(input);
      return { status: 200, input };
    },
  });

  await gate.run('first');
  const background = gate.run('background', { priority: 'background' });
  await waiting;
  const foreground = gate.run('foreground', { priority: 'foreground' });
  releaseSpacing();
  await Promise.all([background, foreground]);

  assert.deepEqual(seen, ['first', 'foreground', 'background']);
  assert.equal(waits, 2);
});

test('aborted queued work is pruned before dispatch selection', async () => {
  let releaseFirst;
  let firstStarted;
  const firstStartedPromise = new Promise((resolve) => { firstStarted = resolve; });
  const firstHold = new Promise((resolve) => { releaseFirst = resolve; });
  const obsolete = new AbortController();
  const seen = [];
  const gate = createRequestGate({
    minIntervalMs: 0,
    fetchImpl: async (input) => {
      seen.push(input);
      if (input === 'in-flight') {
        firstStarted();
        await firstHold;
      }
      return { status: 200, input };
    },
  });

  const inFlight = gate.run('in-flight');
  await firstStartedPromise;
  const abandoned = gate.run('abandoned', { signal: obsolete.signal, priority: 'foreground' });
  const background = gate.run('background', { priority: 'background' });
  obsolete.abort();
  releaseFirst();

  await assert.rejects(abandoned, (error) => error?.name === 'AbortError');
  await Promise.all([inFlight, background]);
  assert.deepEqual(seen, ['in-flight', 'background']);
});
