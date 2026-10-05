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

test('presentation geometry derives capacity from the actual map rectangle', () => {
  const wide = derivePresentationGeometry({ width: 1200, height: 760, rootContext: false });
  const constrained = derivePresentationGeometry({ width: 500, height: 760, rootContext: false });
  assert.ok(wide.lineCapacity > constrained.lineCapacity);
  assert.equal(wide.rootCapacity, 0);
  assert.ok(wide.lineSlots.every((slot) => inside(slot, wide.width, wide.height)));
  assert.ok(constrained.lineSlots.every((slot) => inside(slot, constrained.width, constrained.height)));
});

test('Root context reallocates map space instead of preserving the Line-only geometry', () => {
  const lines = derivePresentationGeometry({ width: 1000, height: 700, rootContext: false });
  const context = derivePresentationGeometry({ width: 1000, height: 700, rootContext: true });
  assert.equal(lines.rootCapacity, 0);
  assert.ok(context.rootCapacity > 0);
  assert.ok(context.center.x > lines.center.x);
  assert.ok(context.lineCapacity <= lines.lineCapacity);
  assert.ok(context.rootSlots.every((slot) => slot.x < context.center.x));
  assert.ok(context.lineSlots.every((slot) => slot.x > context.center.x));
});

test('presentation geometry exposes exactly the three current size roles', () => {
  const geometry = derivePresentationGeometry({ width: 1100, height: 720, rootContext: true });
  assert.ok(geometry.center.size > geometry.prominentSize);
  assert.ok(geometry.prominentSize > geometry.compactSize);
  assert.ok(geometry.prominentLineCapacity > 0);
  assert.ok(geometry.lineSlots.some((slot) => slot.tier === 'compact'));
  assert.ok(geometry.rootSlots.every((slot) => slot.tier === 'compact'));
});

test('Line placement follows accepted relationships and converges transpositions on one board', () => {
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

  const e4 = placement.get('e4');
  const d4 = placement.get('d4');
  const e4Next = placement.get('e4-next');
  const d4Next = placement.get('d4-next');
  const shared = placement.get('shared');
  assert.ok(e4 && d4 && e4Next && d4Next && shared);
  assert.equal(e4.tier, 'prominent');
  assert.equal(d4.tier, 'prominent');
  assert.ok(e4Next.x > e4.x);
  assert.ok(d4Next.x > d4.x);
  assert.ok(shared.x > Math.max(e4Next.x, d4Next.x));
  assert.ok(shared.y >= Math.min(e4Next.y, d4Next.y));
  assert.ok(shared.y <= Math.max(e4Next.y, d4Next.y));
});

test('Line family anchors keep deliberate vertical breathing room', () => {
  const geometry = derivePresentationGeometry({ width: 1200, height: 760, rootContext: false });
  const topology = {
    center: 'center',
    nodes: ['e4', 'd4', 'nf3', 'c4'].map((key) => ({
      key,
      relation: 'outgoing',
      distance: 1,
      families: [key],
    })),
    relationships: ['e4', 'd4', 'nf3', 'c4'].map((target) => ({ source: 'center', target, families: [target] })),
  };
  const placement = placeConstellation(geometry, topology);
  const ys = topology.nodes.map(({ key }) => placement.get(key)?.y).filter(Number.isFinite).sort((a, b) => a - b);
  assert.equal(ys.length, 4);
  for (let index = 1; index < ys.length; index += 1) assert.ok(ys[index] - ys[index - 1] >= 120);
});

test('unused prominent cells can present accepted descendants at compact size', () => {
  const geometry = derivePresentationGeometry({ width: 1200, height: 760, rootContext: false });
  const count = Math.min(geometry.lineCapacity, 10);
  const nodes = [{ key: 'anchor', relation: 'outgoing', distance: 1, families: ['family'] }];
  const relationships = [{ source: 'center', target: 'anchor', families: ['family'] }];
  for (let index = 1; index < count; index += 1) {
    nodes.push({ key: `child-${index}`, relation: 'descendant', distance: 2, families: ['family'] });
    relationships.push({ source: 'anchor', target: `child-${index}`, families: ['family'] });
  }
  const placement = placeConstellation(geometry, { center: 'center', nodes, relationships });
  assert.equal(placement.size, nodes.length);
  assert.equal(placement.get('anchor')?.tier, 'prominent');
  assert.ok(nodes.slice(1).every(({ key }) => placement.get(key)?.tier === 'compact'));
});

test('Root placement keeps Roots upstream and their sibling continuations downstream', () => {
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
  for (const [rootKey, siblingKey] of [['root-a', 'sib-a'], ['root-b', 'sib-b']]) {
    const root = placement.get(rootKey);
    const sibling = placement.get(siblingKey);
    assert.ok(root && sibling);
    assert.ok(root.x < sibling.x);
    assert.ok(sibling.x < geometry.center.x);
    assert.ok(Math.abs(root.y - sibling.y) <= 160);
  }
});

test('topology placement keeps every assigned board rectangle distinct', () => {
  const geometry = derivePresentationGeometry({ width: 1500, height: 800, rootContext: true });
  const topology = {
    center: 'center',
    nodes: [
      { key: 'e4', relation: 'outgoing', distance: 1, families: ['e4'] },
      { key: 'd4', relation: 'outgoing', distance: 1, families: ['d4'] },
      { key: 'e5', relation: 'descendant', distance: 2, families: ['e4'] },
      { key: 'd5', relation: 'descendant', distance: 2, families: ['d4'] },
      { key: 'root-a', relation: 'root', distance: 1, families: ['a'] },
      { key: 'root-b', relation: 'root', distance: 1, families: ['b'] },
      { key: 'sib-a', relation: 'sibling', distance: 1, families: ['a'] },
      { key: 'sib-b', relation: 'sibling', distance: 1, families: ['b'] },
    ],
    relationships: [
      { source: 'center', target: 'e4' },
      { source: 'center', target: 'd4' },
      { source: 'e4', target: 'e5' },
      { source: 'd4', target: 'd5' },
      { source: 'root-a', target: 'center' },
      { source: 'root-b', target: 'center' },
      { source: 'root-a', target: 'sib-a' },
      { source: 'root-b', target: 'sib-b' },
    ],
  };
  const slots = [...placeConstellation(geometry, topology).values()];
  for (let left = 0; left < slots.length; left += 1) {
    assert.ok(inside(slots[left], geometry.width, geometry.height));
    for (let right = left + 1; right < slots.length; right += 1) {
      assert.equal(overlaps(slots[left], slots[right]), false);
    }
  }
});
