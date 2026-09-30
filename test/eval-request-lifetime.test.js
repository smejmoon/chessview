import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';

globalThis.indexedDB = fakeIndexedDB;

const { clearGraph } = await import('../src/db.js');
const { lichessEval } = await import('../src/lichess-eval.js');
const { lichessGateway } = await import('../src/lichess-gateway.js');

const SHARED = '8/8/8/8/8/8/8/K6k w - -';
const QUEUED = '8/8/8/8/8/8/8/K5k1 w - -';

test('obsolete cloud-eval caller detaches while a same-position caller keeps the request alive', async () => {
  await clearGraph();
  let fetchCalls = 0;
  let releaseFetch;
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const hold = new Promise((resolve) => { releaseFetch = resolve; });
  globalThis.fetch = async () => {
    fetchCalls += 1;
    markStarted();
    await hold;
    return {
      ok: true,
      status: 200,
      json: async () => ({ depth: 22, pvs: [{ cp: 14, moves: 'a1a2' }] }),
    };
  };

  const obsolete = new AbortController();
  const current = new AbortController();
  const oldResult = lichessEval.get(SHARED, { signal: obsolete.signal });
  const currentResult = lichessEval.get(SHARED, { signal: current.signal });
  await started;

  const oldRejected = assert.rejects(oldResult, (error) => error?.name === 'AbortError');
  obsolete.abort();
  await oldRejected;
  releaseFetch();

  assert.equal((await currentResult).depth, 22);
  assert.equal(fetchCalls, 1);
});

test('cloud-eval work with no remaining caller is cancelled before queued fetch', async () => {
  await clearGraph();
  const seen = [];
  let releaseBlocker;
  let markBlockerStarted;
  const blockerStarted = new Promise((resolve) => { markBlockerStarted = resolve; });
  const blockerHold = new Promise((resolve) => { releaseBlocker = resolve; });
  globalThis.fetch = async (input) => {
    const value = String(input);
    seen.push(value);
    if (value === 'blocker') {
      markBlockerStarted();
      await blockerHold;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ depth: 22, pvs: [{ cp: 9, moves: 'a1a2' }] }),
    };
  };

  const blocker = lichessGateway.request('blocker');
  await blockerStarted;

  const first = new AbortController();
  const second = new AbortController();
  const firstResult = lichessEval.get(QUEUED, { signal: first.signal });
  const secondResult = lichessEval.get(QUEUED, { signal: second.signal });
  const firstRejected = assert.rejects(firstResult, (error) => error?.name === 'AbortError');
  const secondRejected = assert.rejects(secondResult, (error) => error?.name === 'AbortError');
  first.abort();
  second.abort();
  await Promise.all([firstRejected, secondRejected]);

  releaseBlocker();
  await blocker;
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(seen, ['blocker']);
});
