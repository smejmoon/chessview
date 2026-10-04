import assert from 'node:assert/strict';
import test from 'node:test';
import { NodusController } from '../src/nodus-controller.js';

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
  const compositions = { roots: 0, lines: 0 };
  let roomy = false;
  let incorporated = false;
  let starts = 0;

  const controller = new NodusController({
    initial: { center: 'A', view: 'lines' },
    canonicalize: (value) => String(value),
    structure: async ({ center, mode }) => {
      compositions[mode] += 1;
      const readingFrontier = mode === 'lines' && roomy && !incorporated ? ['B'] : [];
      return {
        composition: {
          center,
          direction: mode,
          nodes: roomy ? [{ key: 'B' }] : [],
        },
        readingFrontier,
        settling: readingFrontier.length > 0,
        marker: `${mode}:${roomy}:${incorporated}`,
      };
    },
    refine: ({ structures }) => structures.lines?.readingFrontier?.includes('B')
      ? [{
          key: 'explorer:B',
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
  const before = { ...compositions };
  const publishedBefore = publications.length;

  roomy = true;
  await controller.recompose();
  await flush();

  assert.equal(starts, 1);
  assert.ok(compositions.lines > before.lines);
  assert.ok(compositions.roots > before.roots);
  assert.equal(controller.snapshot.structure.value.marker, 'lines:true:false');
  assert.equal(controller.snapshot.settling, true);
  assert.ok(publications.slice(publishedBefore).some(({ settling }) => settling === true));

  reading.resolve();
  await flush(40);

  assert.equal(starts, 1);
  assert.equal(controller.snapshot.structure.value.marker, 'lines:true:true');
  assert.equal(controller.snapshot.settling, false);
});

test('refinement completion after structure derivation keeps the intermediate replacement Settling and drains another pass', async () => {
  const first = deferred();
  const second = deferred();
  const evidenceGate = deferred();
  const evidenceEntered = deferred();
  const publications = [];
  let fact = 0;
  let lineCompositions = 0;

  const controller = new NodusController({
    initial: { center: 'A', view: 'lines' },
    canonicalize: (value) => String(value),
    structure: async ({ center, mode }) => {
      if (mode !== 'lines') return { composition: { center, direction: mode }, marker: `${mode}:${fact}`, settling: false };
      lineCompositions += 1;
      const observed = fact;
      return {
        composition: { center, direction: mode },
        marker: `lines:${observed}`,
        settling: observed < 2,
      };
    },
    evidence: async ({ mode, structure }) => {
      if (mode === 'lines' && structure.marker === 'lines:1') {
        evidenceEntered.resolve();
        await evidenceGate.promise;
      }
      return { marker: `evidence:${structure.marker}` };
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
  await evidenceEntered.promise;

  second.resolve();
  await flush(8);
  evidenceGate.resolve();
  await flush(48);

  assert.equal(controller.snapshot.structure.value.marker, 'lines:2');
  assert.equal(controller.snapshot.settling, false);
  assert.ok(lineCompositions >= 3);

  const intermediate = publications.filter(({ structure }) => structure.value?.marker === 'lines:1');
  assert.ok(intermediate.length > 0);
  assert.ok(intermediate.every(({ settling }) => settling === true));
  assert.ok(publications.some(({ structure, settling }) => structure.value?.marker === 'lines:2' && settling === false));
});

test('accepted unchanged recomposition discharges completion without redundant publication', async () => {
  const work = deferred();
  const publications = [];
  let lineCompositions = 0;

  const controller = new NodusController({
    initial: { center: 'A', view: 'lines' },
    canonicalize: (value) => String(value),
    structure: async ({ center, mode }) => {
      if (mode === 'lines') lineCompositions += 1;
      return {
        composition: { center, direction: mode },
        marker: `${mode}:stable`,
        settling: false,
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
  const composedBefore = lineCompositions;

  work.resolve();
  await flush(40);

  assert.ok(lineCompositions > composedBefore);
  assert.equal(controller.snapshot.structure.value.marker, 'lines:stable');
  assert.equal(controller.snapshot.settling, false);
  assert.equal(publications.length, publishedBefore);
});
