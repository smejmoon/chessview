import test from 'node:test';
import assert from 'node:assert/strict';

import {
  rankCrossSourceCandidates,
  rankSameSourceCandidates,
  selectionCandidate,
} from '../src/constellation-selection.js';
import { chooseRootNeighborhood } from '../src/visible-graph.js';

const SOURCE = '8/8/8/8/8/8/8/K6k w - -';

test('automatic selection requires evidenced local Prevalence while explicit edges remain navigable', () => {
  const edge = { source: SOURCE, target: 'a', uci: 'a1a2' };
  assert.equal(selectionCandidate({ edge }), null);
  assert.equal(selectionCandidate({ edge: { ...edge, explicit: true } })?.automatic, false);
});

test('same-source Salience starts from Prevalence and lets clear evidence move a sibling one local place', () => {
  const commonNeutral = selectionCandidate({
    edge: { source: SOURCE, target: 'common-neutral', uci: 'a1a2' },
    frequency: { games: 500, sourceGames: 1000, share: 0.5 },
  });
  const commonBad = selectionCandidate({
    edge: { source: SOURCE, target: 'common-bad', uci: 'a1b1' },
    frequency: { games: 350, sourceGames: 1000, share: 0.35 },
    engineQuality: { quality: 'bad' },
    humanResult: { quality: 'unfavorable' },
  });
  const rareStrong = selectionCandidate({
    edge: { source: SOURCE, target: 'rare-strong', uci: 'a1b2' },
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
  assert.equal(commonBad.automatic, true, 'a frequent bad move remains eligible');
  assert.equal(rareStrong.rescued, true);
});

test('unknown same-source evidence leaves Salience in Prevalence order', () => {
  const lessPrevalent = selectionCandidate({
    edge: { source: SOURCE, target: 'less', uci: 'a1a2' },
    frequency: { games: 300, sourceGames: 1000, share: 0.3 },
  });
  const morePrevalent = selectionCandidate({
    edge: { source: SOURCE, target: 'more', uci: 'a1b1' },
    frequency: { games: 600, sourceGames: 1000, share: 0.6 },
  });

  const ranked = rankSameSourceCandidates([lessPrevalent, morePrevalent]);
  assert.deepEqual(ranked.map((item) => item.edge.target), ['more', 'less']);
  assert.deepEqual(ranked.map((item) => item.edge.salienceOrder), [0, 1]);
});

test('cross-source allocation omits known rare-negative candidates before rescued candidates', () => {
  const negative = selectionCandidate({
    edge: { source: 'source-a', target: 'target-a', uci: 'a' },
    frequency: { games: 20, sourceGames: 1000, share: 0.02 },
    humanResult: { quality: 'unfavorable' },
  });
  const rescued = selectionCandidate({
    edge: { source: 'source-b', target: 'target-b', uci: 'b' },
    frequency: { games: 10, sourceGames: 1000, share: 0.01 },
    humanResult: { quality: 'favorable' },
  });
  assert.deepEqual(rankCrossSourceCandidates([negative, rescued]).map((item) => item.edge.target), ['target-b', 'target-a']);
});

test('Root composition preserves supplied cross-source order instead of re-ranking local shares', () => {
  const center = 'center';
  const preferred = {
    source: 'preferred-source',
    target: center,
    uci: 'b',
    games: 10,
    share: 0.01,
    qualifies: true,
  };
  const rawFrequencyLeader = {
    source: 'raw-frequency-source',
    target: center,
    uci: 'a',
    games: 900,
    share: 0.9,
    qualifies: true,
  };

  const composition = chooseRootNeighborhood({ center, incomingByTarget: new Map([[center, [preferred, rawFrequencyLeader]]]), max: 1 });

  assert.deepEqual(composition.nodes.map((node) => node.key), ['preferred-source']);
  assert.deepEqual(composition.relationships.map((relationship) => relationship.source), ['preferred-source']);
});
