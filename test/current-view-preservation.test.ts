import assert from 'node:assert/strict';
import test from 'node:test';
import { CurrentViewController } from '../src/current-view-controller.ts';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function flush(turns = 16) {
  for (let index = 0; index < turns; index += 1) await Promise.resolve();
}

function structure(center, mode, marker = `${center}:${mode}`) {
  return {
    composition: { center, direction: mode, nodes: [], relationships: [] },
    readingFrontier: [],
    marker,
  };
}

test('history restoration preserves an established projection only when Nodus and mode are unchanged', async () => {
  let hold = null;
  let revision = 0;
  const publications = [];
  const controller = new CurrentViewController({
    initial: { center: 'A', view: 'roots' },
    canonicalize: (value) => String(value).toUpperCase(),
    structure: async ({ center, mode }) => {
      if (hold) await hold.promise;
      return structure(center, mode, `${center}:${mode}:${revision}`);
    },
    rail: async ({ center }) => ({ center }),
    presenter: {
      start(view) { publications.push({ kind: 'start', view }); },
      update(view) { publications.push({ kind: 'update', view }); },
    },
  });

  await controller.start();
  assert.equal(controller.snapshot.structure.value.marker, 'A:roots:0');
  assert.equal(controller.snapshot.rail.status, 'ready');

  publications.length = 0;
  hold = deferred();
  revision = 1;
  const restoringSameProjection = controller.restore({ center: 'a', view: 'roots' });
  await flush(2);

  assert.equal(publications[0].kind, 'start');
  assert.equal(publications[0].view.structure.status, 'ready');
  assert.equal(publications[0].view.structure.value.marker, 'A:roots:0');
  assert.equal(publications[0].view.rail.status, 'ready');

  hold.resolve();
  await restoringSameProjection;
  assert.equal(controller.snapshot.structure.value.marker, 'A:roots:1');

  publications.length = 0;
  hold = deferred();
  revision = 2;
  const restoringOtherMode = controller.restore({ center: 'a', view: 'lines' });
  await flush(2);

  assert.equal(publications[0].kind, 'start');
  assert.equal(publications[0].view.mode, 'lines');
  assert.equal(publications[0].view.structure.status, 'loading');
  assert.equal(publications[0].view.structure.value, null);
  assert.equal(publications[0].view.rail.status, 'ready');

  hold.resolve();
  await restoringOtherMode;
  assert.equal(controller.snapshot.structure.value.marker, 'A:lines:2');

  controller.dispose();
});
