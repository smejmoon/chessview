import test from 'node:test';
import assert from 'node:assert/strict';
import { nominateConstellationLookahead } from '../src/constellation-lookahead.ts';
import { createKnowledgeAcquisition } from '../src/knowledge-acquisition.ts';
import { CurrentViewController } from '../src/current-view-controller.ts';
import { createPositionRepository } from '../src/position-repository.ts';
import { START_FEN, canonicalPosition } from '../src/graph.ts';

const center = canonicalPosition(START_FEN);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function abortError() {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
}

async function flush(turns = 12) {
  for (let index = 0; index < turns; index += 1) await Promise.resolve();
}

test('Constellation lookahead nomination is bounded, ordered, distinct, and excludes the center', () => {
  const nominations = nominateConstellationLookahead({
    center: 'A',
    max: 3,
    structure: {
      composition: {
        nodes: [
          { key: 'A' },
          { key: 'B' },
          { key: 'C' },
          { key: 'B' },
          { key: 'D' },
          { key: 'E' },
        ],
      },
    },
  });

  assert.deepEqual(nominations, ['B', 'C', 'D']);
  assert.ok(Object.isFrozen(nominations));
});

test('supplementary Explorer warming uses background urgency without reconciling graph knowledge', async () => {
  const sourceReading = {
    white: 100,
    draws: 0,
    black: 0,
    moves: [{ uci: 'e2e4', white: 60, draws: 0, black: 0 }],
  };
  const calls = [];
  let reconciliations = 0;
  const warmLifetime = new AbortController();
  const acquisition = createKnowledgeAcquisition({
    loadExplorer: async (key, options) => {
      calls.push([key, options]);
      return sourceReading;
    },
    graph: {
      outgoing: async () => {
        reconciliations += 1;
        return [];
      },
      ensureEdge: async (edge) => {
        reconciliations += 1;
        return edge;
      },
    },
    repository: { merge: async () => {} },
    createTimeoutSignal: (ms) => {
      assert.equal(ms, 30_000);
      return warmLifetime.signal;
    },
  });
  const controller = new AbortController();

  assert.equal(await acquisition.warmExplorerReading(center, { signal: controller.signal }), sourceReading);
  assert.equal(reconciliations, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].priority, 'background');
  assert.equal(calls[0][1].signal, warmLifetime.signal);
  assert.notEqual(calls[0][1].signal, controller.signal);
});

test('obsolete lookahead does not start a supplementary warm', async () => {
  let loads = 0;
  const acquisition = createKnowledgeAcquisition({
    loadExplorer: async () => {
      loads += 1;
      return null;
    },
  });
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    acquisition.warmExplorerReading(center, { signal: controller.signal }),
    { name: 'AbortError' },
  );
  assert.equal(loads, 0);
});

test('started lookahead warm survives view cancellation so foreground demand can share and promote it', async () => {
  const sourceReading = { white: 1, draws: 0, black: 0, moves: [] };
  const repository = createPositionRepository({
    read: async () => null,
    write: async () => {},
    version: () => 0,
  });
  const completion = deferred();
  const warmLifetime = new AbortController();
  let producerCalls = 0;
  let producerSignal = null;
  let producerPriority = null;

  const loadExplorer = (key, options = {}) => repository.load(
    key,
    'explorer',
    ({ signal, priority }) => {
      producerCalls += 1;
      producerSignal = signal;
      producerPriority = priority;
      return completion.promise;
    },
    options,
  );
  const acquisition = createKnowledgeAcquisition({
    loadExplorer,
    createTimeoutSignal: () => warmLifetime.signal,
  });
  const view = new AbortController();

  const warm = acquisition.warmExplorerReading(center, { signal: view.signal });
  await flush();
  assert.equal(producerCalls, 1);
  assert.equal(producerPriority(), 'background');

  view.abort();
  await flush();
  assert.equal(producerSignal.aborted, false);

  const foreground = loadExplorer(center, { priority: 'foreground' });
  await flush();
  assert.equal(producerCalls, 1);
  assert.equal(producerPriority(), 'foreground');

  completion.resolve(sourceReading);
  assert.equal(await warm, sourceReading);
  assert.equal(await foreground, sourceReading);
});

test('detached lookahead warm is aborted when its bounded lifetime expires', async () => {
  const repository = createPositionRepository({
    read: async () => null,
    write: async () => {},
    version: () => 0,
  });
  const warmLifetime = new AbortController();
  let producerSignal = null;

  const loadExplorer = (key, options = {}) => repository.load(
    key,
    'explorer',
    ({ signal }) => {
      producerSignal = signal;
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(abortError()), { once: true });
      });
    },
    options,
  );
  const acquisition = createKnowledgeAcquisition({
    loadExplorer,
    createTimeoutSignal: () => warmLifetime.signal,
  });
  const view = new AbortController();

  const warm = acquisition.warmExplorerReading(center, { signal: view.signal });
  await flush();
  view.abort();
  await flush();
  assert.equal(producerSignal.aborted, false);

  warmLifetime.abort();
  await assert.rejects(warm, { name: 'AbortError' });
  assert.equal(producerSignal.aborted, true);
});

test('a warmed Explorer Reading can later reconcile from cache without another source load', async () => {
  const sourceReading = {
    white: 100,
    draws: 0,
    black: 0,
    moves: [{ uci: 'e2e4', white: 60, draws: 0, black: 0 }],
  };
  let loads = 0;
  let updates = 0;
  const acquisition = createKnowledgeAcquisition({
    loadExplorer: async () => {
      loads += 1;
      return sourceReading;
    },
    readCachedExplorer: async () => sourceReading,
    graph: {
      outgoing: async () => [],
      ensureEdge: async (edge) => {
        updates += 1;
        return edge;
      },
    },
    repository: { merge: async () => {} },
  });

  await acquisition.warmExplorerReading(center);
  assert.equal(loads, 1);
  assert.equal(updates, 0);

  assert.equal(await acquisition.reconcileCachedExplorerReading(center), sourceReading);
  assert.equal(loads, 1);
  assert.equal(updates, 1);
});

test('current-view lookahead participation is private, replaceable, and detached on recenter', async () => {
  const lookahead = [];
  const publications = [];
  const controller = new CurrentViewController({
    initial: { center: 'A', view: 'roots' },
    canonicalize: (value) => String(value).toUpperCase(),
    lens: { orientation: () => 'white', flipOrientation: () => 'black' },
    structure: async ({ center: position, mode }) => ({
      composition: { nodes: [{ key: `${position}:${mode}` }] },
      marker: `${position}:${mode}`,
    }),
    lookahead: ({ center: position, mode, structure, signal }) => {
      const completion = deferred();
      signal.addEventListener('abort', () => completion.resolve(), { once: true });
      lookahead.push({ center: position, mode, structure, signal, completion });
      return completion.promise;
    },
    presenter: {
      start(view) { publications.push(view); },
      update(view) { publications.push(view); },
    },
  });

  await controller.start();
  await flush();
  assert.equal(lookahead.length, 1);
  assert.equal(lookahead[0].mode, 'roots');
  assert.equal(Object.hasOwn(controller.snapshot, 'lookahead'), false);
  assert.equal(publications.some((view) => Object.hasOwn(view, 'lookahead')), false);

  await controller.setMode('lines');
  await flush();
  assert.equal(lookahead[0].signal.aborted, true);
  assert.equal(lookahead.length, 2);
  assert.equal(lookahead[1].mode, 'lines');

  await controller.recenter({ target: 'b' });
  await flush();
  assert.equal(lookahead[1].signal.aborted, true);
  assert.equal(lookahead.at(-1).center, 'B');
  assert.equal(lookahead.at(-1).mode, 'lines');

  controller.dispose();
  assert.equal(lookahead.at(-1).signal.aborted, true);
});
