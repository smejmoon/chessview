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
