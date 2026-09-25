import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseRootNeighborhood } from '../src/graph.js';

function edge(source, target, uci, games = 0) {
  return { source, target, uci, san: uci, games, share: 0.1 };
}

test('Roots expands breadth-first from known incoming positions', () => {
  const incomingByTarget = new Map([
    ['center', [edge('a', 'center', 'a1a2', 100), edge('b', 'center', 'b1b2', 80)]],
    ['a', [edge('aa', 'a', 'a2a3', 70)]],
    ['b', [edge('bb', 'b', 'b2b3', 60)]],
  ]);

  const selected = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 4 });
  assert.deepEqual(selected.map((item) => item.key), ['a', 'b', 'aa', 'bb']);
  assert.deepEqual(selected.map((item) => item.distance), [1, 1, 2, 2]);
  assert.ok(selected.every((item) => item.relation === 'root'));
});

test('Roots merges a transposed ancestor instead of rendering it twice', () => {
  const incomingByTarget = new Map([
    ['center', [edge('a', 'center', 'a1a2'), edge('b', 'center', 'b1b2')]],
    ['a', [edge('shared', 'a', 'c1c2')]],
    ['b', [edge('shared', 'b', 'c1c2')]],
  ]);

  const selected = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 8 });
  assert.deepEqual(selected.map((item) => item.key), ['a', 'b', 'shared']);
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
