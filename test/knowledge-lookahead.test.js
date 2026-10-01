import test from 'node:test';
import assert from 'node:assert/strict';
import { nominateConstellationLookahead } from '../src/constellation-lookahead.js';
import { createKnowledgeAcquisition } from '../src/knowledge-acquisition.js';
import { NodusController } from '../src/nodus-controller.js';
import { START_FEN, canonicalPosition } from '../src/graph.js';

const center = canonicalPosition(START_FEN);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
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
  const acquisition = createKnowledgeAcquisition({
    loadExplorer: async (key, options) => {
      calls.push([key, options]);
      return sourceReading;
    },
    graph: {
      updateEdge: async () => {
        reconciliations += 1;
        return null;
      },
    },
    repository: { merge: async () => {} },
  });
  const controller = new AbortController();

  assert.equal(await acquisition.warmExplorerReading(center, { signal: controller.signal }), sourceReading);
  assert.equal(reconciliations, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].priority, 'background');
  assert.equal(calls[0][1].signal, controller.signal);
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
      updateEdge: async (edge) => {
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
  const controller = new NodusController({
    initial: { center: 'A', view: 'roots' },
    canonicalize: (value) => String(value).toUpperCase(),
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
