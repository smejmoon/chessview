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
      return {
        composition: {
          center,
          direction: mode,
          nodes: roomy ? [{ key: 'B' }] : [],
        },
        readingFrontier: mode === 'lines' && roomy && !incorporated ? ['B'] : [],
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
