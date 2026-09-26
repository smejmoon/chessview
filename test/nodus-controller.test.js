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
  const routeLedger = {
    push(route) { calls.push(['push', route]); },
    replace(route) { calls.push(['replace', route]); },
    back() { calls.push(['back']); },
  };
  const preferences = {
    setView(view) { calls.push(['setViewPreference', view]); },
    setOrientation(orientation) { calls.push(['setOrientationPreference', orientation]); },
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
    publish: (view, actions) => {
      publications.push({ view, actions });
      calls.push(['publish', view.center, view.mode, view.structure.status, view.evidence.status]);
    },
    ...overrides,
  });
  return { controller, calls, publications };
}

test('commands update one immutable current view while RouteLedger and preferences receive effects', async () => {
  const { controller, calls } = fixture();
  await controller.start();
  await flush();
  assert.equal(controller.snapshot.center, 'A');
  assert.equal(controller.snapshot.mode, 'roots');
  assert.equal(controller.snapshot.navigation.canGoBack, false);
  assert.equal(controller.snapshot.structure.status, 'ready');

  await controller.navigate('b');
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

test('restore consumes RouteLedger history without writing a new entry', async () => {
  const { controller, calls } = fixture();
  await controller.start();
  calls.length = 0;
  await controller.restore({ center: 'c', view: 'lines', navDepth: 4 });
  assert.deepEqual(
    { center: controller.snapshot.center, mode: controller.snapshot.mode, canGoBack: controller.snapshot.navigation.canGoBack },
    { center: 'C', mode: 'lines', canGoBack: true },
  );
  assert.equal(calls.some(([name]) => name === 'push' || name === 'replace'), false);
});

test('superseded structure results never become current or publish after a newer view', async () => {
  const first = deferred();
  const { controller, publications } = fixture({
    structure: async ({ center, mode }) => {
      if (center === 'A') await first.promise;
      return { composition: { center, direction: mode }, marker: center };
    },
  });

  const starting = controller.start();
  await flush(2);
  const navigating = controller.navigate('b');
  await navigating;
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
  assert.equal(Object.hasOwn(structureInput, 'navigate'), false);
  assert.equal(Object.hasOwn(evidenceInput, 'settle'), false);
  assert.ok(publications.length > 0);
  assert.ok(Object.isFrozen(controller.snapshot));
  assert.ok(Object.isFrozen(controller.snapshot.navigation));
  assert.ok(Object.isFrozen(controller.snapshot.structure));
  assert.ok(Object.isFrozen(controller.snapshot.structure.value));
  assert.ok(Object.isFrozen(controller.snapshot.structure.value.composition));
  assert.ok(Object.isFrozen(controller.snapshot.evidence.value));
  assert.ok(Object.isFrozen(publications[0].actions));
  assert.equal(typeof publications[0].actions.navigate, 'function');
  assert.equal(typeof publications[0].actions.setMode, 'function');
});

test('supplementary evidence publishes later without blocking or downgrading ready structure', async () => {
  const evidence = deferred();
  const { controller } = fixture({ evidence: () => evidence.promise });
  await controller.start();
  assert.equal(controller.snapshot.structure.status, 'ready');
  assert.equal(controller.snapshot.evidence.status, 'loading');

  evidence.reject(new Error('evidence unavailable'));
  await flush();
  assert.equal(controller.snapshot.structure.status, 'ready');
  assert.equal(controller.snapshot.evidence.status, 'failed');
  assert.match(controller.snapshot.evidence.error, /evidence unavailable/);
});

test('evidence values become part of the immutable current view after structural readiness', async () => {
  const evidence = deferred();
  const { controller } = fixture({ evidence: () => evidence.promise });
  await controller.start();
  evidence.resolve({ evaluation: 'value' });
  await flush();
  assert.equal(controller.snapshot.structure.status, 'ready');
  assert.equal(controller.snapshot.evidence.status, 'ready');
  assert.deepEqual(controller.snapshot.evidence.value, { evaluation: 'value' });
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
  assert.match(controller.snapshot.structure.error, /structure unavailable/);

  fail = false;
  await controller.refresh();
  assert.equal(controller.snapshot.structure.status, 'ready');
});

test('redraw republishes without recomputing while refresh recomputes without changing history', async () => {
  let structureCalls = 0;
  const { controller, calls, publications } = fixture({
    structure: async ({ center, mode }) => {
      structureCalls += 1;
      return { composition: { center, direction: mode } };
    },
  });
  await controller.start();
  await flush();
  calls.length = 0;
  const published = publications.length;
  const composed = structureCalls;

  await controller.redraw();
  assert.equal(structureCalls, composed);
  assert.equal(publications.length, published + 1);
  assert.equal(calls.some(([name]) => name === 'push' || name === 'replace'), false);

  await controller.refresh();
  assert.equal(structureCalls, composed + 1);
  assert.equal(calls.some(([name]) => name === 'push' || name === 'replace'), false);
});

test('Lines remain structurally loading until discovery reaches a terminal result', async () => {
  const discovery = deferred();
  const { controller } = fixture({
    initial: { center: 'A', view: 'lines', orientation: 'white', navDepth: 0 },
    discover: () => discovery.promise,
  });

  await controller.start();
  assert.equal(controller.snapshot.structure.status, 'loading');
  discovery.resolve(null);
  await flush(16);
  assert.equal(controller.snapshot.structure.status, 'ready');
});
