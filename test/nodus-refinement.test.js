import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveNodusRefinementDemand,
  nodusRefinementPriority,
} from '../src/nodus-refinement.js';

function target(items, position) {
  return items.find((item) => item.position === position);
}

test('Nodus derives refinement demand while preserving Constellation structural Reading admission', () => {
  const demand = deriveNodusRefinementDemand({
    center: 'A',
    structures: {
      roots: {
        readingFrontier: ['A', 'B'],
        composition: {
          nodes: [{ key: 'B' }, { key: 'C' }],
          relationships: [{ edge: { source: 'C', target: 'D' } }],
        },
      },
      lines: {
        readingFrontier: ['E'],
        composition: {
          nodes: [{ key: 'A' }],
          relationships: [{ edge: { source: 'F', target: 'G' } }],
        },
      },
    },
  });

  assert.equal(demand.rootTransposition, 'A');

  const center = target(demand.explorer, 'A');
  assert.deepEqual(center?.modes, ['roots', 'lines']);
  assert.deepEqual(center?.structuralModes, ['roots']);
  assert.equal(center?.nodusWide, true);

  const frontier = target(demand.explorer, 'B');
  assert.deepEqual(frontier?.modes, ['roots']);
  assert.deepEqual(frontier?.structuralModes, ['roots']);

  const visibleOnly = target(demand.explorer, 'C');
  assert.deepEqual(visibleOnly?.modes, ['roots']);
  assert.deepEqual(visibleOnly?.structuralModes, []);

  const lineFrontier = target(demand.explorer, 'E');
  assert.deepEqual(lineFrontier?.structuralModes, ['lines']);

  assert.deepEqual(target(demand.cloudEval, 'D')?.modes, ['roots']);
  assert.deepEqual(target(demand.masters, 'F')?.modes, ['lines']);
  assert.equal(target(demand.cloudEval, 'A')?.nodusWide, true);
  assert.equal(target(demand.masters, 'A')?.nodusWide, true);

  assert.equal(Object.hasOwn(target(demand.cloudEval, 'D') ?? {}, 'structuralModes'), false);
  assert.equal(Object.hasOwn(target(demand.masters, 'F') ?? {}, 'structuralModes'), false);
  assert.ok(Object.isFrozen(demand));
  assert.ok(Object.isFrozen(demand.explorer));
});

test('Nodus demand priority follows the live active projection while Nodus-wide demand stays foreground', () => {
  const demand = deriveNodusRefinementDemand({
    center: 'A',
    structures: {
      roots: {
        composition: {
          nodes: [{ key: 'B' }],
          relationships: [],
        },
      },
      lines: null,
    },
  });

  const center = target(demand.explorer, 'A');
  const roots = target(demand.explorer, 'B');
  assert.ok(center);
  assert.ok(roots);

  assert.equal(nodusRefinementPriority(center, 'lines'), 'foreground');
  assert.equal(nodusRefinementPriority(roots, 'roots'), 'foreground');
  assert.equal(nodusRefinementPriority(roots, 'lines'), 'background');
});
