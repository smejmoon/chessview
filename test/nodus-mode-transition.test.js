import assert from 'node:assert/strict';
import test from 'node:test';
import { NodusController } from '../src/nodus-controller.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function flush(turns = 8) {
  for (let index = 0; index < turns; index += 1) await Promise.resolve();
}

function structure(center, { incomingCount, lineEdges }) {
  return {
    composition: { nodes: [], relationships: [], families: [] },
    centerNode: { key: center },
    incomingCount,
    lineEdges,
    positions: [],
    readingFrontier: [],
    rootRows: [],
  };
}

test('same-Nodus mode switch keeps established tab counts while Roots composes', async () => {
  const roots = deferred();
  const publications = [];
  const lines = [{ id: '1' }, { id: '2' }, { id: '3' }];
  const controller = new NodusController({
    initial: { center: 'A', view: 'lines' },
    canonicalize: (value) => String(value).toUpperCase(),
    structure: async ({ center, mode }) => {
      if (mode === 'roots') return roots.promise;
      return structure(center, { incomingCount: 2, lineEdges: lines });
    },
    presenter: {
      start(view) { publications.push(view); },
      update(view) { publications.push(view); },
    },
  });

  await controller.start();
  assert.equal(controller.snapshot.structure.value.incomingCount, 2);
  assert.equal(controller.snapshot.structure.value.lineEdges.length, 3);

  const switching = controller.setMode('roots');
  await flush();
  assert.equal(controller.snapshot.mode, 'roots');
  assert.equal(controller.snapshot.structure.status, 'loading');
  assert.equal(controller.snapshot.structure.value.incomingCount, 2);
  assert.equal(controller.snapshot.structure.value.lineEdges.length, 3);
  assert.equal(publications.at(-1).structure.value.lineEdges.length, 3);

  roots.resolve(structure('A', { incomingCount: 4, lineEdges: [] }));
  await switching;
  assert.equal(controller.snapshot.structure.status, 'ready');
  assert.equal(controller.snapshot.structure.value.incomingCount, 4);
  assert.equal(controller.snapshot.structure.value.lineEdges.length, 3);
});

test('recenter never carries tab counts from the previous Nodus', async () => {
  const next = deferred();
  const controller = new NodusController({
    initial: { center: 'A', view: 'lines' },
    canonicalize: (value) => String(value).toUpperCase(),
    structure: async ({ center }) => {
      if (center === 'B') return next.promise;
      return structure(center, { incomingCount: 2, lineEdges: [{ id: '1' }] });
    },
    presenter: { start() {}, update() {} },
  });

  await controller.start();
  const recentering = controller.recenter({ target: 'B' });
  await flush();
  assert.equal(controller.snapshot.center, 'B');
  assert.equal(controller.snapshot.structure.status, 'loading');
  assert.equal(controller.snapshot.structure.value, null);

  next.resolve(structure('B', { incomingCount: 1, lineEdges: [] }));
  await recentering;
  assert.equal(controller.snapshot.structure.value.incomingCount, 1);
  assert.equal(controller.snapshot.structure.value.lineEdges.length, 0);
});
