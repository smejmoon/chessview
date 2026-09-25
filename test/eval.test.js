import test from 'node:test';
import assert from 'node:assert/strict';

import {
  humanMismatch,
  moveEvaluation,
  railWorthy,
  rootRarity,
} from '../src/eval.js';

const SOURCE = '8/8/8/8/8/8/8/K6k w - -';

function explorer(moves) {
  return { moves };
}

test('move evaluation distinguishes 0.5 and 1.0 pawn loss', () => {
  const sourceEval = {
    depth: 22,
    pvs: [
      { cp: 30, moves: 'a1a2' },
      { cp: -20, moves: 'a1b1' },
      { cp: -80, moves: 'a1b2' },
    ],
  };

  const dubious = moveEvaluation(SOURCE, { uci: 'a1b1' }, sourceEval);
  const bad = moveEvaluation(SOURCE, { uci: 'a1b2' }, sourceEval);
  assert.equal(dubious.lossCp, 50);
  assert.equal(dubious.quality, 'dubious');
  assert.equal(bad.lossCp, 110);
  assert.equal(bad.quality, 'bad');
});

test('move evaluation requires adequate depth and can use child position eval', () => {
  const shallow = { depth: 17, pvs: [{ cp: 20, moves: 'a1a2' }] };
  assert.equal(moveEvaluation(SOURCE, { uci: 'a1a2' }, shallow), null);

  const sourceEval = { depth: 22, pvs: [{ cp: 30, moves: 'a1a2' }] };
  const targetEval = { depth: 21, pvs: [{ cp: -40, moves: 'h1h2' }] };
  const hydrated = moveEvaluation(SOURCE, { uci: 'a1b1' }, sourceEval, targetEval);
  assert.equal(hydrated.lossCp, 70);
  assert.equal(hydrated.quality, 'dubious');
  assert.equal(hydrated.fromMultiPv, false);

  const shallowTarget = { depth: 17, pvs: [{ cp: -40, moves: 'h1h2' }] };
  assert.equal(moveEvaluation(SOURCE, { uci: 'a1b1' }, sourceEval, shallowTarget), null);
});

test('human mismatch is silent on agreement and directional on disagreement', () => {
  const data = explorer([
    { uci: 'a1a2', white: 600, draws: 200, black: 200 },
    { uci: 'a1b1', white: 470, draws: 160, black: 370 },
  ]);
  const strong = { lossCp: 10 };
  const weak = { lossCp: 70 };

  assert.equal(humanMismatch(data, { uci: 'a1a2' }, SOURCE, strong), null);
  assert.equal(humanMismatch(data, { uci: 'a1b1' }, SOURCE, strong)?.direction, 'down');
  assert.equal(humanMismatch(data, { uci: 'a1a2' }, SOURCE, weak)?.direction, 'up');
});

test('Rail keeps sampled plausible moves and only popular bad moves', () => {
  const data = explorer([
    { uci: 'a1a2', white: 520, draws: 200, black: 280 },
    { uci: 'a1b1', white: 500, draws: 200, black: 300 },
  ]);

  assert.equal(railWorthy({
    edge: { uci: 'a1a2', games: 1000, share: 0.01 },
    sourceKey: SOURCE,
    lichessExplorer: data,
    moveQuality: { lossCp: 20 },
  }), true);

  assert.equal(railWorthy({
    edge: { uci: 'a1b1', games: 1000, share: 0.04 },
    sourceKey: SOURCE,
    lichessExplorer: data,
    moveQuality: { lossCp: 120 },
  }), false);

  assert.equal(railWorthy({
    edge: { uci: 'a1b1', games: 1000, share: 0.06 },
    sourceKey: SOURCE,
    lichessExplorer: data,
    moveQuality: { lossCp: 120 },
  }), true);
});

test('Root rarity only classifies evidenced moves from meaningful samples', () => {
  const sampled = { games: 10_000 };
  assert.equal(rootRarity({ games: 600, share: 0.06 }, sampled), null);
  assert.equal(rootRarity({ games: 400, share: 0.04 }, sampled), 'rare');
  assert.equal(rootRarity({ games: 80, share: 0.008 }, sampled), 'very-rare');
  assert.equal(rootRarity({ games: 0, share: 0 }, sampled), null);
  assert.equal(rootRarity({ games: 4, share: 0.04 }, { games: 80 }), null);
});
