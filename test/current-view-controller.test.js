import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CurrentViewController,
  refinementRetryable,
  refinementUnavailable,
} from '../src/current-view-controller.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function flush(turns = 16) {
  for (let index = 0; index < turns; index += 1) await Promise.resolve();
}

function structure(center, mode, extra = {}) {
  return {
    composition: { center, direction: mode, nodes: [], relationships: [] },
    readingFrontier: [],
    marker: `${center}:${mode}`,
    ...extra,
  };
}

function fixture(overrides = {}) {
  const calls = [];
  const publications = [];
  let restoreHandler = null;
  let orientation = 'white';
  let canGoBack = false;
  const routeLedger = {
    push(route) {
      canGoBack = true;
      calls.push(['push', route]);
    },
    replace(route) { calls.push(['replace', route]); },
    canGoBack() { return canGoBack; },
    back() {
      if (!canGoBack) return false;
      calls.push(['back']);
      return true;
    },
    onRestore(handler) {
      restoreHandler = handler;
      return () => {
        restoreHandler = null;
        calls.push(['stopRestore']);
      };
    },
  };
  const preferences = {
    setView(view) { calls.push(['setViewPreference', view]); },
  };
  const lens = {
    orientation() { return orientation; },
    flipOrientation() {
      orientation = orientation === 'white' ? 'black' : 'white';
      calls.push(['flipOrientation', orientation]);
      return orientation;
    },
  };
  const presenter = {
    start(view, actions) {
      publications.push({ kind: 'start', view, actions });
      calls.push(['presentStart', view.center, view.mode, view.structure.status, view.evidence.status, view.settling]);
    },
    update(view, actions) {
      publications.push({ kind: 'update', view, actions });
      calls.push(['presentUpdate', view.center, view.mode, view.structure.status, view.evidence.status, view.settling]);
    },
  };
  const controller = new CurrentViewController({
    initial: { center: 'A', view: 'roots' },
    canonicalize: (value) => String(value).toUpperCase(),
    routeLedger,
    preferences,
    lens,
    structure: async ({ center, mode }) => {
      calls.push(['structure', center, mode]);
      return structure(center, mode);
    },
    evidence: async ({ center, mode, structure: accepted }) => {
      calls.push(['evidence', center, mode, accepted]);
      return { marker: `evidence:${center}:${mode}` };
    },
    presenter,
    ...overrides,
  });
  return {
    controller,
    calls,
    publications,
    restoreRoute(route, backAvailable = canGoBack) {
      canGoBack = backAvailable;
      return restoreHandler?.(route);
    },
  };
}

test('Current View publishes one Nodus while RouteLedger, preferences, and Lens retain their own state', async () => {
  const { controller, calls } = fixture();
  await controller.start();
  assert.equal(controller.snapshot.center, 'A');
  assert.equal(controller.snapshot.mode, 'roots');
  assert.equal(controller.snapshot.navigation.canGoBack, false);
  assert.equal(controller.snapshot.structure.status, 'ready');
  assert.equal(controller.snapshot.settling, false);

  await controller.recenter({ target: 'b' });
  assert.equal(controller.snapshot.center, 'B');
  assert.equal(controller.snapshot.navigation.canGoBack, true);
  assert.deepEqual(calls.find(([name]) => name === 'push')?.[1], { center: 'B', view: 'roots' });
  assert.equal(controller.back(), true);
  assert.equal(calls.at(-1)[0], 'back');

  await controller.setMode('lines');
  assert.equal(controller.snapshot.center, 'B');
  assert.equal(controller.snapshot.mode, 'lines');
  assert.equal(controller.snapshot.structure.value.marker, 'B:lines');
  assert.ok(calls.some(([name, value]) => name === 'setViewPreference' && value === 'lines'));

  await controller.flip();
  assert.equal(controller.snapshot.orientation, 'black');
  assert.ok(calls.some(([name, value]) => name === 'flipOrientation' && value === 'black'));
  assert.equal(Object.hasOwn(controller.snapshot, 'generation'), false);
  assert.equal(Object.hasOwn(controller.snapshot, 'navDepth'), false);
  assert.equal(Object.hasOwn(controller.snapshot, 'view'), false);
});

test('mode switches keep the same Nodus and recompose one semantic Constellation', async () => {
  const structureCalls = { roots: 0, lines: 0 };
  const { controller } = fixture({
    structure: async ({ center, mode }) => {
      structureCalls[mode] += 1;
      return structure(center, mode);
    },
  });

  await controller.start();
  assert.deepEqual(structureCalls, { roots: 1, lines: 0 });
  assert.equal(controller.snapshot.center, 'A');
  assert.equal(controller.snapshot.structure.value.marker, 'A:roots');

  await controller.setMode('lines');
  assert.deepEqual(structureCalls, { roots: 1, lines: 1 });
  assert.equal(controller.snapshot.center, 'A');
  assert.equal(controller.snapshot.structure.value.marker, 'A:lines');

  await controller.setMode('roots');
  assert.deepEqual(structureCalls, { roots: 2, lines: 1 });
  assert.equal(controller.snapshot.center, 'A');
  assert.equal(controller.snapshot.structure.value.marker, 'A:roots');
});

test('new refinement runs use presenter.start while redraw and accepted replacements use update', async () => {
  const { controller, publications } = fixture();
  await controller.start();
  assert.equal(publications[0].kind, 'start');
  assert.ok(publications.slice(1).every(({ kind }) => kind === 'update'));

  publications.length = 0;
  await controller.redraw();
  assert.deepEqual(publications.map(({ kind }) => kind), ['update']);

  publications.length = 0;
  await controller.refresh();
  assert.equal(publications[0].kind, 'start');
  assert.ok(publications.slice(1).every(({ kind }) => kind === 'update'));
});

test('RouteLedger restoration selects the recorded Nodus without writing another history entry', async () => {
  const { controller, calls, restoreRoute } = fixture();
  await controller.start();
  calls.length = 0;
  restoreRoute({ center: 'c', view: 'lines' }, true);
  await flush(24);
  assert.deepEqual(
    { center: controller.snapshot.center, mode: controller.snapshot.mode, canGoBack: controller.snapshot.navigation.canGoBack },
    { center: 'C', mode: 'lines', canGoBack: true },
  );
  assert.equal(calls.some(([name]) => name === 'push' || name === 'replace'), false);

  controller.dispose();
  assert.ok(calls.some(([name]) => name === 'stopRestore'));
  restoreRoute({ center: 'd', view: 'roots' }, false);
  await flush();
  assert.equal(controller.snapshot.center, 'C');
});

test('superseded structure results never become current after another Nodus is selected', async () => {
  const first = deferred();
  const { controller, publications } = fixture({
    structure: async ({ center, mode }) => {
      if (center === 'A') await first.promise;
      return structure(center, mode, { marker: center });
    },
  });

  const starting = controller.start();
  await flush(2);
  await controller.recenter({ target: 'b' });
  const afterB = publications.length;
  first.resolve();
  await starting;
  await flush();

  assert.equal(controller.snapshot.center, 'B');
  assert.equal(controller.snapshot.structure.value.marker, 'B');
  assert.equal(publications.slice(afterB).some(({ view }) => view.center === 'A'), false);
});

test('contributors receive one accepted structure and no controller publication capabilities', async () => {
  let structureInput;
  let evidenceInput;
  let refinementInput;
  const { controller, publications } = fixture({
    structure: async (input) => {
      structureInput = input;
      return structure(input.center, input.mode);
    },
    evidence: async (input) => {
      evidenceInput = input;
      return { center: input.center };
    },
    refine: (input) => {
      refinementInput = input;
      return [];
    },
  });

  await controller.start();

  assert.deepEqual(Object.keys(structureInput).sort(), ['center', 'mode', 'signal']);
  assert.deepEqual(Object.keys(evidenceInput).sort(), ['center', 'mode', 'signal', 'structure']);
  assert.deepEqual(Object.keys(refinementInput).sort(), ['center', 'mode', 'signal', 'structure']);
  assert.equal(Object.hasOwn(refinementInput, 'structures'), false);
  assert.equal(Object.hasOwn(refinementInput, 'publish'), false);
  assert.ok(publications.length > 0);
  assert.ok(Object.isFrozen(controller.snapshot));
  assert.ok(Object.isFrozen(controller.snapshot.navigation));
  assert.ok(Object.isFrozen(controller.snapshot.structure));
  assert.ok(Object.isFrozen(controller.snapshot.structure.value));
  assert.ok(Object.isFrozen(controller.snapshot.structure.value.composition));
  assert.ok(Object.isFrozen(controller.snapshot.evidence.value));
  assert.ok(Object.isFrozen(controller.snapshot.rail));
  assert.ok(Object.isFrozen(publications[0].actions));
});

test('generic refinement completion recomposes the accepted Current View without becoming structural', async () => {
  const work = deferred();
  let fact = 0;
  const { controller, publications } = fixture({
    structure: async ({ center, mode }) => structure(center, mode, { marker: `${center}:${mode}:${fact}` }),
    refine: () => [{ key: 'supplementary', run: () => work.promise }],
  });

  await controller.start();
  assert.equal(controller.snapshot.structure.value.marker, 'A:roots:0');
  assert.equal(controller.snapshot.settling, false);

  fact = 1;
  work.resolve();
  await flush(32);

  assert.equal(controller.snapshot.structure.value.marker, 'A:roots:1');
  assert.equal(controller.snapshot.settling, false);
  assert.equal(publications.slice(1).some(({ view }) => view.structure.status === 'loading'), false);
});

test('same-turn refinement completions coalesce into one active-view recomposition', async () => {
  const first = deferred();
  const second = deferred();
  let compositions = 0;
  const { controller } = fixture({
    structure: async ({ center, mode }) => {
      compositions += 1;
      return structure(center, mode, { marker: `${mode}:${compositions}` });
    },
    refine: () => [
      { key: 'first', run: () => first.promise },
      { key: 'second', run: () => second.promise },
    ],
  });

  await controller.start();
  assert.equal(compositions, 1);
  first.resolve();
  second.resolve();
  await flush(32);

  assert.equal(compositions, 2);
  assert.equal(controller.snapshot.settling, false);
});

test('supplementary refinement failure leaves the accepted view usable and settled', async () => {
  const work = deferred();
  const { controller } = fixture({
    rail: async () => ({ lines: [] }),
    refine: () => [{ key: 'optional-source', run: () => work.promise }],
  });

  await controller.start();
  assert.equal(controller.snapshot.structure.status, 'ready');
  assert.equal(controller.snapshot.rail.status, 'ready');
  assert.equal(controller.snapshot.settling, false);

  work.reject(new Error('source unavailable'));
  await flush(32);

  assert.equal(controller.snapshot.structure.status, 'ready');
  assert.equal(controller.snapshot.rail.status, 'ready');
  assert.equal(controller.snapshot.settling, false);
});

test('semantic structural unavailability discharges only the active refinement-run obligation', async () => {
  let attempts = 0;
  const { controller } = fixture({
    structure: async ({ center, mode }) => structure(center, mode, { readingFrontier: ['B'] }),
    refine: () => [{
      key: 'explorer:B',
      modes: ['roots'],
      structuralReading: 'B',
      run: async () => {
        attempts += 1;
        return refinementUnavailable;
      },
    }],
  });

  await controller.start();
  await flush(32);
  assert.equal(attempts, 1);
  assert.deepEqual(controller.snapshot.structure.value.readingFrontier, ['B']);
  assert.equal(controller.snapshot.settling, false);

  await controller.refresh();
  await flush(32);
  assert.equal(attempts, 2);
  assert.deepEqual(controller.snapshot.structure.value.readingFrontier, ['B']);
  assert.equal(controller.snapshot.settling, false);
});

test('retryable structural work remains Settling and retries only after its lower-owned gate opens', async () => {
  const retry = deferred();
  let attempts = 0;
  const { controller } = fixture({
    structure: async ({ center, mode }) => structure(center, mode, { readingFrontier: ['B'] }),
    refine: () => [{
      key: 'explorer:B',
      structuralReading: 'B',
      run: async () => {
        attempts += 1;
        return attempts === 1 ? refinementRetryable(retry.promise) : refinementUnavailable;
      },
    }],
  });

  await controller.start();
  await flush(24);
  assert.equal(attempts, 1);
  assert.equal(controller.snapshot.settling, true);

  await flush(24);
  assert.equal(attempts, 1);

  retry.resolve();
  await flush(40);
  assert.equal(attempts, 2);
  assert.equal(controller.snapshot.settling, false);
});

test('supplementary unavailability does not pre-discharge a Reading admitted structurally later in the same run', async () => {
  let structural = false;
  let attempts = 0;
  const { controller } = fixture({
    structure: async ({ center, mode }) => structure(center, mode, {
      readingFrontier: structural ? ['B'] : [],
      marker: `${mode}:${structural}`,
    }),
    refine: ({ mode }) => [{
      key: 'explorer:B',
      modes: [mode],
      structuralReading: structural ? 'B' : null,
      run: async () => {
        attempts += 1;
        return refinementUnavailable;
      },
    }],
  });

  await controller.start();
  await flush(24);
  assert.equal(attempts, 1);
  assert.equal(controller.snapshot.settling, false);

  structural = true;
  await controller.recompose();
  await flush(32);
  assert.equal(attempts, 2);
  assert.equal(controller.snapshot.settling, false);
});

test('arbitrary structural task failure remains diagnostic without implying automatic progress', async () => {
  const work = deferred();
  const { controller } = fixture({
    structure: async ({ center, mode }) => structure(center, mode, { readingFrontier: ['B'] }),
    refine: () => [{
      key: 'explorer:B',
      structuralReading: 'B',
      run: () => work.promise,
    }],
  });

  await controller.start();
  assert.equal(controller.snapshot.settling, true);
  work.reject(new Error('reconciliation failed'));
  await flush(32);
  assert.equal(controller.snapshot.weather.structural.failed, 1);
  assert.equal(controller.snapshot.weather.structural.unavailable, 0);
  assert.equal(controller.snapshot.settling, false);
});

test('critical local structure failure is terminal for that accepted view and refresh can recover', async () => {
  let fail = true;
  const { controller } = fixture({
    structure: async ({ center, mode }) => {
      if (fail) throw new Error('structure unavailable');
      return structure(center, mode);
    },
  });
  await controller.start();
  assert.equal(controller.snapshot.structure.status, 'failed');
  fail = false;
  await controller.refresh();
  assert.equal(controller.snapshot.structure.status, 'ready');
});

test('abort-shaped structure failure is not cancellation while the owning run remains live', async () => {
  const rawAbort = new Error('storage transaction aborted');
  rawAbort.name = 'AbortError';
  const { controller } = fixture({
    structure: async () => { throw rawAbort; },
  });

  await controller.start();
  assert.equal(controller.snapshot.structure.status, 'failed');
  assert.equal(controller.snapshot.structure.error, 'storage transaction aborted');
});

test('redraw presents without recomputing while refresh recomputes only the active semantic Constellation', async () => {
  const structureCalls = { roots: 0, lines: 0 };
  const { controller, calls, publications } = fixture({
    structure: async ({ center, mode }) => {
      structureCalls[mode] += 1;
      return structure(center, mode);
    },
  });
  await controller.start();
  calls.length = 0;
  const presented = publications.length;
  const composed = { ...structureCalls };
  await controller.redraw();
  assert.deepEqual(structureCalls, composed);
  assert.equal(publications.length, presented + 1);
  await controller.refresh();
  assert.deepEqual(structureCalls, { roots: composed.roots + 1, lines: composed.lines });
  assert.equal(calls.some(([name]) => name === 'push'), false);
});

test('explicit refresh keeps the established same-Nodus snapshot visible while replacing the run', async () => {
  let hold = null;
  let revision = 0;
  const { controller, publications } = fixture({
    structure: async ({ center, mode }) => {
      if (hold) await hold.promise;
      return structure(center, mode, { marker: `${mode}:${revision}` });
    },
  });

  await controller.start();
  assert.equal(controller.snapshot.structure.value.marker, 'roots:0');
  publications.length = 0;
  hold = deferred();
  revision = 1;
  const refreshing = controller.refresh();
  await flush(2);

  assert.equal(publications[0].kind, 'start');
  assert.equal(publications[0].view.center, 'A');
  assert.equal(publications[0].view.structure.status, 'ready');
  assert.equal(publications[0].view.structure.value.marker, 'roots:0');

  hold.resolve();
  await refreshing;
  assert.equal(controller.snapshot.center, 'A');
  assert.equal(controller.snapshot.structure.value.marker, 'roots:1');
});

test('obsolete refinement completion cannot mutate a replacement Nodus', async () => {
  const oldWork = deferred();
  const { controller } = fixture({
    structure: async ({ center, mode }) => structure(center, mode, { marker: center }),
    refine: ({ center }) => center === 'A'
      ? [{ key: 'old', run: () => oldWork.promise }]
      : [],
  });

  await controller.start();
  await controller.recenter({ target: 'b' });
  assert.equal(controller.snapshot.center, 'B');

  oldWork.resolve();
  await flush(32);
  assert.equal(controller.snapshot.center, 'B');
  assert.equal(controller.snapshot.structure.value.marker, 'B');
});


test('Root discovery is one semantic attempt per Current View run', async () => {
  const work = deferred();
  let attempts = 0;
  const { controller } = fixture({
    refine: ({ mode }) => mode === 'roots' ? [{
      key: 'root-discovery:A',
      purpose: 'root-discovery',
      modes: ['roots'],
      run: () => {
        attempts += 1;
        return work.promise;
      },
    }] : [],
  });

  await controller.start();
  assert.equal(attempts, 1);
  assert.equal(controller.snapshot.activities.rootDiscovery, 'working');
  assert.equal(controller.snapshot.weather.structural.detached, 0);
  assert.equal(controller.snapshot.weather.supplementary.active, 1);

  work.resolve({ refinement: 'satisfied' });
  await flush(32);

  assert.equal(controller.snapshot.activities.rootDiscovery, 'satisfied');
  assert.equal(controller.snapshot.weather.structural.detached, 0);

  await controller.recompose();
  await flush(16);
  assert.equal(attempts, 1);

  await controller.refresh();
  await flush(32);
  assert.equal(attempts, 2);
  assert.equal(controller.snapshot.activities.rootDiscovery, 'satisfied');
});
