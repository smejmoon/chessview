import assert from 'node:assert/strict';
import test from 'node:test';
import { START_FEN, canonicalPosition, resolveMove } from '../src/graph.js';
import { createRailSource } from '../src/rail-source.js';
const CENTER = canonicalPosition(START_FEN);
function explorerMove(uci, white, draws, black) { return { uci, white, draws, black }; }

test('Rail keeps every legal Lichess Line and explicit-only navigable Line', async () => {
  const explicit = resolveMove(CENTER, { uci: 'h2h3' });
  const explorer = { white: 500, draws: 200, black: 300, moves: [explorerMove('e2e4', 300, 100, 200), explorerMove('d2d4', 150, 50, 100), explorerMove('a2a3', 4, 2, 4)] };
  let outgoingReads = 0;
  const composeRail = createRailSource({
    currentExplorer: () => explorer, readCachedExplorer: async () => null,
    graph: { outgoing: async () => { outgoingReads += 1; return [{ source: CENTER, target: explicit.target, uci: explicit.uci, san: explicit.san, explicit: true }]; } },
    evalProvider: { available: async () => null }, mastersProvider: { available: async () => null },
  });
  const rail = await composeRail({ center: CENTER });
  assert.deepEqual(rail.lines.map((line) => line.edge.uci), ['e2e4', 'd2d4', 'a2a3', 'h2h3']);
  assert.deepEqual(rail.lines.map((line) => line.source), ['lichess', 'lichess', 'lichess', 'explicit']);
  assert.equal(Object.hasOwn(rail.lines[0].edge, 'games'), false);
  assert.equal(Object.hasOwn(rail.lines[0].edge, 'share'), false);
  assert.deepEqual(rail.lines[0].frequency, { games: 600, sourceGames: 1000, share: 0.6 });
  assert.equal('rootsCount' in rail, false);
  assert.equal('notableLinesCount' in rail, false);
  assert.equal(rail.lines.some((line) => 'notable' in line), false);
  assert.equal(outgoingReads, 1);
  assert.ok(Object.isFrozen(rail)); assert.ok(Object.isFrozen(rail.lines));
});

test('Rail derives known Line inventory without starting source work', async () => {
  const explicit = resolveMove(CENTER, { uci: 'h2h3' }); let explorerReads = 0; let evalReads = 0; let mastersReads = 0;
  const composeRail = createRailSource({
    currentExplorer: () => null, readCachedExplorer: async () => { explorerReads += 1; return null; },
    graph: { outgoing: async () => [{ source: CENTER, target: explicit.target, uci: explicit.uci, san: explicit.san, explicit: true }] },
    evalProvider: { available: async () => { evalReads += 1; return null; } }, mastersProvider: { available: async () => { mastersReads += 1; return null; } },
  });
  const rail = await composeRail({ center: CENTER });
  assert.deepEqual(rail.lines.map((line) => line.edge.uci), ['h2h3']);
  assert.equal(explorerReads, 1); assert.equal(evalReads, 1); assert.equal(mastersReads, 0);
});

test('recomposition refines Rail from newly available facts without a Rail hydration lifecycle', async () => {
  const explicit = resolveMove(CENTER, { uci: 'h2h3' }); let explorer = null; let evaluation = null; let masters = null;
  const composeRail = createRailSource({
    currentExplorer: () => explorer, readCachedExplorer: async () => null,
    graph: { outgoing: async () => [{ source: CENTER, target: explicit.target, uci: explicit.uci, san: explicit.san, explicit: true }] },
    evalProvider: { available: async () => evaluation }, mastersProvider: { available: async () => masters },
  });
  const first = await composeRail({ center: CENTER }); assert.deepEqual(first.lines.map((line) => line.edge.uci), ['h2h3']);
  explorer = { white: 10, draws: 5, black: 5, moves: [explorerMove('e2e4', 6, 2, 2)] };
  const withExplorer = await composeRail({ center: CENTER }); assert.deepEqual(withExplorer.lines.map((line) => line.edge.uci), ['e2e4', 'h2h3']); assert.equal(withExplorer.lines[0].moveEval, null);
  evaluation = { depth: 20, pvs: [{ moves: 'e2e4', cp: 10 }] }; masters = { white: 10, draws: 5, black: 5, moves: [explorerMove('e2e4', 6, 2, 2)] };
  const refined = await composeRail({ center: CENTER }); assert.equal(refined.lines[0].moveEval.quality, 'strong'); assert.equal(refined.lines.length, 2);
});

test('current Explorer observation wins over durable cached observation', async () => {
  const current = { white: 10, draws: 0, black: 0, moves: [explorerMove('e2e4', 10, 0, 0)] };
  const cached = { white: 10, draws: 0, black: 0, moves: [explorerMove('d2d4', 10, 0, 0)] };
  const composeRail = createRailSource({ currentExplorer: () => current, readCachedExplorer: async () => cached, graph: { outgoing: async () => [] }, evalProvider: { available: async () => null }, mastersProvider: { available: async () => null } });
  const rail = await composeRail({ center: CENTER }); assert.deepEqual(rail.lines.map((line) => line.edge.uci), ['e2e4']);
});
