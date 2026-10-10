import test from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN, canonicalPosition } from '../src/graph.ts';
import { createPositionRepository } from '../src/position-repository.ts';

const key = canonicalPosition(START_FEN);

function abortableProducer(onStart) {
  return ({ signal }) => new Promise((resolve, reject) => {
    onStart({ signal, resolve });
    signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  });
}

test('position repository reuses an in-memory record before persistence fallback', async () => {
  let reads = 0;
  let version = 0;
  const stored = new Map([[key, { key, fen: START_FEN, games: 12 }]]);
  const repository = createPositionRepository({
    read: async (position) => {
      reads += 1;
      return stored.get(position) ?? null;
    },
    write: async (record) => {
      stored.set(record.key, record);
      version += 1;
      return record;
    },
    version: () => version,
  });

  assert.equal((await repository.get(key)).games, 12);
  assert.equal((await repository.get(key)).games, 12);
  assert.equal(reads, 1);

  await repository.merge(key, { games: 24 });
  assert.equal((await repository.get(key)).games, 24);
  assert.equal(reads, 1);
});

test('concurrent facet merges preserve both updates on one canonical record', async () => {
  let version = 0;
  const stored = new Map([[key, { key, fen: START_FEN }]]);
  const repository = createPositionRepository({
    read: async (position) => stored.get(position) ?? null,
    write: async (record) => {
      await Promise.resolve();
      stored.set(record.key, record);
      version += 1;
      return record;
    },
    version: () => version,
  });

  await Promise.all([
    repository.merge(key, { cloudEval: { depth: 22 } }),
    repository.merge(key, { mastersExplorer: { moves: [] } }),
  ]);

  const record = await repository.get(key);
  assert.equal(record.cloudEval.depth, 22);
  assert.deepEqual(record.mastersExplorer, { moves: [] });
});

test('facet invalidation can target selected positions or one entire facet', () => {
  const second = canonicalPosition('8/8/8/8/8/4k3/4P3/4K3 w - - 0 1');
  const repository = createPositionRepository({ read: async () => null, write: async (value) => value, version: () => 0 });

  repository.admitFacet(key, 'explorer', 'first', { fetchedAt: 1, persisted: true });
  repository.admitFacet(second, 'explorer', 'second', { fetchedAt: 2, persisted: true });
  repository.admitFacet(key, 'cloud-eval', 'eval', { fetchedAt: 3, persisted: true });

  repository.invalidateFacet('explorer', [key]);
  assert.equal(repository.currentFacet(key, 'explorer'), null);
  assert.equal(repository.currentFacet(second, 'explorer').value, 'second');
  assert.equal(repository.currentFacet(key, 'cloud-eval').value, 'eval');

  repository.invalidateFacet('explorer');
  assert.equal(repository.currentFacet(second, 'explorer'), null);
  assert.equal(repository.currentFacet(key, 'cloud-eval').value, 'eval');
});

test('one obsolete caller detaches without cancelling shared position work', async () => {
  const repository = createPositionRepository({ read: async () => null, write: async (value) => value, version: () => 0 });
  const first = new AbortController();
  const second = new AbortController();
  let started;
  let start;
  const startedPromise = new Promise((resolve) => { start = resolve; });
  const producer = abortableProducer((state) => {
    started = state;
    start();
  });

  const firstResult = repository.load(key, 'cloud-eval', producer, { signal: first.signal });
  const secondResult = repository.load(key, 'cloud-eval', producer, { signal: second.signal });
  await startedPromise;

  const firstRejected = assert.rejects(firstResult, (error) => error?.name === 'AbortError');
  first.abort();
  await firstRejected;
  assert.equal(started.signal.aborted, false);

  started.resolve('shared');
  assert.equal(await secondResult, 'shared');
});

test('shared load priority follows the highest live subscriber demand', async () => {
  const repository = createPositionRepository({ read: async () => null, write: async (value) => value, version: () => 0 });
  const foreground = new AbortController();
  let observedPriority;
  let resolveProducer;
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const producer = ({ priority }) => new Promise((resolve) => {
    observedPriority = priority;
    resolveProducer = resolve;
    markStarted();
  });

  const backgroundResult = repository.load(key, 'explorer', producer, { priority: 'background' });
  const foregroundResult = repository.load(key, 'explorer', producer, {
    signal: foreground.signal,
    priority: 'foreground',
  });
  await started;
  assert.equal(observedPriority(), 'foreground');

  const foregroundRejected = assert.rejects(foregroundResult, (error) => error?.name === 'AbortError');
  foreground.abort();
  await foregroundRejected;
  assert.equal(observedPriority(), 'background');

  resolveProducer('shared');
  assert.equal(await backgroundResult, 'shared');
});

test('last obsolete caller aborts the producer and a replacement starts fresh work', async () => {
  const repository = createPositionRepository({ read: async () => null, write: async (value) => value, version: () => 0 });
  const first = new AbortController();
  const second = new AbortController();
  let producerCalls = 0;
  let firstSignal;
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const producer = ({ signal }) => {
    producerCalls += 1;
    if (producerCalls > 1) return Promise.resolve('replacement');
    firstSignal = signal;
    markStarted();
    return new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    });
  };

  const firstResult = repository.load(key, 'masters', producer, { signal: first.signal });
  const secondResult = repository.load(key, 'masters', producer, { signal: second.signal });
  await started;
  const firstRejected = assert.rejects(firstResult, (error) => error?.name === 'AbortError');
  const secondRejected = assert.rejects(secondResult, (error) => error?.name === 'AbortError');

  first.abort();
  assert.equal(firstSignal.aborted, false);
  second.abort();
  await Promise.all([firstRejected, secondRejected]);
  assert.equal(firstSignal.aborted, true);

  assert.equal(await repository.load(key, 'masters', producer), 'replacement');
  assert.equal(producerCalls, 2);
});

test('compatible expired observation is returned before one shared background refresh completes', async () => {
  let finish;
  let calls = 0;
  const old = { count: 1 };
  const newer = { count: 2 };
  let stored = { sample: old, fetchedAt: 1 };
  const repository = createPositionRepository({
    read: async () => stored,
    write: async (value) => { stored = value; },
    version: () => 0,
    log: () => {},
  });
  const options = {
    decode: (record) => record.sample ? { value: record.sample, fetchedAt: record.fetchedAt } : null,
    acquire: async () => {
      calls += 1;
      return new Promise((resolve) => { finish = () => resolve({ value: newer }); });
    },
    fields: ({ value }, { fetchedAt }) => ({ sample: value, fetchedAt }),
    refreshAfterMs: 10,
    now: () => 100,
  };

  assert.strictEqual(await repository.observe(key, 'sample', options), old);
  assert.strictEqual(await repository.observe(key, 'sample', options), old);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(await repository.observe(key, 'sample', options), newer);
});

test('failed cache read does not prevent source acquisition', async () => {
  const issues = [];
  const repository = createPositionRepository({
    read: async () => { throw new Error('read failed'); },
    write: async () => {},
    version: () => 0,
    log: (...args) => issues.push(args),
  });
  const value = { count: 4 };
  const result = await repository.observe(key, 'sample', {
    decode: (record) => ({ value: record.sample, fetchedAt: 1 }),
    acquire: async () => ({ value }),
    fields: () => ({}),
    refreshAfterMs: 10,
    now: () => 100,
  });
  assert.strictEqual(result, value);
  assert.ok(issues.some(([event, detail]) =>
    event === 'Position cache operation failed' && detail.operation === 'read/validate'));
});

test('fresh compatible cached observation avoids acquisition', async () => {
  const cached = { games: 12 };
  let requests = 0;
  const repository = createPositionRepository({
    read: async () => ({ sample: cached, fetchedAt: 50 }),
    version: () => 0,
  });

  const result = await repository.observe(key, 'sample', {
    decode: (record) => ({ value: record.sample, fetchedAt: record.fetchedAt }),
    acquire: async () => { requests += 1; return { value: { games: 13 } }; },
    fields: () => ({}),
    refreshAfterMs: 20,
    now: () => 60,
  });
  assert.strictEqual(result, cached);
  assert.equal(requests, 0);
});

test('incompatible cached observation cannot suppress acquisition', async () => {
  const fresh = { games: 13 };
  let requests = 0;
  const repository = createPositionRepository({
    read: async () => ({ sample: { games: 12 }, profile: 'legacy', fetchedAt: 59 }),
    write: async () => {},
    version: () => 0,
  });
  const options = {
    decode: (record) => record.profile === 'current'
      ? { value: record.sample, fetchedAt: record.fetchedAt }
      : null,
    acquire: async () => { requests += 1; return { value: fresh }; },
    fields: ({ value }, { fetchedAt }) => ({ sample: value, profile: 'current', fetchedAt }),
    refreshAfterMs: 20,
    now: () => 60,
  };
  assert.strictEqual(await repository.observe(key, 'sample', options), fresh);
  assert.strictEqual(await repository.observe(key, 'sample', options), fresh);
  assert.equal(requests, 1);
});

test('failed write preserves live value, diagnostics, and expired fallback', async () => {
  let now = 5;
  let requests = 0;
  let writes = 0;
  const warnings = [];
  const live = { moves: [] };
  const repository = createPositionRepository({
    read: async () => null,
    write: async () => { writes += 1; throw new Error('quota exceeded'); },
    version: () => 0,
    log: (...args) => warnings.push(args),
  });
  const options = {
    decode: (record) => ({ value: record.sample, fetchedAt: record.fetchedAt }),
    acquire: async () => {
      requests += 1;
      if (requests === 1) return { value: live };
      throw new Error('offline');
    },
    fields: ({ value }, { fetchedAt }) => ({ sample: value, fetchedAt }),
    refreshAfterMs: 10,
    now: () => now,
  };

  assert.strictEqual(await repository.observe(key, 'sample', options), live);
  assert.equal(writes, 1);
  assert.equal(repository.currentFacet(key, 'sample').persisted, false);
  assert.ok(warnings.some(([event, detail]) =>
    event === 'Position cache operation failed'
    && detail.operation === 'write'
    && detail.fallback === 'live observation retained'));
  now = 50;
  assert.strictEqual(await repository.observe(key, 'sample', options), live);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests, 2);
  assert.strictEqual(repository.currentFacet(key, 'sample').value, live);
});

test('successful absence is cached while acquisition failure is not', async () => {
  let attempts = 0;
  let record = null;
  const repository = createPositionRepository({
    read: async () => record,
    write: async (value) => { record = value; },
    version: () => 0,
  });
  const options = {
    decode: (value) => Object.hasOwn(value, 'sample')
      ? { value: value.sample, fetchedAt: value.fetchedAt }
      : null,
    acquire: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('offline');
      return { value: null };
    },
    fields: ({ value }, { fetchedAt }) => ({ sample: value, fetchedAt }),
    refreshAfterMs: 10,
    now: () => 30,
  };

  await assert.rejects(repository.observe(key, 'sample', options), /offline/);
  assert.equal(record, null);
  assert.equal(await repository.observe(key, 'sample', options), null);
  assert.equal(await repository.observe(key, 'sample', options), null);
  assert.equal(attempts, 2);
});
