import assert from 'node:assert/strict';
import test from 'node:test';
import { NodusController } from '../src/nodus-controller.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function flush(turns = 8) {
  for (let index = 0; index < turns; index += 1) await Promise.resolve();
}

function fixture(overrides = {}) {
  const calls = [];
  const publications = [];
  let restoreHandler = null;
  const routeLedger = {
    push(route) { calls.push(['push', route]); },
    replace(route) { calls.push(['replace', route]); },
    back() { calls.push(['back']); },
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
    setOrientation(orientation) { calls.push(['setOrientationPreference', orientation]); },
  };
  const presenter = {
    start(view, actions) {
      publications.push({ kind: 'start', view, actions });
      calls.push(['presentStart', view.center, view.mode, view.structure.status, view.evidence.status]);
    },
    update(view, actions) {
      publications.push({ kind: 'update', view, actions });
      calls.push(['presentUpdate', view.center, view.mode, view.structure.status, view.evidence.status]);
    },
  };
  const controller = new NodusController({
    initial: { center: 'A', view: 'roots', orientation: 'white', navDepth: 0 },
    canonicalize: (value) => String(value).toUpperCase(),
    routeLedger,
    preferences,
    structure: async ({ center, mode }) => {
      calls.push(['structure', center, mode]);
      return { composition: { center, direction: mode }, marker: `${center}:${mode}` };
    },
    evidence: async ({ center, mode, structure }) => {
      calls.push(['evidence', center, mode, structure]);
      return { marker: `evidence:${center}:${mode}` };
    },
    presenter,
    ...overrides,
  });
  return {
    controller,
    calls,
    publications,
    restoreRoute(route) { return restoreHandler?.(route); },
  };
}

test('commands update one immutable current view while RouteLedger and preferences receive effects', async () => {
  const { controller, calls } = fixture();
  await controller.start();
  await flush();
  assert.equal(controller.snapshot.center, 'A');
  assert.equal(controller.snapshot.mode, 'roots');
  assert.equal(controller.snapshot.navigation.canGoBack, false);
  assert.equal(controller.snapshot.structure.status, 'ready');

  await controller.recenter({ target: 'b' });
  assert.equal(controller.snapshot.center, 'B');
  assert.equal(controller.snapshot.navigation.canGoBack, true);
  assert.deepEqual(calls.find(([name]) => name === 'push')?.[1], { center: 'B', view: 'roots', navDepth: 1 });

  await controller.setMode('lines');
  assert.equal(controller.snapshot.mode, 'lines');
  assert.ok(calls.some(([name, value]) => name === 'setViewPreference' && value === 'lines'));

  await controller.flip();
  assert.equal(controller.snapshot.orientation, 'black');
  assert.ok(calls.some(([name, value]) => name === 'setOrientationPreference' && value === 'black'));
  assert.equal(Object.hasOwn(controller.snapshot, 'generation'), false);
  assert.equal(Object.hasOwn(controller.snapshot, 'navDepth'), false);
  assert.equal(Object.hasOwn(controller.snapshot, 'view'), false);
});

test('new view lifecycles use presenter.start while redraw and accepted results use presenter.update', async () => {
  const { controller, publications } = fixture();
  await controller.start();
  await flush();
  assert.equal(publications[0].kind, 'start');
  assert.ok(publications.slice(1).every(({ kind }) => kind === 'update'));

  publications.length = 0;
  await controller.redraw();
  assert.deepEqual(publications.map(({ kind }) => kind), ['update']);

  publications.length = 0;
  await controller.refresh();
  await flush();
  assert.equal(publications[0].kind, 'start');
  assert.ok(publications.slice(1).every(({ kind }) => kind === 'update'));
});

test('RouteLedger restoration is owned by the controller and does not write another history entry', async () => {
  const { controller, calls, restoreRoute } = fixture();
  await controller.start();
  calls.length = 0;
  restoreRoute({ center: 'c', view: 'lines', navDepth: 4 });
  await flush(16);
  assert.deepEqual(
    { center: controller.snapshot.center, mode: controller.snapshot.mode, canGoBack: controller.snapshot.navigation.canGoBack },
    { center: 'C', mode: 'lines', canGoBack: true },
  );
  assert.equal(calls.some(([name]) => name === 'push' || name === 'replace'), false);

  controller.dispose();
  assert.ok(calls.some(([name]) => name === 'stopRestore'));
  restoreRoute({ center: 'd', view: 'roots', navDepth: 0 });
  await flush();
  assert.equal(controller.snapshot.center, 'C');
});

test('superseded structure results never become current or present after a newer view', async () => {
  const first = deferred();
  const { controller, publications } = fixture({
    structure: async ({ center, mode }) => {
      if (center === 'A') await first.promise;
      return { composition: { center, direction: mode }, marker: center };
    },
  });

  const starting = controller.start();
  await flush(2);
  const recentering = controller.recenter({ target: 'b' });
  await recentering;
  await flush();
  const afterB = publications.length;
  first.resolve();
  await starting;
  await flush();

  assert.equal(controller.snapshot.center, 'B');
  assert.equal(controller.snapshot.structure.value.marker, 'B');
  assert.equal(publications.slice(afterB).some(({ view }) => view.center === 'A'), false);
});

test('contributors return immutable values and receive no controller publication capabilities', async () => {
  let structureInput;
  let evidenceInput;
  const { controller, publications } = fixture({
    structure: async (input) => {
      structureInput = input;
      return { composition: { center: input.center, direction: input.mode } };
    },
    evidence: async (input) => {
      evidenceInput = input;
      return { center: input.center };
    },
  });

  await controller.start();
  await flush();

  assert.deepEqual(Object.keys(structureInput).sort(), ['center', 'mode', 'signal']);
  assert.deepEqual(Object.keys(evidenceInput).sort(), ['center', 'mode', 'signal', 'structure']);
  assert.equal(Object.hasOwn(structureInput, 'recenter'), false);
  assert.equal(Object.hasOwn(evidenceInput, 'settle'), false);
  assert.ok(publications.length > 0);
  assert.ok(Object.isFrozen(controller.snapshot));
  assert.ok(Object.isFrozen(controller.snapshot.navigation));
  assert.ok(Object.isFrozen(controller.snapshot.structure));
  assert.ok(Object.isFrozen(controller.snapshot.structure.value));
  assert.ok(Object.isFrozen(controller.snapshot.structure.value.composition));
  assert.ok(Object.isFrozen(controller.snapshot.evidence.value));
  assert.ok(Object.isFrozen(controller.snapshot.rail));
  assert.ok(Object.isFrozen(publications[0].actions));
  assert.equal(typeof publications[0].actions.recenter, 'function');
  assert.equal(Object.hasOwn(publications[0].actions, 'transition'), false);
});

test('supplementary evidence presents later without blocking or downgrading ready structure', async () => {
  const evidence = deferred();
  const { controller } = fixture({ evidence: () => evidence.promise });
  await controller.start();
  assert.equal(controller.snapshot.structure.status, 'ready');
  assert.equal(controller.snapshot.evidence.status, 'loading');
  evidence.reject(new Error('evidence unavailable'));
  await flush();
  assert.equal(controller.snapshot.structure.status, 'ready');
  assert.equal(controller.snapshot.evidence.status, 'failed');
});

test('critical structure failure is terminal for that view and refresh can recover', async () => {
  let fail = true;
  const { controller } = fixture({
    structure: async ({ center, mode }) => {
      if (fail) throw new Error('structure unavailable');
      return { composition: { center, direction: mode } };
    },
  });
  await controller.start();
  assert.equal(controller.snapshot.structure.status, 'failed');
  fail = false;
  await controller.refresh();
  assert.equal(controller.snapshot.structure.status, 'ready');
});

test('redraw presents without recomputing while refresh recomputes both sibling projections without changing history', async () => {
  const structureCalls = { roots: 0, lines: 0 };
  const { controller, calls, publications } = fixture({
    structure: async ({ center, mode }) => {
      structureCalls[mode] += 1;
      return { composition: { center, direction: mode } };
    },
  });
  await controller.start();
  await flush();
  calls.length = 0;
  const presented = publications.length;
  const composed = { ...structureCalls };
  await controller.redraw();
  assert.deepEqual(structureCalls, composed);
  assert.equal(publications.length, presented + 1);
  await controller.refresh();
  await flush();
  assert.deepEqual(structureCalls, { roots: composed.roots + 1, lines: composed.lines + 1 });
  assert.equal(calls.some(([name]) => name === 'push'), false);
});

test('Lines remain structurally loading until selected-Line acquisition reaches a terminal result', async () => {
  const discovery = deferred();
  let discoveryInput;
  const { controller } = fixture({
    initial: { center: 'A', view: 'lines', orientation: 'white', navDepth: 0 },
    discover: (input) => {
      discoveryInput = input;
      return discovery.promise;
    },
  });

  await controller.start();
  assert.equal(controller.snapshot.structure.status, 'loading');
  assert.equal(discoveryInput.structure.marker, 'A:lines');
  assert.equal(typeof discoveryInput.onProgress, 'function');
  discovery.resolve(null);
  await flush(16);
  assert.equal(controller.snapshot.structure.status, 'ready');
});

test('discovery progress recomposes only Lines and returns the new Lines structure to the discovery contributor', async () => {
  const compositions = { roots: 0, lines: 0 };
  let observed;
  const { controller } = fixture({
    initial: { center: 'A', view: 'lines', orientation: 'white', navDepth: 0 },
    structure: async ({ center, mode }) => ({
      composition: { center, direction: mode },
      marker: `${center}:${mode}:${++compositions[mode]}`,
    }),
    discover: async ({ onProgress }) => {
      observed = await onProgress();
      return null;
    },
  });

  await controller.start();
  await flush(16);
  assert.equal(observed.marker, 'A:lines:2');
  assert.equal(compositions.lines, 3);
  assert.equal(compositions.roots, 1);
  assert.equal(controller.snapshot.structure.status, 'ready');
});
