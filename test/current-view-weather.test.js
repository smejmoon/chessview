import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CurrentViewController,
  refinementRetryable,
  refinementUnavailable,
} from '../src/current-view-controller.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function flush(turns = 48) {
  for (let index = 0; index < turns; index += 1) await Promise.resolve();
}

function structure(frontier) {
  return {
    composition: { nodes: [], relationships: [] },
    readingFrontier: frontier,
  };
}

test('Weather exposes aggregate refinement measures without task or position identity', async () => {
  const retry = deferred();
  const structuralWorking = deferred();
  const supplementaryWorking = deferred();
  const frontier = ['B', 'C', 'D', 'E', 'F', 'G'];
  const controller = new CurrentViewController({
    initial: { center: 'A', view: 'lines' },
    canonicalize: (value) => String(value),
    structure: async () => structure(frontier),
    refine: () => [
      { key: 'unavailable', structuralReading: 'B', run: async () => refinementUnavailable },
      { key: 'failed', structuralReading: 'C', run: async () => { throw new Error('reconciliation failed'); } },
      { key: 'retry', structuralReading: 'D', run: async () => refinementRetryable(retry.promise) },
      { key: 'satisfied', structuralReading: 'F', run: async () => undefined },
      { key: 'working', structuralReading: 'G', run: () => structuralWorking.promise },
      { key: 'supplementary', run: () => supplementaryWorking.promise },
    ],
    presenter: { start() {}, update() {} },
  });

  await controller.start();
  await flush();

  assert.deepEqual(controller.snapshot.weather, {
    structure: 'ready',
    frontier: 6,
    structural: {
      working: 1,
      retryWaiting: 1,
      satisfied: 1,
      incorporationPending: 0,
      unavailable: 1,
      failed: 1,
      unplanned: 1,
      detached: 0,
    },
    supplementary: { active: 1, total: 1 },
  });
  assert.equal(controller.snapshot.settling, true);
  assert.equal(JSON.stringify(controller.snapshot.weather).includes('explorer:'), false);
  assert.equal(Object.isFrozen(controller.snapshot.weather), true);
  assert.equal(Object.isFrozen(controller.snapshot.weather.structural), true);

  controller.dispose();
});

test('successful structural work blocks only until its settlement pass has attempted incorporation', async () => {
  const work = deferred();
  const secondComposition = deferred();
  let compositions = 0;
  const controller = new CurrentViewController({
    initial: { center: 'A', view: 'lines' },
    canonicalize: (value) => String(value),
    structure: async () => {
      compositions += 1;
      if (compositions === 2) await secondComposition.promise;
      return structure(['B']);
    },
    refine: () => [{
      key: 'structural',
      structuralReading: 'B',
      run: () => work.promise,
    }],
    presenter: { start() {}, update() {} },
  });

  await controller.start();
  assert.equal(controller.snapshot.weather.structural.working, 1);
  assert.equal(controller.snapshot.settling, true);

  work.resolve();
  await flush(8);
  assert.equal(compositions, 2);
  assert.equal(controller.snapshot.weather.structural.satisfied, 1);
  assert.equal(controller.snapshot.weather.structural.incorporationPending, 1);
  assert.equal(controller.snapshot.settling, true);

  secondComposition.resolve();
  await flush();
  assert.deepEqual(controller.snapshot.structure.value.readingFrontier, ['B']);
  assert.equal(controller.snapshot.weather.structural.satisfied, 1);
  assert.equal(controller.snapshot.weather.structural.incorporationPending, 0);
  assert.equal(controller.snapshot.settling, false);

  controller.dispose();
});


test('failed and unplanned structural coordination remain diagnostic without implying automatic progress', async () => {
  const controller = new CurrentViewController({
    initial: { center: 'A', view: 'lines' },
    canonicalize: (value) => String(value),
    structure: async () => structure(['B', 'C']),
    refine: () => [{
      key: 'failed',
      structuralReading: 'B',
      run: async () => { throw new Error('coordination failed'); },
    }],
    presenter: { start() {}, update() {} },
  });

  await controller.start();
  await flush();

  assert.equal(controller.snapshot.weather.structural.failed, 1);
  assert.equal(controller.snapshot.weather.structural.unplanned, 1);
  assert.equal(controller.snapshot.weather.structural.working, 0);
  assert.equal(controller.snapshot.weather.structural.retryWaiting, 0);
  assert.equal(controller.snapshot.weather.structural.incorporationPending, 0);
  assert.equal(controller.snapshot.settling, false);

  controller.dispose();
});


test('ready frontier is published only after synchronous structural participation is reconciled', async () => {
  const work = deferred();
  const publications = [];
  const controller = new CurrentViewController({
    initial: { center: 'A', view: 'lines' },
    canonicalize: (value) => String(value),
    structure: async () => structure(['B']),
    refine: () => [{
      key: 'explorer:B',
      structuralReading: 'B',
      run: () => work.promise,
    }],
    presenter: {
      start(view) { publications.push(view); },
      update(view) { publications.push(view); },
    },
  });

  await controller.start();
  await controller.refresh();

  const readyWithFrontier = publications.filter(
    ({ structure: lifecycle, weather }) => lifecycle.status === 'ready' && weather.frontier > 0,
  );
  assert.ok(readyWithFrontier.length > 0);
  assert.ok(readyWithFrontier.every(({ settling, weather }) => (
    settling === true
    && weather.structural.working === 1
    && weather.structural.unplanned === 0
  )));

  controller.dispose();
});
