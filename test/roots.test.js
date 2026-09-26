import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseRootNeighborhood } from '../src/graph.js';

function edge(source, target, uci, games = 0) {
  return { source, target, uci, san: uci, games, share: 0.1 };
}

test('Roots gives each immediate family ancestry before returning to a bushy family', () => {
  const incomingByTarget = new Map([
    ['center', [edge('a', 'center', 'a1a2', 100), edge('b', 'center', 'b1b2', 80)]],
    ['a', [edge('aa', 'a', 'a2a3', 70), edge('ax', 'a', 'a2a4', 60)]],
    ['b', [edge('bb', 'b', 'b2b3', 50)]],
  ]);

  const selected = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 5 });
  assert.deepEqual(selected.map((item) => item.key), ['a', 'b', 'aa', 'bb', 'ax']);
  assert.deepEqual(selected.map((item) => item.distance), [1, 1, 2, 2, 2]);
  assert.ok(selected.every((item) => item.relation === 'root'));
});

test('Roots stays shallow-first inside each immediate family', () => {
  const incomingByTarget = new Map([
    ['center', [edge('a', 'center', 'a1a2', 100), edge('b', 'center', 'b1b2', 80)]],
    ['a', [edge('aa', 'a', 'a2a3', 70), edge('ax', 'a', 'a2a4', 60)]],
    ['aa', [edge('aaa', 'aa', 'a3a4', 50)]],
    ['b', [edge('bb', 'b', 'b2b3', 40)]],
  ]);

  const selected = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 6 });
  assert.deepEqual(selected.map((item) => item.key), ['a', 'b', 'aa', 'bb', 'ax', 'aaa']);
});

test('Roots merges a transposed ancestor and keeps every visible downstream edge', () => {
  const incomingByTarget = new Map([
    ['center', [edge('a', 'center', 'a1a2'), edge('b', 'center', 'b1b2')]],
    ['a', [edge('shared', 'a', 'c1c2')]],
    ['b', [edge('shared', 'b', 'c1c3')]],
  ]);

  const selected = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 8 });
  assert.deepEqual(selected.map((item) => item.key), ['a', 'b', 'shared']);

  const shared = selected.find((item) => item.key === 'shared');
  assert.deepEqual(shared.branches, ['a', 'b']);
  assert.deepEqual(shared.edges.map((item) => item.target), ['a', 'b']);
  assert.equal(shared.merge, true);
});

test('Roots keep zero-cost convergence relationships when the board budget is full', () => {
  const incomingByTarget = new Map([
    ['center', [edge('a', 'center', 'a1a2'), edge('b', 'center', 'b1b2')]],
    ['a', [edge('shared', 'a', 'c1c2')]],
    ['b', [edge('shared', 'b', 'c1c3')]],
  ]);

  const selected = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 3 });
  assert.deepEqual(selected.map((item) => item.key), ['a', 'b', 'shared']);

  const shared = selected.find((item) => item.key === 'shared');
  assert.deepEqual(shared.branches, ['a', 'b']);
  assert.deepEqual(shared.edges.map((item) => item.target), ['a', 'b']);
  assert.equal(selected.length, 3);
});

test('ancestry above a transposition inherits all converged Root families', () => {
  const incomingByTarget = new Map([
    ['center', [edge('a', 'center', 'a1a2'), edge('b', 'center', 'b1b2')]],
    ['a', [edge('shared', 'a', 'c1c2')]],
    ['b', [edge('shared', 'b', 'c1c3')]],
    ['shared', [edge('upstream', 'shared', 'd1d2')]],
  ]);

  const selected = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 4 });
  assert.deepEqual(selected.map((item) => item.key), ['a', 'b', 'shared', 'upstream']);
  assert.deepEqual(selected.find((item) => item.key === 'upstream').branches, ['a', 'b']);
});

test('Roots selection is deterministic and respects its visible budget', () => {
  const incomingByTarget = new Map([
    ['center', [edge('b', 'center', 'b1b2', 10), edge('a', 'center', 'a1a2', 10), edge('c', 'center', 'c1c2', 5)]],
  ]);
  const first = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 2 });
  const second = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 2 });
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((item) => item.key), ['a', 'b']);
});
