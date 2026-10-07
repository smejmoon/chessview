import assert from 'node:assert/strict';
import test from 'node:test';
import { CurrentViewController } from '../src/current-view-controller.ts';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush(turns = 24) {
  for (let index = 0; index < turns; index += 1) await Promise.resolve();
}

test('same-run recomposition can admit structural work after presentation constraints change', async () => {
  const reading = deferred();
  const publications = [];
  let compositions = 0;
  let roomy = false;
  let incorporated = false;
  let starts = 0;

  const controller = new CurrentViewController({
    initial: { center: 'A', view: 'lines' },
    canonicalize: (value) => String(value),
    structure: async ({ center, mode }) => {
      compositions += 1;
      const readingFrontier = roomy && !incorporated ? ['B'] : [];
      return {
        composition: {
          center,
          direction: mode,
          nodes: roomy ? [{ key: 'B' }] : [],
        },
        readingFrontier,
        marker: `${mode}:${roomy}:${incorporated}`,
      };
    },
    refine: ({ structure }) => structure?.readingFrontier?.includes('B')
      ? [{
          key: 'explorer:B',
          structuralReading: 'B',
          run: async () => {
            await reading.promise;
            incorporated = true;
          },
        }]
      : [],
    presenter: {
      start(view) {
        starts += 1;
        publications.push(view);
      },
      update(view) {
        publications.push(view);
      },
    },
  });

  await controller.start();
  await flush();

  assert.equal(starts, 1);
  assert.equal(controller.snapshot.structure.value.marker, 'lines:false:false');
  assert.equal(controller.snapshot.settling, false);
  const before = compositions;
  const publishedBefore = publications.length;

  roomy = true;
  await controller.recompose();
  await flush();

  assert.equal(starts, 1);
  assert.ok(compositions > before);
  assert.equal(controller.snapshot.structure.value.marker, 'lines:true:false');
  assert.equal(controller.snapshot.settling, true);
  assert.ok(publications.slice(publishedBefore).some(({ settling }) => settling === true));

  reading.resolve();
  await flush(40);

  assert.equal(starts, 1);
  assert.equal(controller.snapshot.structure.value.marker, 'lines:true:true');
  assert.equal(controller.snapshot.settling, false);
});

test('supplementary refinement during settlement recomposition drains another pass without inventing structural progress', async () => {
  const first = deferred();
  const second = deferred();
  const settlementGate = deferred();
  const settlementEntered = deferred();
  const publications = [];
  let fact = 0;
  let compositions = 0;

  const controller = new CurrentViewController({
    initial: { center: 'A', view: 'lines' },
    canonicalize: (value) => String(value),
    structure: async ({ center, mode }) => {
      compositions += 1;
      const observed = fact;
      if (observed === 1) {
        settlementEntered.resolve();
        await settlementGate.promise;
      }
      return {
        composition: { center, direction: mode },
        readingFrontier: observed < 2 ? ['B'] : [],
        marker: `lines:${observed}`,
      };
    },
    refine: () => [
      {
        key: 'first',
        run: async () => {
          await first.promise;
          fact = 1;
        },
      },
      {
        key: 'second',
        run: async () => {
          await second.promise;
          fact = 2;
        },
      },
    ],
    presenter: {
      start(view) { publications.push(view); },
      update(view) { publications.push(view); },
    },
  });

  await controller.start();
  await flush(16);
  publications.length = 0;

  first.resolve();
  await settlementEntered.promise;

  second.resolve();
  await flush(8);
  settlementGate.resolve();
  await flush(48);

  assert.equal(controller.snapshot.structure.value.marker, 'lines:2');
  assert.equal(controller.snapshot.settling, false);
  assert.ok(compositions >= 3);

  const intermediate = publications.filter(({ structure }) => structure.value?.marker === 'lines:1');
  assert.ok(intermediate.length > 0);
  assert.ok(intermediate.every(({ settling }) => settling === false));
  assert.ok(publications.some(({ structure, settling }) => structure.value?.marker === 'lines:2' && settling === false));
});

test('accepted unchanged recomposition discharges supplementary completion without redundant publication', async () => {
  const work = deferred();
  const publications = [];
  let compositions = 0;

  const controller = new CurrentViewController({
    initial: { center: 'A', view: 'lines' },
    canonicalize: (value) => String(value),
    structure: async ({ center, mode }) => {
      compositions += 1;
      return {
        composition: { center, direction: mode },
        readingFrontier: [],
        marker: `${mode}:stable`,
      };
    },
    refine: () => [{ key: 'supplementary', run: () => work.promise }],
    presenter: {
      start(view) { publications.push(view); },
      update(view) { publications.push(view); },
    },
  });

  await controller.start();
  await flush(16);
  const publishedBefore = publications.length;
  const composedBefore = compositions;

  work.resolve();
  await flush(40);

  assert.ok(compositions > composedBefore);
  assert.equal(controller.snapshot.structure.value.marker, 'lines:stable');
  assert.equal(controller.snapshot.settling, false);
  assert.equal(publications.length, publishedBefore);
});
