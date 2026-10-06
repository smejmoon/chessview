import assert from 'node:assert/strict';
import test from 'node:test';
import { CurrentViewController } from '../src/current-view-controller.js';

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

async function flush(turns = 8) {
  for (let index = 0; index < turns; index += 1) await Promise.resolve();
}

function structure(center, mode) {
  return {
    composition: { nodes: [], relationships: [], families: [] },
    centerNode: { key: center },
    positions: [],
    readingFrontier: [],
    marker: `${center}:${mode}`,
  };
}

test('same-Nodus mode switch recomposes the one accepted Constellation and keeps Rail', async () => {
  const roots = deferred();
  const structureCalls = [];
  const railValue = {
    rootsCount: 4,
    lines: [{ edge: { uci: 'a1a2', target: 'B' } }],
  };
  const controller = new CurrentViewController({
    initial: { center: 'A', view: 'lines' },
    canonicalize: (value) => String(value).toUpperCase(),
    structure: async ({ center, mode }) => {
      structureCalls.push([center, mode]);
      if (mode === 'roots') return roots.promise;
      return structure(center, mode);
    },
    rail: async () => railValue,
    presenter: { start() {}, update() {} },
  });

  await controller.start();
  await flush();
  assert.equal(controller.snapshot.center, 'A');
  assert.equal(controller.snapshot.mode, 'lines');
  assert.equal(controller.snapshot.structure.value.marker, 'A:lines');
  assert.deepEqual(structureCalls, [['A', 'lines']]);
  assert.deepEqual(controller.snapshot.rail.value, railValue);

  const switching = controller.setMode('roots');
  await flush();
  assert.equal(controller.snapshot.center, 'A');
  assert.equal(controller.snapshot.mode, 'roots');
  assert.equal(controller.snapshot.structure.status, 'loading');
  assert.deepEqual(controller.snapshot.rail.value, railValue);
  assert.deepEqual(structureCalls, [['A', 'lines'], ['A', 'roots']]);

  roots.resolve(structure('A', 'roots'));
  await switching;
  assert.equal(controller.snapshot.structure.status, 'ready');
  assert.equal(controller.snapshot.structure.value.marker, 'A:roots');
  assert.deepEqual(controller.snapshot.rail.value, railValue);

  await controller.setMode('lines');
  assert.equal(controller.snapshot.center, 'A');
  assert.equal(controller.snapshot.structure.value.marker, 'A:lines');
  assert.deepEqual(controller.snapshot.rail.value, railValue);
  assert.deepEqual(structureCalls, [['A', 'lines'], ['A', 'roots'], ['A', 'lines']]);
});

test('recenter starts fresh Rail state without waiting for Rail before accepting the new Nodus', async () => {
  const nextRail = deferred();
  const controller = new CurrentViewController({
    initial: { center: 'A', view: 'lines' },
    canonicalize: (value) => String(value).toUpperCase(),
    structure: async ({ center, mode }) => structure(center, mode),
    rail: async ({ center }) => {
      if (center === 'B') return nextRail.promise;
      return { rootsCount: 2, lines: [] };
    },
    presenter: { start() {}, update() {} },
  });

  await controller.start();
  await flush();
  assert.equal(controller.snapshot.rail.value.rootsCount, 2);

  await controller.recenter({ target: 'B' });
  assert.equal(controller.snapshot.center, 'B');
  assert.equal(controller.snapshot.structure.status, 'ready');
  assert.equal(controller.snapshot.rail.status, 'loading');
  assert.equal(controller.snapshot.rail.value, null);

  nextRail.resolve({ rootsCount: 1, lines: [{ edge: { target: 'C' } }] });
  await flush();
  assert.equal(controller.snapshot.rail.status, 'ready');
  assert.equal(controller.snapshot.rail.value.rootsCount, 1);
  assert.equal(controller.snapshot.rail.value.lines.length, 1);
});
