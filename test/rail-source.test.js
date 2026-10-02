import assert from 'node:assert/strict';
import test from 'node:test';

import { START_FEN, canonicalPosition, resolveMove } from '../src/graph.js';
import { createRailSource } from '../src/rail-source.js';

const CENTER = canonicalPosition(START_FEN);

function explorerMove(uci, white, draws, black) {
  return { uci, white, draws, black };
}

test('Rail keeps every legal Lichess Line while the badge counts only Notable source Lines', async () => {
  const explicit = resolveMove(CENTER, { uci: 'h2h3' });
  const explorer = {
    white: 500,
    draws: 200,
    black: 300,
    moves: [
      explorerMove('e2e4', 300, 100, 200),
      explorerMove('d2d4', 150, 50, 100),
      explorerMove('a2a3', 4, 2, 4),
    ],
  };
  const loadRail = createRailSource({
    acquireExplorer: async () => explorer,
    graph: {
      incoming: async () => [{ id: 'root-1' }, { id: 'root-2' }],
      outgoing: async () => [{
        source: CENTER,
        target: explicit.target,
        uci: explicit.uci,
        san: explicit.san,
        explicit: true,
      }],
    },
    evalProvider: { get: async () => null },
    loadMastersReading: async () => null,
  });

  const rail = await loadRail({ center: CENTER });

  assert.equal(rail.rootsCount, 2);
  assert.equal(rail.notableLinesCount, 2);
  assert.deepEqual(rail.lines.map((line) => line.edge.uci), ['e2e4', 'd2d4', 'a2a3', 'h2h3']);
  assert.deepEqual(rail.lines.map((line) => line.source), ['lichess', 'lichess', 'lichess', 'explicit']);
  assert.deepEqual(rail.lines.map((line) => line.notable), [true, true, false, false]);
  assert.ok(Object.isFrozen(rail));
  assert.ok(Object.isFrozen(rail.lines));
});
