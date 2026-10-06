import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseLineNeighborhood, chooseRootNeighborhood } from '../src/visible-graph.js';
import { edgeStrokeWidth } from '../src/edge-visual.js';
import { visibleConnectors } from '../src/map-render.js';
function candidate(source, target, uci, share = 0.1) { const edge = { id: `${source}|${uci}|${target}`, source, target, uci, san: uci }; return { edge, frequency: { share }, automatic: true, rare: share < 0.05, positive: false, rescued: false, negative: false, omitFirst: false }; }

test('connector planning keeps every convergence relationship and weights edges by game count', () => {
  const outgoingBySource = new Map([['center', [candidate('center', 'a', 'line-a', 0.6), candidate('center', 'b', 'line-b', 0.25)]], ['a', [candidate('a', 'shared', 'a-shared', 0.7)]], ['b', [candidate('b', 'shared', 'b-shared', 0.8)]], ['shared', [candidate('shared', 'after', 'shared-after', 0.9)]]]);
  const composition = chooseLineNeighborhood({ center: 'center', outgoingBySource, max: 4 });
  const gamesByRelationship = new Map([
    ['center|line-a|a', 600],
    ['center|line-b|b', 250],
    ['a|a-shared|shared', 420],
    ['b|b-shared|shared', 180],
    ['shared|shared-after|after', 120],
  ]);
  const connectors = visibleConnectors(composition, { gamesByRelationship });
  assert.equal(composition.nodes.filter((node) => node.key === 'shared').length, 1);
  assert.deepEqual(connectors.filter((connector) => connector.target === 'shared').map((connector) => connector.relationshipId), ['a|a-shared|shared', 'b|b-shared|shared']);
  const immediateA = connectors.find((connector) => connector.relationshipId === 'center|line-a|a');
  const immediateB = connectors.find((connector) => connector.relationshipId === 'center|line-b|b');
  assert.equal(immediateA.strokeWidth, edgeStrokeWidth(600, 600));
  assert.equal(immediateB.strokeWidth, edgeStrokeWidth(250, 600));
  assert.ok(immediateA.strokeWidth > immediateB.strokeWidth);
  const sharedContinuation = connectors.filter((connector) => connector.relationshipId === 'shared|shared-after|after');
  assert.equal(sharedContinuation.length, 2);
  assert.deepEqual(sharedContinuation.map((connector) => connector.familyId), ['line-a', 'line-b']);
  assert.deepEqual(sharedContinuation.map((connector) => connector.strokeWidth), [edgeStrokeWidth(120, 600), edgeStrokeWidth(120, 600)]);
  assert.deepEqual(sharedContinuation.map((connector) => connector.games), [120, 120]);
  assert.deepEqual(sharedContinuation.map((connector) => connector.familyOffset), [-0.5, 0.5]);
});

test('connector planning preserves upstream graph direction and count weight', () => {
  const incomingByTarget = new Map([['center', [candidate('a', 'center', 'a1a2'), candidate('b', 'center', 'b1b2')]]]);
  const composition = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 2 });
  const gamesByRelationship = new Map([['a|a1a2|center', 800], ['b|b1b2|center', 200]]);
  const connectors = visibleConnectors(composition, { gamesByRelationship });
  assert.deepEqual(connectors.map(({ source, target }) => [source, target]), [['a', 'center'], ['b', 'center']]);
  assert.equal(connectors[0].strokeWidth, edgeStrokeWidth(800, 800));
  assert.equal(connectors[1].strokeWidth, edgeStrokeWidth(200, 800));
});

test('connector planning draws every relationship from one merged canonical board', () => {
  const incomingByTarget = new Map([['center', [candidate('a', 'center', 'a1a2'), candidate('b', 'center', 'b1b2')]], ['a', [candidate('shared', 'a', 'c1c2')]], ['b', [candidate('shared', 'b', 'c1c3')]]]);
  const composition = chooseRootNeighborhood({ center: 'center', incomingByTarget, max: 3 }); const connectors = visibleConnectors(composition); const fromShared = connectors.filter((connector) => connector.source === 'shared');
  assert.equal(composition.nodes.filter((node) => node.key === 'shared').length, 1); assert.equal(composition.nodes.find((node) => node.key === 'shared')?.merge, true);
  assert.deepEqual(fromShared.map((connector) => connector.target), ['a', 'b']); assert.ok(fromShared.every((connector) => connector.className.includes('edge-merge')));
});

test('connector planning weights upstream and downstream relationships on one visible game-count scale', () => {
  const line = chooseLineNeighborhood({ center: 'center', outgoingBySource: new Map([['center', [candidate('center', 'line', 'e2e4', 0.5)]]]), max: 1 });
  const root = chooseRootNeighborhood({ center: 'center', incomingByTarget: new Map([['center', [candidate('root', 'center', 'e7e5')]]]), max: 1 });
  const composition = { nodes: [...line.nodes, ...root.nodes], relationships: [...line.relationships, ...root.relationships], families: [...line.families, ...root.families] };
  const gamesByRelationship = new Map([['center|e2e4|line', 500], ['root|e7e5|center', 1000]]);
  const connectors = visibleConnectors(composition, { gamesByRelationship });
  const lineConnector = connectors.find((connector) => connector.source === 'center'); const rootConnector = connectors.find((connector) => connector.source === 'root');
  assert.equal(lineConnector.strokeWidth, edgeStrokeWidth(500, 1000));
  assert.equal(rootConnector.strokeWidth, edgeStrokeWidth(1000, 1000));
  assert.equal(rootConnector.target, 'center');
});
