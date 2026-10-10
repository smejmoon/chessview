import test from 'node:test';
import assert from 'node:assert/strict';
import { createLichessGateway } from '../src/lichess-gateway.ts';
import { isObsoleteWork } from '../src/obsolete-work.ts';

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

test('foreground work passes queued background work after the in-flight request', async () => {
  let releaseFirst;
  let firstStarted;
  const firstStartedPromise = new Promise((resolve) => { firstStarted = resolve; });
  const firstHold = new Promise((resolve) => { releaseFirst = resolve; });
  const seen = [];
  const gateway = createLichessGateway({
    minIntervalMs: 0,
    fetchImpl: async (input) => {
      seen.push(input);
      if (input === 'in-flight') {
        firstStarted();
        await firstHold;
      }
      return { status: 200, ok: true };
    },
  });

  const inFlight = gateway.request('in-flight');
  await firstStartedPromise;
  const background = gateway.request('background', {}, { urgency: 'background' });
  const foreground = gateway.request('foreground', {}, { urgency: 'foreground' });
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
  const gateway = createLichessGateway({
    minIntervalMs: 0,
    fetchImpl: async (input) => {
      seen.push(input);
      if (input === 'in-flight') {
        firstStarted();
        await firstHold;
      }
      return { status: 200, ok: true };
    },
  });

  const inFlight = gateway.request('in-flight');
  await firstStartedPromise;
  const live = gateway.request('live', {}, { urgency: () => promoted ? 'foreground' : 'background' });
  const background = gateway.request('background', {}, { urgency: 'background' });
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
  const gateway = createLichessGateway({
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
      return { status: input === 'rate-limited' ? 429 : 200, ok: input !== 'rate-limited' };
    },
  });

  assert.equal((await gateway.request('rate-limited')).status, 429);
  const background = gateway.request('background', {}, { urgency: 'background' });
  await waiting;
  const foreground = gateway.request('foreground', {}, { urgency: 'foreground' });
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
  const gateway = createLichessGateway({
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
      return { status: 200, ok: true };
    },
  });

  await gateway.request('first');
  const background = gateway.request('background', {}, { urgency: 'background' });
  await waiting;
  const foreground = gateway.request('foreground', {}, { urgency: 'foreground' });
  releaseSpacing();
  await Promise.all([background, foreground]);

  assert.deepEqual(seen, ['first', 'foreground', 'background']);
  assert.equal(waits, 2);
});

test('queued obsolete work detaches immediately and is never sent', async () => {
  let releaseFirst;
  let firstStarted;
  const firstStartedPromise = new Promise((resolve) => { firstStarted = resolve; });
  const firstHold = new Promise((resolve) => { releaseFirst = resolve; });
  const obsolete = new AbortController();
  const seen = [];
  const gateway = createLichessGateway({
    minIntervalMs: 0,
    fetchImpl: async (input) => {
      seen.push(input);
      if (input === 'in-flight') {
        firstStarted();
        await firstHold;
      }
      return { status: 200, ok: true };
    },
  });

  const inFlight = gateway.request('in-flight');
  await firstStartedPromise;
  const abandoned = gateway.request('abandoned', {}, { signal: obsolete.signal, urgency: 'foreground' });
  obsolete.abort();

  await assert.rejects(abandoned, (error) => isObsoleteWork(error));
  assert.deepEqual(seen, ['in-flight']);

  releaseFirst();
  await inFlight;
  assert.deepEqual(seen, ['in-flight']);
});

test('abort-shaped transport failure without matching cancellation provenance remains a failure', async () => {
  const rawAbort = new Error('transport failed with abort shape');
  rawAbort.name = 'AbortError';
  const live = new AbortController();
  const gateway = createLichessGateway({
    minIntervalMs: 0,
    fetchImpl: async () => { throw rawAbort; },
  });

  await assert.rejects(
    gateway.request('live', { signal: live.signal }),
    (error) => error === rawAbort && !isObsoleteWork(error),
  );
});

test('matching request-signal cancellation translates a transport abort into ObsoleteWork', async () => {
  const controller = new AbortController();
  const rawAbort = new Error('platform aborted fetch');
  rawAbort.name = 'AbortError';
  const gateway = createLichessGateway({
    minIntervalMs: 0,
    fetchImpl: async () => {
      controller.abort();
      throw rawAbort;
    },
  });

  await assert.rejects(
    gateway.request('cancelled', { signal: controller.signal }),
    (error) => isObsoleteWork(error) && error !== rawAbort && error.cause === rawAbort,
  );
});
