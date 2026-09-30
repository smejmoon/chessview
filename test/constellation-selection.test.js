import test from 'node:test';
import assert from 'node:assert/strict';

import {
  rankCrossSourceCandidates,
  rankSameSourceCandidates,
  selectionCandidate,
} from '../src/constellation-selection.js';
import {
  humanResultQuality,
  moveFrequency,
  rootRarityFromFrequency,
} from '../src/evidence-signals.js';
import { chooseRootNeighborhood } from '../src/visible-graph.js';

const SOURCE = '8/8/8/8/8/8/8/K6k w - -';

function explorer(moves) {
  const totals = moves.reduce((sum, move) => ({
    white: sum.white + (move.white ?? 0),
    draws: sum.draws + (move.draws ?? 0),
    black: sum.black + (move.black ?? 0),
  }), { white: 0, draws: 0, black: 0 });
  return { ...totals, moves };
}

test('Prevalence is evidence from the source Explorer snapshot, not an edge placeholder', () => {
  const data = explorer([
    { uci: 'a1a2', white: 30, draws: 10, black: 10 },
    { uci: 'a1b1', white: 20, draws: 10, black: 20 },
  ]);
  const edge = { source: SOURCE, target: 'target', uci: 'a1a2', share: 0, games: 0, derived: true };
  assert.deepEqual(moveFrequency(data, edge), { games: 50, sourceGames: 100, share: 0.5 });
  assert.equal(moveFrequency(data, { ...edge, uci: 'a1b2' }), null);
});

test('human result quality is favorable, unfavorable, or unknown from one source snapshot', () => {
  const data = explorer([
    { uci: 'a1a2', white: 700, draws: 100, black: 200 },
    { uci: 'a1b1', white: 520, draws: 100, black: 380 },
    { uci: 'a1b2', white: 60, draws: 20, black: 20 },
  ]);

  assert.equal(humanResultQuality(data, { uci: 'a1a2' }, SOURCE)?.quality, 'favorable');
  assert.equal(humanResultQuality(data, { uci: 'a1b1' }, SOURCE)?.quality, 'unfavorable');
  assert.equal(humanResultQuality(data, { uci: 'a1b2' }, SOURCE), null);
});

test('root rarity requires meaningful source evidence', () => {
  assert.equal(rootRarityFromFrequency({ games: 40, sourceGames: 1000, share: 0.04 }), 'rare');
  assert.equal(rootRarityFromFrequency({ games: 8, sourceGames: 1000, share: 0.008 }), 'very-rare');
  assert.equal(rootRarityFromFrequency({ games: 4, sourceGames: 80, share: 0.05 }), null);
});

test('automatic selection requires evidenced local Prevalence while manual edges remain explicit', () => {
  const edge = { source: SOURCE, target: 'a', uci: 'a1a2' };
  assert.equal(selectionCandidate({ edge }), null);
  assert.equal(selectionCandidate({ edge: { ...edge, manual: true } })?.automatic, false);
});

test('same-source Salience starts from Prevalence and lets clear evidence move a sibling one local place', () => {
  const commonNeutral = selectionCandidate({
    edge: { source: SOURCE, target: 'common-neutral', uci: 'a1a2' },
    frequency: { games: 500, sourceGames: 1000, share: 0.5 },
  });
  const commonBad = selectionCandidate({
    edge: { source: SOURCE, target: 'common-bad', uci: 'a1b1' },
    frequency: { games: 350, sourceGames: 1000, share: 0.35 },
    engineQuality: 'bad',
    humanResult: 'unfavorable',
  });
  const rareGood = selectionCandidate({
    edge: { source: SOURCE, target: 'rare-good', uci: 'a1b2' },
    frequency: { games: 40, sourceGames: 1000, share: 0.04 },
    engineQuality: 'strong',
  });

  const ranked = rankSameSourceCandidates([rareGood, commonBad, commonNeutral]);
  assert.deepEqual(ranked.map((item) => item.edge.target), ['common-neutral', 'rare-good', 'common-bad']);
  assert.deepEqual(ranked.map((item) => item.frequency.share), [0.5, 0.04, 0.35]);
  assert.deepEqual(ranked.map((item) => item.salience), [
    { order: 0, prevalenceOrder: 0, evidenceAdjustment: 0 },
    { order: 1, prevalenceOrder: 2, evidenceAdjustment: -1 },
    { order: 2, prevalenceOrder: 1, evidenceAdjustment: 1 },
  ]);
  assert.equal(commonBad.automatic, true, 'a frequent bad move remains eligible');
  assert.equal(rareGood.rescued, true);
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
    humanResult: 'unfavorable',
  });
  const rescued = selectionCandidate({
    edge: { source: 'source-b', target: 'target-b', uci: 'b' },
    frequency: { games: 10, sourceGames: 1000, share: 0.01 },
    humanResult: 'favorable',
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

  const composition = chooseRootNeighborhood({
    center,
    incomingByTarget: new Map([[center, [preferred, rawFrequencyLeader]]]),
    max: 1,
  });

  assert.deepEqual(composition.nodes.map((node) => node.key), ['preferred-source']);
  assert.deepEqual(composition.relationships.map((relationship) => relationship.source), ['preferred-source']);
});
