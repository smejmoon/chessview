import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseNeighborhood, chooseRootNeighborhood } from '../src/graph.js';
import { lineStrokeWidth } from '../src/edge-visual.js';
import { visibleConnectors } from '../src/map-render.js';

function rootEdge(source, target, uci, games = 0) {
  return { source, target, uci, san: uci, games, share: 0.1 };
}

test('Line connector planning keeps every convergence relationship and every family width', () => {
  const outgoingBySource = new Map([
    ['center', [
      { source: 'center', target: 'a', uci: 'line-a', share: 0.6, qualifies: true },
      { source: 'center', target: 'b', uci: 'line-b', share: 0.25, qualifies: true },
    ]],
    ['a', [{ source: 'a', target: 'shared', uci: 'a-shared', share: 0.7, qualifies: true }]],
    ['b', [{ source: 'b', target: 'shared', uci: 'b-shared', share: 0.8, qualifies: true }]],
    ['shared', [{ source: 'shared', target: 'after', uci: 'shared-after', share: 0.9, qualifies: true }]],
  ]);

  const composition = chooseNeighborhood({ center: 'center', outgoingBySource, max: 4 });
  const connectors = visibleConnectors(composition);

  assert.equal(composition.filter((node) => node.key === 'shared').length, 1);
  assert.deepEqual(
    connectors.filter((connector) => connector.target === 'shared').map((connector) => connector.relationshipId),
    ['a|a-shared|shared', 'b|b-shared|shared'],
  );

  const sharedContinuation = connectors.filter((connector) => connector.relationshipId === 'shared|shared-after|after');
  assert.equal(sharedContinuation.length, 2);
  assert.deepEqual(sharedContinuation.map((connector) => connector.familyId), ['line-a', 'line-b']);
  assert.deepEqual(
    sharedContinuation.map((connector) => connector.strokeWidth),
    [lineStrokeWidth(0.6), lineStrokeWidth(0.25)],
  );
  assert.deepEqual(sharedContinuation.map((connector) => connector.familyOffset), [-0.5, 0.5]);
});

test('Root connector planning draws every downstream relationship from one merged board', () => {
  const incomingByTarget = new Map([
    ['center', [rootEdge('a', 'center', 'a1a2'), rootEdge('b', 'center', 'b1b2')]],
    ['a', [rootEdge('shared', 'a', 'c1c2')]],
    ['b', [rootEdge('shared', 'b', 'c1c3')]],
  ]);

  const composition = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 3 });
  const connectors = visibleConnectors(composition);
  const fromShared = connectors.filter((connector) => connector.source === 'shared');

  assert.equal(composition.filter((node) => node.key === 'shared').length, 1);
  assert.equal(composition.find((node) => node.key === 'shared')?.merge, true);
  assert.deepEqual(fromShared.map((connector) => connector.target), ['a', 'b']);
  assert.ok(fromShared.every((connector) => connector.className.includes('edge-merge')));
});
