import assert from 'node:assert/strict';
import test from 'node:test';
import {
  derivePresentationGeometry,
  placeConstellation,
} from '../src/presentation-geometry.js';

function inside(slot, width, height) {
  return slot.x - slot.size / 2 >= 0 && slot.x + slot.size / 2 <= width
    && slot.y - slot.size / 2 >= 0 && slot.y + slot.size / 2 <= height;
}

function overlaps(a, b) {
  return Math.abs(a.x - b.x) < (a.size + b.size) / 2
    && Math.abs(a.y - b.y) < (a.size + b.size) / 2;
}

function assertDistinctInside(geometry, placement) {
  const slots = [...placement.values()];
  for (let left = 0; left < slots.length; left += 1) {
    assert.ok(inside(slots[left], geometry.width, geometry.height));
    for (let right = left + 1; right < slots.length; right += 1) {
      assert.equal(overlaps(slots[left], slots[right]), false);
    }
  }
}

test('presentation geometry exposes regions and space-derived capacities rather than slots', () => {
  const wide = derivePresentationGeometry({ width: 1200, height: 760, rootContext: false });
  const constrained = derivePresentationGeometry({ width: 500, height: 760, rootContext: false });
  assert.ok(wide.lineCapacity > constrained.lineCapacity);
  assert.equal(wide.rootCapacity, 0);
  assert.ok(wide.lineRegion.left > wide.center.x + wide.center.size / 2);
  assert.ok(wide.lineRegion.right <= wide.width);
  assert.equal('lineSlots' in wide, false);
  assert.equal('rootSlots' in wide, false);
});

test('Root context reallocates geometry into explicit upstream and downstream regions', () => {
  const lines = derivePresentationGeometry({ width: 1000, height: 700, rootContext: false });
  const context = derivePresentationGeometry({ width: 1000, height: 700, rootContext: true });
  assert.equal(lines.rootCapacity, 0);
  assert.ok(context.rootCapacity > 0);
  assert.ok(context.rootRegion);
  assert.ok(context.rootRegion.right < context.center.x - context.center.size / 2);
  assert.ok(context.lineRegion.left > context.center.x + context.center.size / 2);
  assert.ok(context.center.x > lines.center.x);
  assert.ok(context.lineCapacity <= lines.lineCapacity);
});

test('space-derived capacity is not capped by the retired fixed total-board ceilings', () => {
  const geometry = derivePresentationGeometry({ width: 2200, height: 1200, rootContext: true });
  assert.ok(geometry.lineCapacity > 16);
  assert.ok(geometry.rootCapacity > 6);
});

test('presentation geometry keeps exactly the three current board-size roles', () => {
  const geometry = derivePresentationGeometry({ width: 1100, height: 720, rootContext: true });
  assert.ok(geometry.center.size > geometry.prominentSize);
  assert.ok(geometry.prominentSize > geometry.compactSize);
});

test('Line placement follows topology and keeps a transposition as one downstream board', () => {
  const geometry = derivePresentationGeometry({ width: 1500, height: 760, rootContext: false });
  const topology = {
    center: 'center',
    nodes: [
      { key: 'e4', relation: 'outgoing', distance: 1, families: ['e4'] },
      { key: 'd4', relation: 'outgoing', distance: 1, families: ['d4'] },
      { key: 'e4-next', relation: 'descendant', distance: 2, families: ['e4'] },
      { key: 'd4-next', relation: 'descendant', distance: 2, families: ['d4'] },
      { key: 'shared', relation: 'descendant', distance: 3, families: ['e4', 'd4'] },
    ],
    relationships: [
      { source: 'center', target: 'e4', families: ['e4'] },
      { source: 'center', target: 'd4', families: ['d4'] },
      { source: 'e4', target: 'e4-next', families: ['e4'] },
      { source: 'd4', target: 'd4-next', families: ['d4'] },
      { source: 'e4-next', target: 'shared', families: ['e4'] },
      { source: 'd4-next', target: 'shared', families: ['d4'] },
    ],
  };
  const placement = placeConstellation(geometry, topology);
  assert.equal(placement.size, topology.nodes.length);
  assertDistinctInside(geometry, placement);

  const e4 = placement.get('e4');
  const d4 = placement.get('d4');
  const e4Next = placement.get('e4-next');
  const d4Next = placement.get('d4-next');
  const shared = placement.get('shared');
  assert.ok(e4 && d4 && e4Next && d4Next && shared);
  assert.equal(e4.tier, 'prominent');
  assert.equal(d4.tier, 'prominent');
  assert.ok(e4Next.x >= e4.x);
  assert.ok(d4Next.x >= d4.x);
  assert.ok(shared.x >= Math.max(e4Next.x, d4Next.x));
  assert.ok(shared.y >= Math.min(e4Next.y, d4Next.y));
  assert.ok(shared.y <= Math.max(e4Next.y, d4Next.y));
});

test('a forcing Line can consume the advertised capacity without reversing direction', () => {
  const geometry = derivePresentationGeometry({ width: 1200, height: 760, rootContext: false });
  const nodes = [];
  const relationships = [];
  let previous = 'center';
  for (let index = 0; index < geometry.lineCapacity; index += 1) {
    const key = 'line-' + (index + 1);
    nodes.push({
      key,
      relation: index === 0 ? 'outgoing' : 'descendant',
      distance: index + 1,
      families: ['line'],
    });
    relationships.push({ source: previous, target: key, families: ['line'] });
    previous = key;
  }
  const placement = placeConstellation(geometry, { center: 'center', nodes, relationships });
  assert.equal(placement.size, geometry.lineCapacity);
  assertDistinctInside(geometry, placement);
  for (let index = 1; index < nodes.length; index += 1) {
    const source = placement.get(nodes[index - 1].key);
    const target = placement.get(nodes[index].key);
    assert.ok(source && target);
    assert.ok(target.x >= source.x);
  }
});

test('Root placement keeps Roots upstream of sibling context and both left of the Nodus', () => {
  const geometry = derivePresentationGeometry({ width: 1400, height: 760, rootContext: true });
  const topology = {
    center: 'center',
    nodes: [
      { key: 'root-a', relation: 'root', distance: 1, families: ['a'] },
      { key: 'root-b', relation: 'root', distance: 1, families: ['b'] },
      { key: 'sib-a', relation: 'sibling', distance: 1, families: ['a'] },
      { key: 'sib-b', relation: 'sibling', distance: 1, families: ['b'] },
    ],
    relationships: [
      { source: 'root-a', target: 'center', families: ['a'] },
      { source: 'root-b', target: 'center', families: ['b'] },
      { source: 'root-a', target: 'sib-a', families: ['a'] },
      { source: 'root-b', target: 'sib-b', families: ['b'] },
    ],
  };
  const placement = placeConstellation(geometry, topology);
  assert.equal(placement.size, topology.nodes.length);
  assertDistinctInside(geometry, placement);
  for (const [rootKey, siblingKey] of [['root-a', 'sib-a'], ['root-b', 'sib-b']]) {
    const root = placement.get(rootKey);
    const sibling = placement.get(siblingKey);
    assert.ok(root && sibling);
    assert.ok(root.x <= sibling.x);
    assert.ok(sibling.x < geometry.center.x);
  }
});

test('placement fails closed instead of truncating accepted topology beyond advertised capacity', () => {
  const geometry = derivePresentationGeometry({ width: 500, height: 760, rootContext: false });
  const nodes = Array.from({ length: geometry.lineCapacity + 1 }, (_, index) => ({
    key: 'node-' + index,
    relation: index === 0 ? 'outgoing' : 'descendant',
    distance: index + 1,
    families: ['line'],
  }));
  assert.throws(() => placeConstellation(geometry, {
    center: 'center',
    nodes,
    relationships: nodes.slice(1).map((node, index) => ({
      source: nodes[index].key,
      target: node.key,
      families: ['line'],
    })),
  }), /exceeds line capacity/);
});
