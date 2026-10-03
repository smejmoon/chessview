import assert from 'node:assert/strict';
import test from 'node:test';

import { START_FEN, canonicalPosition, resolveMove } from '../src/graph.js';
import { createRailSource } from '../src/rail-source.js';

const CENTER = canonicalPosition(START_FEN);

function explorerMove(uci, white, draws, black) {
  return { uci, white, draws, black };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('Rail keeps every legal Lichess Line and explicit-only navigable Line', async () => {
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
  assert.deepEqual(rail.lines.map((line) => line.edge.uci), ['e2e4', 'd2d4', 'a2a3', 'h2h3']);
  assert.deepEqual(rail.lines.map((line) => line.source), ['lichess', 'lichess', 'lichess', 'explicit']);
  assert.equal('notableLinesCount' in rail, false);
  assert.equal(rail.lines.some((line) => 'notable' in line), false);
  assert.ok(Object.isFrozen(rail));
  assert.ok(Object.isFrozen(rail.lines));
});

test('Rail publishes Explorer inventory before delayed supplementary evidence', async () => {
  const evaluation = deferred();
  const masters = deferred();
  const publications = [];
  const explorer = {
    white: 10,
    draws: 5,
    black: 5,
    moves: [explorerMove('e2e4', 6, 2, 2)],
  };
  const loadRail = createRailSource({
    acquireExplorer: async () => explorer,
    graph: { incoming: async () => [], outgoing: async () => [] },
    evalProvider: { get: () => evaluation.promise },
    loadMastersReading: () => masters.promise,
  });

  const loading = loadRail({ center: CENTER, onProgress: (rail) => publications.push(rail) });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(publications.length, 1);
  assert.equal(publications[0].lines.length, 1);
  assert.equal(publications[0].lines[0].moveEval, null);
  assert.equal(publications[0].lines[0].mastersMismatch, null);

  evaluation.resolve({ depth: 20, pvs: [{ moves: 'e2e4', cp: 10 }] });
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(publications.length >= 2);

  masters.resolve({
    white: 10,
    draws: 5,
    black: 5,
    moves: [explorerMove('e2e4', 6, 2, 2)],
  });
  const rail = await loading;
  assert.equal(rail.lines.length, 1);
  assert.ok(publications.length >= 3);
});

test('supplementary Rail failure leaves published Explorer inventory usable', async () => {
  const publications = [];
  const explorer = {
    white: 10,
    draws: 5,
    black: 5,
    moves: [explorerMove('e2e4', 6, 2, 2)],
  };
  const loadRail = createRailSource({
    acquireExplorer: async () => explorer,
    graph: { incoming: async () => [], outgoing: async () => [] },
    evalProvider: { get: async () => { throw new Error('eval unavailable'); } },
    loadMastersReading: async () => { throw new Error('masters unavailable'); },
  });

  const rail = await loadRail({ center: CENTER, onProgress: (value) => publications.push(value) });

  assert.equal(rail.lines.length, 1);
  assert.ok(publications.length >= 1);
  assert.equal(rail.lines[0].edge.uci, 'e2e4');
});
