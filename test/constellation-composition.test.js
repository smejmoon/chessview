import test from 'node:test';
import assert from 'node:assert/strict';

import { composeLineNeighborhood, chooseLineNeighborhood } from '../src/visible-graph.js';

function edge(source, target, uci, share) {
  return { source, target, uci, share, qualifies: true };
}

test('broad Line composition lets useful depth compete with immediate siblings', () => {
  const outgoingBySource = new Map([
    ['center', [
      edge('center', 'a1', 'a', 0.4),
      edge('center', 'b1', 'b', 0.25),
      edge('center', 'c1', 'c', 0.15),
      edge('center', 'd1', 'd', 0.1),
      edge('center', 'e1', 'e', 0.06),
    ]],
    ['a1', [edge('a1', 'a2', 'a2', 0.7)]],
    ['b1', [edge('b1', 'b2', 'b2', 0.65)]],
  ]);

  const composition = chooseLineNeighborhood({ center: 'center', outgoingBySource, max: 4 });
  const immediate = composition.nodes.filter((node) => node.distance === 1);

  assert.equal(composition.nodes.length, 4);
  assert.ok(immediate.length > 1, 'meaningful first-level breadth is retained');
  assert.ok(immediate.length < composition.nodes.length, 'visible space is not exhausted by immediate siblings');
  assert.ok(composition.nodes.some((node) => node.distance > 1), 'useful branch depth competes for space');
  assert.equal(composition.nodes.some((node) => node.key === 'e1'), false, 'not every eligible sibling must be visible');
});

test('one structural agenda prefers a later family alternative over unrelated extra depth', () => {
  const outgoingBySource = new Map([
    ['center', [
      edge('center', 'a', 'a', 0.6),
      edge('center', 'b', 'b', 0.4),
    ]],
    ['a', [
      edge('a', 'a1', 'a1', 0.6),
      edge('a', 'a2', 'a2', 0.25),
      edge('a', 'a3', 'a3', 0.15),
    ]],
    ['b', [
      edge('b', 'b1', 'b1', 0.7),
      edge('b', 'bx', 'bx', 0.3),
    ]],
    ['b1', [edge('b1', 'b2', 'b2', 0.8)]],
  ]);

  const composition = chooseLineNeighborhood({ center: 'center', outgoingBySource, max: 6 });

  assert.deepEqual(composition.nodes.map((node) => node.key), ['a', 'b', 'a1', 'b1', 'a2', 'bx']);
  assert.equal(composition.nodes.some((node) => node.key === 'b2'), false);
});

test('a full Line composition can remain structurally unsettled when a selected Reading can still improve it', () => {
  const outgoingBySource = new Map([
    ['center', [
      edge('center', 'a1', 'a', 0.4),
      edge('center', 'b1', 'b', 0.3),
      edge('center', 'c1', 'c', 0.2),
      edge('center', 'd1', 'd', 0.1),
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
      edge('center', 'a1', 'a', 0.6),
      edge('center', 'b1', 'b', 0.4),
    ]],
    ['a1', [edge('a1', 'a2', 'a2', 0.8)]],
    ['b1', [edge('b1', 'b2', 'b2', 0.8)]],
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
      edge('center', 'a1', 'a', 0.6),
      edge('center', 'b1', 'b', 0.4),
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
