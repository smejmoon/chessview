import assert from 'node:assert/strict';
import test from 'node:test';

import { START_FEN, canonicalPosition, resolveMove } from '../src/graph.ts';
import { createEvidenceReader } from '../src/evidence-source.ts';

const CENTER = canonicalPosition(START_FEN);
const E4 = resolveMove(CENTER, { uci: 'e2e4' });
const EDGE = Object.freeze({
  source: CENTER,
  target: E4.target,
  uci: E4.uci,
  san: E4.san,
});

function reading() {
  return {
    white: 600,
    draws: 200,
    black: 200,
    moves: [{ uci: 'e2e4', white: 600, draws: 200, black: 200 }],
  };
}

test('Evidence is addressable by position and Graph Edge without Constellation structure', async () => {
  const evalReads = new Map();
  let mastersReads = 0;
  let cachedReads = 0;
  const sourceEval = { depth: 22, pvs: [{ moves: 'e2e4 e7e5', cp: 35 }] };
  const reader = createEvidenceReader({
    currentExplorer: (position) => position === CENTER ? reading() : null,
    readCachedExplorer: async () => { cachedReads += 1; return null; },
    evalProvider: {
      async available(position) {
        evalReads.set(position, (evalReads.get(position) ?? 0) + 1);
        return position === CENTER ? sourceEval : null;
      },
    },
    mastersProvider: {
      async available() {
        mastersReads += 1;
        return reading();
      },
    },
  });

  assert.equal(await reader.ratedReadingAvailable(CENTER), true);
  const position = await reader.position(CENTER);
  const first = await reader.move(EDGE);
  const second = await reader.move(EDGE);

  assert.equal(position.evaluation.depth, 22);
  assert.equal(first.frequency.share, 1);
  assert.equal(first.moveEval.quality, 'strong');
  assert.equal(first.humanResult.quality, 'favorable');
  assert.deepEqual(second, first);
  assert.equal(cachedReads, 0);
  assert.equal(evalReads.get(CENTER), 1);
  assert.equal(evalReads.get(E4.target), 1);
  assert.equal(mastersReads, 1);
  assert.ok(Object.isFrozen(first));
});

test('missing rated Reading stays unknown while independently available engine Evidence remains usable', async () => {
  const reader = createEvidenceReader({
    currentExplorer: () => null,
    readCachedExplorer: async () => null,
    evalProvider: {
      async available(position) {
        return position === CENTER
          ? { depth: 18, pvs: [{ moves: 'e2e4 e7e5', cp: 20 }] }
          : null;
      },
    },
    mastersProvider: { available: async () => null },
  });

  assert.equal(await reader.ratedReadingAvailable(CENTER), false);
  const move = await reader.move(EDGE, { comparisons: false });
  assert.equal(move.frequency, null);
  assert.equal(move.humanResult, null);
  assert.equal(move.moveEval.quality, 'strong');
  assert.equal(move.mastersMismatch, null);
});
