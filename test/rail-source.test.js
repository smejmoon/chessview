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

function explorerObservations() {
  const listeners = new Set();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    publish(position, reading) {
      for (const listener of [...listeners]) listener({ position, reading });
    },
  };
}

async function waitFor(predicate, message = 'condition was not reached') {
  for (let turn = 0; turn < 100; turn += 1) {
    const value = predicate();
    if (value) return value;
    await Promise.resolve();
  }
  assert.fail(message);
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
    loadExplorer: async () => explorer,
    currentExplorer: () => null,
    observeExplorer: () => () => {},
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

test('Rail publishes known graph inventory while Explorer and supplementary sources are delayed', async () => {
  const explorer = deferred();
  const evaluation = deferred();
  const masters = deferred();
  const explicit = resolveMove(CENTER, { uci: 'h2h3' });
  const publications = [];
  let evaluationStarted = false;
  let mastersStarted = false;
  const loadRail = createRailSource({
    loadExplorer: () => explorer.promise,
    currentExplorer: () => null,
    observeExplorer: () => () => {},
    graph: {
      incoming: async () => [{ id: 'root-1' }],
      outgoing: async () => [{
        source: CENTER,
        target: explicit.target,
        uci: explicit.uci,
        san: explicit.san,
        explicit: true,
      }],
    },
    evalProvider: {
      get: () => {
        evaluationStarted = true;
        return evaluation.promise;
      },
    },
    loadMastersReading: () => {
      mastersStarted = true;
      return masters.promise;
    },
  });

  const loading = loadRail({ center: CENTER, onProgress: (rail) => publications.push(rail) });
  const graphOnly = await waitFor(
    () => publications.find((rail) => rail.lines.some((line) => line.edge.uci === 'h2h3')
      && !rail.lines.some((line) => line.edge.uci === 'e2e4')),
    'known graph inventory was not published',
  );
  assert.equal(graphOnly.rootsCount, 1);
  await waitFor(() => evaluationStarted && mastersStarted, 'supplementary sources did not start independently');

  explorer.resolve({
    white: 10,
    draws: 5,
    black: 5,
    moves: [explorerMove('e2e4', 6, 2, 2)],
  });
  const withExplorer = await waitFor(
    () => publications.find((rail) => rail.lines.some((line) => line.edge.uci === 'e2e4')),
    'Explorer Source Line was not published',
  );
  assert.deepEqual(withExplorer.lines.map((line) => line.edge.uci), ['e2e4', 'h2h3']);

  evaluation.resolve(null);
  masters.resolve(null);
  const rail = await loading;
  assert.deepEqual(rail.lines.map((line) => line.edge.uci), ['e2e4', 'h2h3']);
});

test('Rail observes a usable Explorer Reading admitted by another acquisition participant', async () => {
  const explorer = deferred();
  const observations = explorerObservations();
  const publications = [];
  const reading = {
    white: 10,
    draws: 5,
    black: 5,
    moves: [explorerMove('e2e4', 6, 2, 2)],
  };
  let explorerLoads = 0;
  const loadRail = createRailSource({
    loadExplorer: () => {
      explorerLoads += 1;
      return explorer.promise;
    },
    currentExplorer: () => null,
    observeExplorer: (listener) => observations.subscribe(listener),
    graph: { incoming: async () => [], outgoing: async () => [] },
    evalProvider: { get: async () => null },
    loadMastersReading: async () => null,
  });

  const loading = loadRail({ center: CENTER, onProgress: (rail) => publications.push(rail) });
  await waitFor(() => publications.length > 0, 'initial Rail inventory was not published');
  observations.publish(CENTER, reading);

  const observed = await waitFor(
    () => publications.find((rail) => rail.lines.some((line) => line.edge.uci === 'e2e4')),
    'Rail did not consume the admitted Explorer observation',
  );
  assert.equal(observed.lines[0].edge.uci, 'e2e4');
  assert.equal(explorerLoads, 1);

  explorer.resolve(reading);
  const rail = await loading;
  assert.equal(rail.lines[0].edge.uci, 'e2e4');
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
    loadExplorer: async () => explorer,
    currentExplorer: () => null,
    observeExplorer: () => () => {},
    graph: { incoming: async () => [], outgoing: async () => [] },
    evalProvider: { get: () => evaluation.promise },
    loadMastersReading: () => masters.promise,
  });

  const loading = loadRail({ center: CENTER, onProgress: (rail) => publications.push(rail) });
  const explorerPublication = await waitFor(
    () => publications.find((rail) => rail.lines.some((line) => line.edge.uci === 'e2e4')),
    'Explorer inventory was not published',
  );
  assert.equal(explorerPublication.lines[0].moveEval, null);
  assert.equal(explorerPublication.lines[0].mastersMismatch, null);

  evaluation.resolve({ depth: 20, pvs: [{ moves: 'e2e4', cp: 10 }] });
  const evaluated = await waitFor(
    () => publications.find((rail) => rail.lines.some((line) => line.moveEval != null)),
    'engine evidence did not refine the Rail',
  );
  assert.equal(evaluated.lines[0].moveEval.quality, 'strong');

  masters.resolve({
    white: 10,
    draws: 5,
    black: 5,
    moves: [explorerMove('e2e4', 6, 2, 2)],
  });
  const rail = await loading;
  assert.equal(rail.lines.length, 1);
  assert.equal(rail.lines[0].edge.uci, 'e2e4');
});

test('Explorer failure leaves known graph inventory usable', async () => {
  const explicit = resolveMove(CENTER, { uci: 'h2h3' });
  const publications = [];
  const loadRail = createRailSource({
    loadExplorer: async () => { throw new Error('explorer unavailable'); },
    currentExplorer: () => null,
    observeExplorer: () => () => {},
    graph: {
      incoming: async () => [{ id: 'root-1' }],
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

  const rail = await loadRail({ center: CENTER, onProgress: (value) => publications.push(value) });
  assert.equal(rail.rootsCount, 1);
  assert.deepEqual(rail.lines.map((line) => line.edge.uci), ['h2h3']);
  assert.ok(publications.some((value) => value.lines.some((line) => line.edge.uci === 'h2h3')));
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
    loadExplorer: async () => explorer,
    currentExplorer: () => null,
    observeExplorer: () => () => {},
    graph: { incoming: async () => [], outgoing: async () => [] },
    evalProvider: { get: async () => { throw new Error('eval unavailable'); } },
    loadMastersReading: async () => { throw new Error('masters unavailable'); },
  });

  const rail = await loadRail({ center: CENTER, onProgress: (value) => publications.push(value) });

  assert.equal(rail.lines.length, 1);
  assert.ok(publications.some((value) => value.lines.some((line) => line.edge.uci === 'e2e4')));
  assert.equal(rail.lines[0].edge.uci, 'e2e4');
});
