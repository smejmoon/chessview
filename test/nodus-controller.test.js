import assert from 'node:assert/strict';
import test from 'node:test';
import { NodusController } from '../src/nodus-controller.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function fixture(overrides = {}) {
  const calls = [];
  const browser = {
    push(route) { calls.push(['push', route]); },
    replace(route) { calls.push(['replace', route]); },
    persistView(view) { calls.push(['persistView', view]); },
    persistOrientation(orientation) { calls.push(['persistOrientation', orientation]); },
    back() { calls.push(['back']); },
  };
  const controller = new NodusController({
    initial: { center: 'A', view: 'roots', orientation: 'white', navDepth: 0 },
    canonicalize: (value) => String(value).toUpperCase(),
    browser,
    render: async (scope) => {
      calls.push(['render', scope.center, scope.view, scope.orientation]);
      return { composition: { center: scope.center, direction: scope.view } };
    },
    decorate: async (scope) => { calls.push(['decorate', scope.center, scope.composition]); },
    evidence: async (scope) => { calls.push(['evidence', scope.center, scope.composition]); },
    cycleOptions: { updatingDelayMs: 0, readyHoldMs: 0 },
    ...overrides,
  });
  return { controller, calls };
}

test('commands in, snapshot out', async () => {
  const { controller, calls } = fixture();
  await controller.start();
  assert.equal(controller.snapshot.center, 'A');
  assert.equal(controller.snapshot.view, 'roots');

  await controller.navigate('b');
  assert.equal(controller.snapshot.center, 'B');
  assert.equal(controller.snapshot.navDepth, 1);
  assert.deepEqual(calls.find(([name]) => name === 'push')?.[1], { center: 'B', view: 'roots', navDepth: 1 });

  await controller.setView('lines');
  assert.equal(controller.snapshot.view, 'lines');
  assert.ok(calls.some(([name, value]) => name === 'persistView' && value === 'lines'));

  await controller.flip();
  assert.equal(controller.snapshot.orientation, 'black');
  assert.ok(calls.some(([name, value]) => name === 'persistOrientation' && value === 'black'));
});

test('restore consumes browser history without pushing a new entry', async () => {
  const { controller, calls } = fixture();
  await controller.start();
  calls.length = 0;
  await controller.restore({ center: 'c', view: 'lines', navDepth: 4 });
  assert.deepEqual(
    { center: controller.snapshot.center, view: controller.snapshot.view, navDepth: controller.snapshot.navDepth },
    { center: 'C', view: 'lines', navDepth: 4 },
  );
  assert.equal(calls.some(([name]) => name === 'push' || name === 'replace'), false);
});

test('superseded contributor results cannot publish into the current view', async () => {
  const first = deferred();
  const completed = [];
  let renderCount = 0;
  const { controller } = fixture({
    render: async (scope) => {
      renderCount += 1;
      if (renderCount === 1) await first.promise;
      completed.push(scope.center);
      return { composition: { center: scope.center, direction: scope.view } };
    },
  });
  const starting = controller.start();
  const navigating = controller.navigate('b');
  first.resolve();
  await Promise.all([starting, navigating]);
  assert.equal(controller.snapshot.center, 'B');
  assert.ok(completed.includes('A'));
  assert.ok(completed.includes('B'));
  assert.equal(controller.snapshot.composition.center, 'B');
});

test('contributors receive the exact visible composition and explicit current-view state', async () => {
  const composition = { center: 'A', direction: 'roots', relationships: [{ id: 'edge-1' }] };
  let decorated;
  let evidenced;
  const { controller } = fixture({
    render: async () => ({ composition }),
    decorate: async (scope) => { decorated = scope; },
    evidence: async (scope) => { evidenced = scope; },
  });
  await controller.start();
  await Promise.resolve();
  assert.equal(decorated.center, 'A');
  assert.strictEqual(decorated.composition, composition);
  assert.strictEqual(evidenced.composition, composition);
});

test('contributor scopes provide direct navigation without exposing controller internals', async () => {
  let evidenceScope;
  const { controller, calls } = fixture({ evidence: async (scope) => { evidenceScope = scope; } });
  await controller.start();
  await Promise.resolve();
  assert.equal(evidenceScope.center, 'A');
  assert.equal(evidenceScope.view, 'roots');
  assert.equal(Object.hasOwn(evidenceScope, 'generation'), false);
  assert.equal(Object.hasOwn(evidenceScope, 'settle'), false);
  await evidenceScope.navigate('b');
  assert.equal(controller.snapshot.center, 'B');
  assert.ok(calls.some(([name]) => name === 'push'));
});

test('supplementary evidence neither blocks nor fails structural readiness', async () => {
  const evidence = deferred();
  const { controller } = fixture({ evidence: () => evidence.promise });
  await controller.start();
  assert.notEqual(controller.snapshot.presentation, 'failed');
  assert.notEqual(controller.snapshot.presentation, 'updating');
  evidence.reject(new Error('evidence unavailable'));
  await Promise.resolve();
  await Promise.resolve();
  assert.notEqual(controller.snapshot.presentation, 'failed');
});

test('critical structural failure is terminal for its generation and refresh can recover', async () => {
  let fail = true;
  const { controller } = fixture({
    decorate: async () => {
      if (fail) throw new Error('structure unavailable');
    },
  });
  await controller.start();
  assert.equal(controller.snapshot.presentation, 'failed');
  const failedGeneration = controller.snapshot.generation;

  fail = false;
  await controller.refresh();
  assert.equal(controller.snapshot.generation, failedGeneration + 1);
  assert.notEqual(controller.snapshot.presentation, 'failed');
});

test('redraw preserves generation while refresh supersedes it without changing history', async () => {
  const { controller, calls } = fixture();
  await controller.start();
  calls.length = 0;
  const generation = controller.snapshot.generation;

  await controller.redraw();
  assert.equal(controller.snapshot.generation, generation);
  assert.equal(calls.some(([name]) => name === 'push' || name === 'replace'), false);

  await controller.refresh();
  assert.equal(controller.snapshot.generation, generation + 1);
  assert.equal(calls.some(([name]) => name === 'push' || name === 'replace'), false);
});
