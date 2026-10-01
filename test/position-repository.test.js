import test from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN, canonicalPosition } from '../src/graph.js';
import { createPositionRepository } from '../src/position-repository.js';

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
