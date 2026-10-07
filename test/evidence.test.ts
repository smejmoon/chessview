import test from 'node:test';
import assert from 'node:assert/strict';

import {
  humanMismatch,
  humanResultQuality,
  moveEvaluation,
  moveFrequency,
  positionEvaluation,
  rootRarityFromFrequency,
} from '../src/evidence.ts';

const SOURCE = '8/8/8/8/8/8/8/K6k w - -';

function explorer(moves) {
  const totals = moves.reduce((sum, move) => ({
    white: sum.white + (move.white ?? 0),
    draws: sum.draws + (move.draws ?? 0),
    black: sum.black + (move.black ?? 0),
  }), { white: 0, draws: 0, black: 0 });
  return { ...totals, moves };
}

test('Prevalence comes from the source Explorer snapshot', () => {
  const data = explorer([
    { uci: 'a1a2', white: 30, draws: 10, black: 10 },
    { uci: 'a1b1', white: 20, draws: 10, black: 20 },
  ]);
  const edge = { source: SOURCE, target: 'target', uci: 'a1a2', share: 0, games: 0 };
  assert.deepEqual(moveFrequency(data, edge), { games: 50, sourceGames: 100, share: 0.5 });
  assert.equal(moveFrequency(data, { ...edge, uci: 'a1b2' }), null);
});

test('engine move quality uses the strong, dubious, bad grammar', () => {
  const sourceEval = {
    depth: 22,
    pvs: [
      { cp: 30, moves: 'a1a2' },
      { cp: 0, moves: 'a1b1' },
      { cp: -20, moves: 'a1b2' },
      { cp: -80, moves: 'a1b3' },
    ],
  };

  assert.deepEqual(moveEvaluation(SOURCE, { uci: 'a1b1' }, sourceEval), { lossCp: 30, quality: 'strong' });
  assert.deepEqual(moveEvaluation(SOURCE, { uci: 'a1b2' }, sourceEval), { lossCp: 50, quality: 'dubious' });
  assert.deepEqual(moveEvaluation(SOURCE, { uci: 'a1b3' }, sourceEval), { lossCp: 110, quality: 'bad' });
  assert.equal(moveEvaluation(SOURCE, { uci: 'a1b4' }, sourceEval), null);
});

test('move evaluation can use a provider-supplied child position eval', () => {
  const sourceEval = { depth: 22, pvs: [{ cp: 30, moves: 'a1a2' }] };
  const targetEval = { depth: 21, pvs: [{ cp: -40, moves: 'h1h2' }] };
  assert.deepEqual(
    moveEvaluation(SOURCE, { uci: 'a1b1' }, sourceEval, targetEval),
    { lossCp: 70, quality: 'dubious' },
  );
});

test('center evaluation exposes semantic numeric value without presentation formatting', () => {
  assert.deepEqual(
    positionEvaluation({ depth: 22, pvs: [{ cp: 35, moves: 'a1a2' }] }),
    { cp: 35, mate: null, depth: 22 },
  );
  assert.equal(positionEvaluation(null), null);
});

test('human result quality is favorable, unfavorable, or unavailable from one source snapshot', () => {
  const data = explorer([
    { uci: 'a1a2', white: 700, draws: 100, black: 200 },
    { uci: 'a1b1', white: 520, draws: 100, black: 380 },
    { uci: 'a1b2', white: 60, draws: 20, black: 20 },
  ]);

  assert.equal(humanResultQuality(data, { uci: 'a1a2' }, SOURCE)?.quality, 'favorable');
  assert.equal(humanResultQuality(data, { uci: 'a1b1' }, SOURCE)?.quality, 'unfavorable');
  assert.equal(humanResultQuality(data, { uci: 'a1b2' }, SOURCE), null);
});

test('human mismatch is silent on agreement and directional on disagreement', () => {
  const data = explorer([
    { uci: 'a1a2', white: 600, draws: 200, black: 200 },
    { uci: 'a1b1', white: 470, draws: 160, black: 370 },
  ]);
  const strong = { lossCp: 10, quality: 'strong' };
  const weak = { lossCp: 70, quality: 'dubious' };

  assert.equal(humanMismatch(data, { uci: 'a1a2' }, SOURCE, strong), null);
  assert.equal(humanMismatch(data, { uci: 'a1b1' }, SOURCE, strong)?.direction, 'down');
  assert.equal(humanMismatch(data, { uci: 'a1a2' }, SOURCE, weak)?.direction, 'up');
});

test('Root rarity requires meaningful local Prevalence evidence', () => {
  assert.equal(rootRarityFromFrequency({ games: 40, sourceGames: 1000, share: 0.04 }), 'rare');
  assert.equal(rootRarityFromFrequency({ games: 8, sourceGames: 1000, share: 0.008 }), 'very-rare');
  assert.equal(rootRarityFromFrequency({ games: 4, sourceGames: 80, share: 0.05 }), null);
  assert.equal(rootRarityFromFrequency(null), null);
});
