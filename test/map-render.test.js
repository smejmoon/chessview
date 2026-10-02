import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseLineNeighborhood, chooseRootNeighborhood } from '../src/visible-graph.js';
import { lineStrokeWidth } from '../src/edge-visual.js';
import { visibleConnectors } from '../src/map-render.js';

function candidate(source, target, uci, share = 0.1) {
  const edge = { id: `${source}|${uci}|${target}`, source, target, uci, san: uci };
  return { edge, frequency: { share }, automatic: true, rare: share < 0.05, positive: false, rescued: false, negative: false, omitFirst: false };
}

test('Line connector planning keeps every convergence relationship and every family width', () => {
  const outgoingBySource = new Map([
    ['center', [candidate('center', 'a', 'line-a', 0.6), candidate('center', 'b', 'line-b', 0.25)]],
    ['a', [candidate('a', 'shared', 'a-shared', 0.7)]],
    ['b', [candidate('b', 'shared', 'b-shared', 0.8)]],
    ['shared', [candidate('shared', 'after', 'shared-after', 0.9)]],
  ]);

  const composition = chooseLineNeighborhood({ center: 'center', outgoingBySource, max: 4 });
  const connectors = visibleConnectors(composition, { direction: 'lines' });

  assert.equal(composition.nodes.filter((node) => node.key === 'shared').length, 1);
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

test('Root connector planning points every graph edge toward its target', () => {
  const incomingByTarget = new Map([
    ['center', [candidate('a', 'center', 'a1a2'), candidate('b', 'center', 'b1b2')]],
  ]);

  const composition = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 2 });
  const connectors = visibleConnectors(composition, { direction: 'roots' });

  assert.deepEqual(connectors.map(({ source, target }) => [source, target]), [
    ['a', 'center'],
    ['b', 'center'],
  ]);
});

test('Root connector planning draws every downstream relationship from one merged board', () => {
  const incomingByTarget = new Map([
    ['center', [candidate('a', 'center', 'a1a2'), candidate('b', 'center', 'b1b2')]],
    ['a', [candidate('shared', 'a', 'c1c2')]],
    ['b', [candidate('shared', 'b', 'c1c3')]],
  ]);

  const composition = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 3 });
  const connectors = visibleConnectors(composition, { direction: 'roots' });
  const fromShared = connectors.filter((connector) => connector.source === 'shared');

  assert.equal(composition.nodes.filter((node) => node.key === 'shared').length, 1);
  assert.equal(composition.nodes.find((node) => node.key === 'shared')?.merge, true);
  assert.deepEqual(fromShared.map((connector) => connector.target), ['a', 'b']);
  assert.ok(fromShared.every((connector) => connector.className.includes('edge-merge')));
});
