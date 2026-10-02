import test from 'node:test';
import assert from 'node:assert/strict';

import { composeLineNeighborhood, chooseLineNeighborhood } from '../src/visible-graph.js';

function candidate(source, target, uci, share, metadata = {}) {
  const edge = { id: `${source}|${uci}|${target}`, source, target, uci, san: uci, ...metadata };
  return {
    edge,
    frequency: share == null ? null : { share },
    automatic: !edge.explicit,
    rare: share != null && share < 0.05,
    positive: false,
    rescued: false,
    negative: false,
    omitFirst: false,
  };
}

test('broad Line composition lets useful depth compete with immediate siblings', () => {
  const outgoingBySource = new Map([
    ['center', [
      candidate('center', 'a1', 'a', 0.4),
      candidate('center', 'b1', 'b', 0.25),
      candidate('center', 'c1', 'c', 0.15),
      candidate('center', 'd1', 'd', 0.1),
      candidate('center', 'e1', 'e', 0.06),
    ]],
    ['a1', [candidate('a1', 'a2', 'a2', 0.7)]],
    ['b1', [candidate('b1', 'b2', 'b2', 0.65)]],
  ]);

  const composition = chooseLineNeighborhood({ center: 'center', outgoingBySource, max: 4 });
  const immediate = composition.nodes.filter((node) => node.distance === 1);

  assert.equal(composition.nodes.length, 4);
  assert.ok(immediate.length > 1, 'meaningful first-level breadth is retained');
  assert.ok(immediate.length < composition.nodes.length, 'visible space is not exhausted by immediate siblings');
  assert.ok(composition.nodes.some((node) => node.distance > 1), 'useful branch depth competes for space');
  assert.equal(composition.nodes.some((node) => node.key === 'e1'), false, 'not every selected sibling must be visible');
});

test('Line composition consumes supplied Candidate order while preserving Candidate-local Prevalence', () => {
  const salient = candidate('center', 'salient', 'b', 0.3);
  const popular = candidate('center', 'popular', 'a', 0.7);
  const composition = chooseLineNeighborhood({
    center: 'center',
    outgoingBySource: new Map([['center', [salient, popular]]]),
    max: 1,
  });

  assert.deepEqual(composition.nodes.map((node) => node.key), ['salient']);
  assert.equal(composition.relationships[0].edge, salient.edge);
  assert.equal(composition.families[0].lineShare, 0.3);
  assert.equal(Object.hasOwn(salient.edge, 'salienceOrder'), false);
  assert.equal(Object.hasOwn(salient.edge, 'share'), false);
});

test('selected rare Candidates survive composition without a second eligibility gate', () => {
  const rare = candidate('center', 'rare', 'r', 0.01);
  const composition = chooseLineNeighborhood({
    center: 'center',
    outgoingBySource: new Map([['center', [rare]]]),
    max: 1,
  });

  assert.deepEqual(composition.nodes.map((node) => node.key), ['rare']);
  assert.equal(composition.relationships[0].edge, rare.edge);
});

test('one structural agenda prefers a later family alternative over unrelated extra depth', () => {
  const outgoingBySource = new Map([
    ['center', [
      candidate('center', 'a', 'a', 0.6),
      candidate('center', 'b', 'b', 0.4),
    ]],
    ['a', [
      candidate('a', 'a1', 'a1', 0.6),
      candidate('a', 'a2', 'a2', 0.25),
      candidate('a', 'a3', 'a3', 0.15),
    ]],
    ['b', [
      candidate('b', 'b1', 'b1', 0.7),
      candidate('b', 'bx', 'bx', 0.3),
    ]],
    ['b1', [candidate('b1', 'b2', 'b2', 0.8)]],
  ]);

  const composition = chooseLineNeighborhood({ center: 'center', outgoingBySource, max: 6 });

  assert.deepEqual(composition.nodes.map((node) => node.key), ['a', 'b', 'a1', 'b1', 'a2', 'bx']);
  assert.equal(composition.nodes.some((node) => node.key === 'b2'), false);
});

test('a full Line composition can remain structurally unsettled when a selected Reading can still improve it', () => {
  const outgoingBySource = new Map([
    ['center', [
      candidate('center', 'a1', 'a', 0.4),
      candidate('center', 'b1', 'b', 0.3),
      candidate('center', 'c1', 'c', 0.2),
      candidate('center', 'd1', 'd', 0.1),
    ]],
  ]);
  const unresolvedReadings = new Set(['a1', 'b1', 'c1']);

  const plan = composeLineNeighborhood({
    center: 'center',
    outgoingBySource,
    unresolvedReadings,
    max: 3,
  });

  assert.equal(plan.composition.nodes.length, 3);
  assert.ok(plan.readingFrontier.length > 0);
  assert.ok(plan.readingFrontier.every((key) => plan.composition.nodes.some((node) => node.key === key)));
});

test('an uncached selected position leaves the Reading frontier when its best continuation cannot change the constrained composition', () => {
  const outgoingBySource = new Map([
    ['center', [
      candidate('center', 'a1', 'a', 0.6),
      candidate('center', 'b1', 'b', 0.4),
    ]],
    ['a1', [candidate('a1', 'a2', 'a2', 0.8)]],
    ['b1', [candidate('b1', 'b2', 'b2', 0.8)]],
  ]);
  const unresolvedReadings = new Set(['a2', 'b2']);

  const plan = composeLineNeighborhood({
    center: 'center',
    outgoingBySource,
    unresolvedReadings,
    max: 4,
  });

  assert.deepEqual(plan.composition.nodes.map((node) => node.key), ['a1', 'b1', 'a2', 'b2']);
  assert.deepEqual(plan.readingFrontier, []);
});

test('an unresolved selected position stays on the Reading frontier when it can reveal a zero-cost visible relationship', () => {
  const outgoingBySource = new Map([
    ['center', [
      candidate('center', 'a1', 'a', 0.6),
      candidate('center', 'b1', 'b', 0.4),
    ]],
  ]);

  const plan = composeLineNeighborhood({
    center: 'center',
    outgoingBySource,
    unresolvedReadings: new Set(['a1']),
    legalTargetsBySource: new Map([['a1', new Set(['b1'])]]),
    max: 2,
  });

  assert.deepEqual(plan.composition.nodes.map((node) => node.key), ['a1', 'b1']);
  assert.deepEqual(plan.readingFrontier, ['a1']);
});
