import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseRootNeighborhood } from '../src/visible-graph.ts';

function candidate(source, target, uci, games = 0) {
  const edge = { id: `${source}|${uci}|${target}`, source, target, uci, san: uci };
  return { edge, frequency: { games, share: 0.1 }, automatic: true, rare: false, positive: false, rescued: false, negative: false, omitFirst: false };
}

test('Roots gives each immediate family ancestry before returning to a bushy family', () => {
  const incomingByTarget = new Map([
    ['center', [candidate('a', 'center', 'a1a2', 100), candidate('b', 'center', 'b1b2', 80)]],
    ['a', [candidate('aa', 'a', 'a2a3', 70), candidate('ax', 'a', 'a2a4', 60)]],
    ['b', [candidate('bb', 'b', 'b2b3', 50)]],
  ]);

  const selected = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 5 });
  assert.deepEqual(selected.nodes.map((item) => item.key), ['a', 'b', 'aa', 'bb', 'ax']);
  assert.deepEqual(selected.nodes.map((item) => item.distance), [1, 1, 2, 2, 2]);
  assert.ok(selected.nodes.every((item) => item.relation === 'root'));
  assert.equal(selected.nodes.find((item) => item.key === 'a')?.merge, false);
  assert.deepEqual(selected.nodes.find((item) => item.key === 'a')?.edges.map((item) => item.target), ['center']);
});

test('Roots stays shallow-first inside each immediate family', () => {
  const incomingByTarget = new Map([
    ['center', [candidate('a', 'center', 'a1a2', 100), candidate('b', 'center', 'b1b2', 80)]],
    ['a', [candidate('aa', 'a', 'a2a3', 70), candidate('ax', 'a', 'a2a4', 60)]],
    ['aa', [candidate('aaa', 'aa', 'a3a4', 50)]],
    ['b', [candidate('bb', 'b', 'b2b3', 40)]],
  ]);

  const selected = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 6 });
  assert.deepEqual(selected.nodes.map((item) => item.key), ['a', 'b', 'aa', 'bb', 'ax', 'aaa']);
});

test('Roots merges a transposed ancestor and keeps every visible downstream edge', () => {
  const incomingByTarget = new Map([
    ['center', [candidate('a', 'center', 'a1a2'), candidate('b', 'center', 'b1b2')]],
    ['a', [candidate('shared', 'a', 'c1c2')]],
    ['b', [candidate('shared', 'b', 'c1c3')]],
  ]);

  const selected = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 8 });
  assert.deepEqual(selected.nodes.map((item) => item.key), ['a', 'b', 'shared']);

  const shared = selected.nodes.find((item) => item.key === 'shared');
  assert.deepEqual(shared.branches, ['a', 'b']);
  assert.deepEqual(shared.edges.map((item) => item.target), ['a', 'b']);
  assert.equal(shared.merge, true);
});

test('Roots keep zero-cost convergence relationships when the board budget is full', () => {
  const incomingByTarget = new Map([
    ['center', [candidate('a', 'center', 'a1a2'), candidate('b', 'center', 'b1b2')]],
    ['a', [candidate('shared', 'a', 'c1c2')]],
    ['b', [candidate('shared', 'b', 'c1c3')]],
  ]);

  const selected = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 3 });
  assert.deepEqual(selected.nodes.map((item) => item.key), ['a', 'b', 'shared']);

  const shared = selected.nodes.find((item) => item.key === 'shared');
  assert.deepEqual(shared.branches, ['a', 'b']);
  assert.deepEqual(shared.edges.map((item) => item.target), ['a', 'b']);
  assert.equal(selected.nodes.length, 3);
});

test('ancestry above a transposition inherits all converged Root families', () => {
  const incomingByTarget = new Map([
    ['center', [candidate('a', 'center', 'a1a2'), candidate('b', 'center', 'b1b2')]],
    ['a', [candidate('shared', 'a', 'c1c2')]],
    ['b', [candidate('shared', 'b', 'c1c3')]],
    ['shared', [candidate('upstream', 'shared', 'd1d2')]],
  ]);

  const selected = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 4 });
  assert.deepEqual(selected.nodes.map((item) => item.key), ['a', 'b', 'shared', 'upstream']);
  const upstream = selected.nodes.find((item) => item.key === 'upstream');
  assert.deepEqual(upstream.branches, ['a', 'b']);
  assert.equal(upstream.merge, false);
  assert.deepEqual(upstream.edges.map((item) => item.target), ['shared']);
});

test('Roots selection is deterministic, preserves supplied order, and respects its visible budget', () => {
  const incomingByTarget = new Map([
    ['center', [candidate('b', 'center', 'b1b2', 10), candidate('a', 'center', 'a1a2', 10), candidate('c', 'center', 'c1c2', 5)]],
  ]);
  const first = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 2 });
  const second = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 2 });
  assert.deepEqual(first, second);
  assert.deepEqual(first.nodes.map((item) => item.key), ['b', 'a']);
});
