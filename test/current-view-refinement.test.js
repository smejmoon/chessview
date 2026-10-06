import assert from 'node:assert/strict';
import test from 'node:test';
import {
  currentViewRefinementPriority,
  deriveCurrentViewRefinementDemand,
} from '../src/current-view-refinement.js';

function target(items, position) {
  return items.find((item) => item.position === position);
}

test('Current View derives refinement demand from its one accepted Constellation', () => {
  const demand = deriveCurrentViewRefinementDemand({
    center: 'A',
    mode: 'roots',
    structure: {
      readingFrontier: ['A', 'B'],
      composition: {
        nodes: [{ key: 'B' }, { key: 'C' }, { key: 'E' }],
        relationships: [
          { edge: { source: 'C', target: 'D' } },
          { edge: { source: 'E', target: 'A' } },
        ],
      },
    },
  });

  assert.equal(demand.rootTransposition, 'A');

  const center = target(demand.explorer, 'A');
  assert.deepEqual(center?.modes, ['roots']);
  assert.deepEqual(center?.structuralModes, ['roots']);
  assert.equal(center?.nodusWide, true);

  const frontier = target(demand.explorer, 'B');
  assert.deepEqual(frontier?.modes, ['roots']);
  assert.deepEqual(frontier?.structuralModes, ['roots']);

  const visibleOnly = target(demand.explorer, 'C');
  assert.deepEqual(visibleOnly?.modes, ['roots']);
  assert.deepEqual(visibleOnly?.structuralModes, []);

  assert.deepEqual(target(demand.cloudEval, 'D')?.modes, ['roots']);
  assert.deepEqual(target(demand.masters, 'C')?.modes, ['roots']);
  assert.equal(target(demand.cloudEval, 'A')?.nodusWide, true);
  assert.equal(target(demand.masters, 'A')?.nodusWide, true);

  assert.equal(Object.hasOwn(target(demand.cloudEval, 'D') ?? {}, 'structuralModes'), false);
  assert.equal(Object.hasOwn(target(demand.masters, 'C') ?? {}, 'structuralModes'), false);
  assert.ok(Object.isFrozen(demand));
  assert.ok(Object.isFrozen(demand.explorer));
});

test('Root transposition demand waits for authoritative visible Root topology', () => {
  const emptyRoots = deriveCurrentViewRefinementDemand({
    center: 'A',
    mode: 'roots',
    structure: {
      composition: {
        nodes: [{ key: 'B' }],
        relationships: [],
      },
    },
  });
  assert.equal(emptyRoots.rootTransposition, null);

  const lines = deriveCurrentViewRefinementDemand({
    center: 'A',
    mode: 'lines',
    structure: {
      composition: {
        nodes: [{ key: 'C' }],
        relationships: [{ edge: { source: 'C', target: 'A' } }],
      },
    },
  });
  assert.equal(lines.rootTransposition, null);

  const roots = deriveCurrentViewRefinementDemand({
    center: 'A',
    mode: 'roots',
    structure: {
      composition: {
        nodes: [{ key: 'C' }],
        relationships: [{ edge: { source: 'C', target: 'A' } }],
      },
    },
  });
  assert.equal(roots.rootTransposition, 'A');
});

test('Current View demand priority follows active mode while Nodus-wide demand stays foreground', () => {
  const demand = deriveCurrentViewRefinementDemand({
    center: 'A',
    mode: 'roots',
    structure: {
      composition: {
        nodes: [{ key: 'B' }],
        relationships: [],
      },
    },
  });

  const center = target(demand.explorer, 'A');
  const roots = target(demand.explorer, 'B');
  assert.ok(center);
  assert.ok(roots);

  assert.equal(currentViewRefinementPriority(center, 'lines'), 'foreground');
  assert.equal(currentViewRefinementPriority(roots, 'roots'), 'foreground');
  assert.equal(currentViewRefinementPriority(roots, 'lines'), 'background');
});
