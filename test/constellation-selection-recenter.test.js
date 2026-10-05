import test from 'node:test';
import assert from 'node:assert/strict';

import { CurrentViewController } from '../src/current-view-controller.js';

test('Recenter rebuilds structure without carrying the previous Candidate set into the new Nodus', async () => {
  const inputs = [];
  const candidateSetsByCenter = new Map();
  const controller = new CurrentViewController({
    initial: { center: 'A', view: 'lines', orientation: 'white', navDepth: 0 },
    canonicalize: (value) => String(value).toUpperCase(),
    routeLedger: {
      push() {},
      replace() {},
      onRestore() { return () => {}; },
    },
    structure: async (input) => {
      inputs.push(input);
      const candidates = Object.freeze([{ edge: Object.freeze({ source: input.center, target: `${input.center}-next` }) }]);
      if (!candidateSetsByCenter.has(input.center)) candidateSetsByCenter.set(input.center, []);
      candidateSetsByCenter.get(input.center).push(candidates);
      return { composition: { nodes: candidates.map(({ edge }) => ({ key: edge.target })) } };
    },
    presenter: { start() {}, update() {} },
  });

  await controller.start();
  const firstCandidates = candidateSetsByCenter.get('A')?.[0];
  assert.ok(firstCandidates);

  assert.equal(await controller.recenter({ target: 'b' }), true);
  const secondCandidates = candidateSetsByCenter.get('B')?.[0];
  assert.ok(secondCandidates);

  assert.notEqual(secondCandidates, firstCandidates);
  assert.deepEqual(secondCandidates.map(({ edge }) => edge.source), ['B']);
  assert.ok(inputs.some(({ center }) => center === 'A'));
  assert.ok(inputs.some(({ center }) => center === 'B'));
  assert.ok(inputs.every((input) => Object.keys(input).sort().join(',') === 'center,mode,signal'));
});
