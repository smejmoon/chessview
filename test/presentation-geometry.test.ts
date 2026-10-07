import assert from 'node:assert/strict';
import test from 'node:test';
import {
  derivePresentationGeometry,
  placeConstellation,
} from '../src/presentation-geometry.ts';

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

function xFor(key, topology, geometry, placement) {
  if (key === topology.center) return geometry.center.x;
  const point = placement.get(key);
  assert.ok(point, `missing placement for ${key}`);
  return point.x;
}

function assertRelationshipsDoNotReverse(topology, geometry, placement) {
  for (const relationship of topology.relationships) {
    assert.ok(
      xFor(relationship.target, topology, geometry, placement)
        >= xFor(relationship.source, topology, geometry, placement),
      `${relationship.source} -> ${relationship.target} reversed`,
    );
  }
}

test('presentation geometry exposes regions and space-derived capacities rather than slots', () => {
  const wide = derivePresentationGeometry({ width: 1200, height: 760, upstreamContext: false });
  const constrained = derivePresentationGeometry({ width: 500, height: 760, upstreamContext: false });
  assert.ok(wide.lineCapacity > constrained.lineCapacity);
  assert.equal(wide.rootCapacity, 0);
  assert.ok(wide.downstreamRegion.left > wide.center.x + wide.center.size / 2);
  assert.ok(wide.downstreamRegion.right <= wide.width);
  assert.equal('lineSlots' in wide, false);
  assert.equal('rootSlots' in wide, false);
  assert.equal('lineRegion' in wide, false);
  assert.equal('rootRegion' in wide, false);
});

test('upstream context reallocates geometry around the one Nodus', () => {
  const lines = derivePresentationGeometry({ width: 1000, height: 700, upstreamContext: false });
  const context = derivePresentationGeometry({ width: 1000, height: 700, upstreamContext: true });
  assert.equal(lines.rootCapacity, 0);
  assert.ok(context.rootCapacity > 0);
  assert.ok(context.upstreamRegion);
  assert.ok(context.upstreamRegion.right < context.center.x - context.center.size / 2);
  assert.ok(context.downstreamRegion.left > context.center.x + context.center.size / 2);
  assert.ok(context.center.x > lines.center.x);
  assert.ok(context.lineCapacity <= lines.lineCapacity);
});

test('space-derived capacity is not capped by retired fixed total-board ceilings', () => {
  const geometry = derivePresentationGeometry({ width: 2200, height: 1200, upstreamContext: true });
  assert.ok(geometry.lineCapacity > 16);
  assert.ok(geometry.rootCapacity > 6);
});

test('presentation geometry keeps exactly the three current board-size roles', () => {
  const geometry = derivePresentationGeometry({ width: 1100, height: 720, upstreamContext: true });
  assert.ok(geometry.center.size > geometry.prominentSize);
  assert.ok(geometry.prominentSize > geometry.compactSize);
});

test('one placement pass lays out upstream context, Lines, and convergence without reversing graph direction', () => {
  const geometry = derivePresentationGeometry({ width: 1500, height: 760, upstreamContext: true });
  const topology = {
    center: 'center',
    nodes: [
      { key: 'root-a', relation: 'root', distance: 1, families: ['root-a'] },
      { key: 'root-b', relation: 'root', distance: 1, families: ['root-b'] },
      { key: 'sib-a', relation: 'sibling', distance: 1, families: ['root-a'] },
      { key: 'e4', relation: 'outgoing', distance: 1, families: ['e4'] },
      { key: 'd4', relation: 'outgoing', distance: 1, families: ['d4'] },
      { key: 'e4-next', relation: 'descendant', distance: 2, families: ['e4'] },
      { key: 'd4-next', relation: 'descendant', distance: 2, families: ['d4'] },
      { key: 'shared', relation: 'descendant', distance: 3, families: ['e4', 'd4'] },
    ],
    relationships: [
      { source: 'root-a', target: 'center', families: ['root-a'] },
      { source: 'root-b', target: 'center', families: ['root-b'] },
      { source: 'root-a', target: 'sib-a', families: ['root-a'] },
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
  assertRelationshipsDoNotReverse(topology, geometry, placement);

  for (const key of ['root-a', 'root-b', 'sib-a']) {
    assert.ok(placement.get(key).x < geometry.center.x);
  }
  for (const key of ['e4', 'd4', 'e4-next', 'd4-next', 'shared']) {
    assert.ok(placement.get(key).x > geometry.center.x);
  }
  assert.equal(placement.get('e4').tier, 'prominent');
  assert.equal(placement.get('d4').tier, 'prominent');
  assert.ok(placement.get('shared').y >= Math.min(placement.get('e4-next').y, placement.get('d4-next').y));
  assert.ok(placement.get('shared').y <= Math.max(placement.get('e4-next').y, placement.get('d4-next').y));
});

test('a forcing Line can consume the advertised capacity without reversing direction', () => {
  const geometry = derivePresentationGeometry({ width: 1200, height: 760, upstreamContext: false });
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
  const topology = { center: 'center', nodes, relationships };
  const placement = placeConstellation(geometry, topology);
  assert.equal(placement.size, geometry.lineCapacity);
  assertDistinctInside(geometry, placement);
  assertRelationshipsDoNotReverse(topology, geometry, placement);
});

test('upstream capacity can be fully occupied without a separate Root placement path', () => {
  const geometry = derivePresentationGeometry({ width: 1400, height: 760, upstreamContext: true });
  const nodes = [];
  const relationships = [];
  for (let index = 0; index < geometry.rootCapacity; index += 1) {
    const key = 'root-' + index;
    nodes.push({ key, relation: 'root', distance: 1, families: [key] });
    relationships.push({ source: key, target: 'center', families: [key] });
  }
  const topology = { center: 'center', nodes, relationships };
  const placement = placeConstellation(geometry, topology);
  assert.equal(placement.size, geometry.rootCapacity);
  assertDistinctInside(geometry, placement);
  assertRelationshipsDoNotReverse(topology, geometry, placement);
  assert.ok([...placement.values()].every((point) => point.x < geometry.center.x));
});

test('placement fails closed instead of truncating accepted topology beyond advertised capacity', () => {
  const geometry = derivePresentationGeometry({ width: 500, height: 760, upstreamContext: false });
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
