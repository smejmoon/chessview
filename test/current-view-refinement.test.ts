import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveCurrentViewRefinementDemand } from '../src/current-view-refinement.ts';

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

  assert.equal(demand.rootDiscovery, 'A');
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
  assert.equal(emptyRoots.rootDiscovery, 'A');
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
  assert.equal(lines.rootDiscovery, null);
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
  assert.equal(roots.rootDiscovery, 'A');
  assert.equal(roots.rootTransposition, 'A');
});


test('Root discovery is nominated even before Root composition is established', () => {
  const roots = deriveCurrentViewRefinementDemand({ center: 'A', mode: 'roots', structure: null });
  const lines = deriveCurrentViewRefinementDemand({ center: 'A', mode: 'lines', structure: null });
  assert.equal(roots.rootDiscovery, 'A');
  assert.equal(roots.rootTransposition, null);
  assert.equal(lines.rootDiscovery, null);
});

test('duplicate positions preserve single-mode relevance, structural admission and center fallback', () => {
  const demand = deriveCurrentViewRefinementDemand({
    center: 'A',
    mode: 'lines',
    structure: {
      readingFrontier: ['B', 'B'],
      composition: {
        nodes: [{ key: 'B' }, { key: 'B' }],
        relationships: [
          { edge: { source: 'B', target: 'C' } },
          { edge: { source: 'B', target: 'C' } },
        ],
      },
    },
  });

  assert.deepEqual(demand.explorer.map(({ position }) => position), ['B', 'A']);
  assert.deepEqual(target(demand.explorer, 'B')?.modes, ['lines']);
  assert.deepEqual(target(demand.explorer, 'B')?.structuralModes, ['lines']);
  assert.deepEqual(target(demand.explorer, 'A')?.modes, []);
  assert.deepEqual(target(demand.explorer, 'A')?.structuralModes, []);
  assert.deepEqual(target(demand.cloudEval, 'A')?.modes, []);
  assert.deepEqual(target(demand.masters, 'A')?.modes, []);
  assert.deepEqual(target(demand.cloudEval, 'B')?.modes, ['lines']);
  assert.deepEqual(target(demand.cloudEval, 'C')?.modes, ['lines']);
  assert.deepEqual(demand.masters.map(({ position }) => position), ['B', 'A']);
  assert.ok(Object.isFrozen(target(demand.explorer, 'B')?.modes));
  assert.ok(Object.isFrozen(target(demand.explorer, 'B')?.structuralModes));
});
