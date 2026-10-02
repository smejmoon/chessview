import test from 'node:test';
import assert from 'node:assert/strict';

import {
  rankCrossSourceCandidates,
  rankSameSourceCandidates,
  selectionCandidate,
} from '../src/constellation-selection.js';
import { chooseRootNeighborhood } from '../src/visible-graph.js';

const SOURCE = '8/8/8/8/8/8/8/K6k w - -';

function graphEdge(source, target, uci, metadata = {}) {
  return { id: `${source}|${uci}|${target}`, source, target, uci, san: uci, ...metadata };
}

test('Candidate admission requires evidenced local Prevalence even for explicit Graph Edges', () => {
  const ordinary = graphEdge(SOURCE, 'a', 'a1a2');
  const explicit = { ...ordinary, explicit: true };
  assert.equal(selectionCandidate({ edge: ordinary }), null);
  assert.equal(selectionCandidate({ edge: explicit }), null);
});

test('explicit Graph Edges with current Prevalence use ordinary Candidate evidence semantics', () => {
  const frequency = { games: 40, sourceGames: 1000, share: 0.04 };
  const ordinary = selectionCandidate({
    edge: graphEdge(SOURCE, 'ordinary', 'a1a2'),
    frequency,
    engineQuality: { quality: 'strong' },
  });
  const explicitEdge = graphEdge(SOURCE, 'explicit', 'a1b1', { explicit: true });
  const explicit = selectionCandidate({
    edge: explicitEdge,
    frequency,
    engineQuality: { quality: 'strong' },
  });

  assert.ok(ordinary);
  assert.ok(explicit);
  assert.equal(explicit.edge, explicitEdge);
  assert.equal(explicit.edge.explicit, true);
  assert.deepEqual(
    { rare: explicit.rare, positive: explicit.positive, rescued: explicit.rescued, negative: explicit.negative, omitFirst: explicit.omitFirst },
    { rare: ordinary.rare, positive: ordinary.positive, rescued: ordinary.rescued, negative: ordinary.negative, omitFirst: ordinary.omitFirst },
  );
});

test('same-source Salience starts from Prevalence and lets clear evidence move a sibling one local place', () => {
  const commonNeutral = selectionCandidate({
    edge: graphEdge(SOURCE, 'common-neutral', 'a1a2'),
    frequency: { games: 500, sourceGames: 1000, share: 0.5 },
  });
  const commonBad = selectionCandidate({
    edge: graphEdge(SOURCE, 'common-bad', 'a1b1'),
    frequency: { games: 350, sourceGames: 1000, share: 0.35 },
    engineQuality: { quality: 'bad' },
    humanResult: { quality: 'unfavorable' },
  });
  const rareStrong = selectionCandidate({
    edge: graphEdge(SOURCE, 'rare-strong', 'a1b2'),
    frequency: { games: 40, sourceGames: 1000, share: 0.04 },
    engineQuality: { quality: 'strong' },
  });

  const ranked = rankSameSourceCandidates([rareStrong, commonBad, commonNeutral]);
  assert.deepEqual(ranked.map((item) => item.edge.target), ['common-neutral', 'rare-strong', 'common-bad']);
  assert.deepEqual(ranked.map((item) => item.frequency.share), [0.5, 0.04, 0.35]);
  assert.deepEqual(ranked.map((item) => item.salience), [
    { order: 0, prevalenceOrder: 0, evidenceAdjustment: 0 },
    { order: 1, prevalenceOrder: 2, evidenceAdjustment: -1 },
    { order: 2, prevalenceOrder: 1, evidenceAdjustment: 1 },
  ]);
  assert.equal(rareStrong.rescued, true);
  assert.equal(ranked[0].edge, commonNeutral.edge);
  assert.equal(ranked[1].edge, rareStrong.edge);
  assert.equal(ranked[2].edge, commonBad.edge);
  assert.ok(ranked.every((item) => !Object.hasOwn(item.edge, 'salienceOrder')));
});

test('unknown same-source evidence leaves Salience in Prevalence order', () => {
  const lessPrevalent = selectionCandidate({
    edge: graphEdge(SOURCE, 'less', 'a1a2'),
    frequency: { games: 300, sourceGames: 1000, share: 0.3 },
  });
  const morePrevalent = selectionCandidate({
    edge: graphEdge(SOURCE, 'more', 'a1b1'),
    frequency: { games: 600, sourceGames: 1000, share: 0.6 },
  });

  const ranked = rankSameSourceCandidates([lessPrevalent, morePrevalent]);
  assert.deepEqual(ranked.map((item) => item.edge.target), ['more', 'less']);
  assert.deepEqual(ranked.map((item) => item.salience.order), [0, 1]);
});

test('cross-source allocation omits known rare-negative candidates before rescued candidates', () => {
  const negative = selectionCandidate({
    edge: graphEdge('source-a', 'target-a', 'a'),
    frequency: { games: 20, sourceGames: 1000, share: 0.02 },
    humanResult: { quality: 'unfavorable' },
  });
  const rescued = selectionCandidate({
    edge: graphEdge('source-b', 'target-b', 'b'),
    frequency: { games: 10, sourceGames: 1000, share: 0.01 },
    humanResult: { quality: 'favorable' },
  });
  assert.deepEqual(rankCrossSourceCandidates([negative, rescued]).map((item) => item.edge.target), ['target-b', 'target-a']);
});

test('Root composition preserves supplied cross-source Candidate order', () => {
  const center = 'center';
  const preferredEdge = graphEdge('preferred-source', center, 'b');
  const frequencyLeaderEdge = graphEdge('raw-frequency-source', center, 'a');
  const preferred = selectionCandidate({ edge: preferredEdge, frequency: { games: 10, share: 0.01 } });
  const rawFrequencyLeader = selectionCandidate({ edge: frequencyLeaderEdge, frequency: { games: 900, share: 0.9 } });

  const composition = chooseRootNeighborhood({
    center,
    incomingByTarget: new Map([[center, [preferred, rawFrequencyLeader]]]),
    max: 1,
  });

  assert.deepEqual(composition.nodes.map((node) => node.key), ['preferred-source']);
  assert.deepEqual(composition.relationships.map((relationship) => relationship.source), ['preferred-source']);
});
