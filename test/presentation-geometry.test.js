import assert from 'node:assert/strict';
import test from 'node:test';
import {
  derivePresentationGeometry,
  placeLineFamilies,
  placeRootFamilies,
} from '../src/presentation-geometry.js';

function inside(slot, width, height) {
  return slot.x - slot.size / 2 >= 0 && slot.x + slot.size / 2 <= width
    && slot.y - slot.size / 2 >= 0 && slot.y + slot.size / 2 <= height;
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
  assert.ok(geometry.center.size > Math.max(...geometry.lineSlots.map((slot) => slot.size)));
  assert.ok(geometry.prominentLineCapacity > 0);
  const prominent = geometry.lineSlots.filter((slot) => slot.tier === 'prominent');
  const compact = [...geometry.lineSlots, ...geometry.rootSlots].filter((slot) => slot.tier === 'compact');
  assert.ok(prominent.length > 0);
  assert.ok(compact.length > 0);
  assert.ok(Math.min(...prominent.map((slot) => slot.size)) > Math.max(...compact.map((slot) => slot.size)));
});

test('Line placement keeps descendants nearest their first-move family', () => {
  const geometry = derivePresentationGeometry({ width: 1200, height: 760, rootContext: false });
  const placement = placeLineFamilies(geometry, [
    { key: 'e4', family: 'e4', anchor: true },
    { key: 'd4', family: 'd4', anchor: true },
    { key: 'nf3', family: 'nf3', anchor: true },
    { key: 'e4-e5', family: 'e4' },
    { key: 'd4-d5', family: 'd4' },
    { key: 'nf3-d5', family: 'nf3' },
    { key: 'e4-nf6', family: 'e4' },
    { key: 'd4-nf6', family: 'd4' },
  ]);
  for (const [anchor, children] of [
    ['e4', ['e4-e5', 'e4-nf6']],
    ['d4', ['d4-d5', 'd4-nf6']],
    ['nf3', ['nf3-d5']],
  ]) {
    const anchorSlot = placement.get(anchor);
    assert.ok(anchorSlot);
    for (const child of children) {
      const childSlot = placement.get(child);
      assert.ok(childSlot);
      assert.ok(Math.abs(childSlot.y - anchorSlot.y) <= 160);
      assert.ok(childSlot.x > anchorSlot.x);
    }
  }
});

test('Line family anchors keep deliberate vertical breathing room', () => {
  const geometry = derivePresentationGeometry({ width: 1200, height: 760, rootContext: false });
  const placement = placeLineFamilies(geometry, [
    { key: 'e4', family: 'e4', anchor: true },
    { key: 'd4', family: 'd4', anchor: true },
    { key: 'nf3', family: 'nf3', anchor: true },
    { key: 'c4', family: 'c4', anchor: true },
  ]);
  const ys = ['e4', 'd4', 'nf3', 'c4'].map((key) => placement.get(key)?.y).filter(Number.isFinite).sort((a, b) => a - b);
  assert.equal(ys.length, 4);
  for (let index = 1; index < ys.length; index += 1) assert.ok(ys[index] - ys[index - 1] >= 120);
});

test('Root placement keeps siblings beside their Root family', () => {
  const geometry = derivePresentationGeometry({ width: 1200, height: 760, rootContext: true });
  const placement = placeRootFamilies(geometry, [
    { key: 'root-a', family: 'a', anchor: true },
    { key: 'root-b', family: 'b', anchor: true },
    { key: 'sib-a-1', family: 'a' },
    { key: 'sib-b-1', family: 'b' },
    { key: 'sib-a-2', family: 'a' },
    { key: 'sib-b-2', family: 'b' },
  ]);
  for (const [anchor, children] of [
    ['root-a', ['sib-a-1', 'sib-a-2']],
    ['root-b', ['sib-b-1', 'sib-b-2']],
  ]) {
    const anchorSlot = placement.get(anchor);
    assert.ok(anchorSlot);
    for (const child of children) {
      const childSlot = placement.get(child);
      assert.ok(childSlot);
      assert.ok(Math.abs(childSlot.y - anchorSlot.y) <= 160);
      assert.ok(childSlot.x < anchorSlot.x);
    }
  }
});

test('Root family anchors keep deliberate vertical breathing room', () => {
  const geometry = derivePresentationGeometry({ width: 1200, height: 760, rootContext: true });
  const placement = placeRootFamilies(geometry, [
    { key: 'root-a', family: 'a', anchor: true },
    { key: 'root-b', family: 'b', anchor: true },
    { key: 'root-c', family: 'c', anchor: true },
  ]);
  const ys = ['root-a', 'root-b', 'root-c'].map((key) => placement.get(key)?.y).filter(Number.isFinite).sort((a, b) => a - b);
  assert.equal(ys.length, 3);
  for (let index = 1; index < ys.length; index += 1) assert.ok(ys[index] - ys[index - 1] >= 120);
});
