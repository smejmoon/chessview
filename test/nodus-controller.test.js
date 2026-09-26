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
    cycleOptions: { updatingDelayMs: 0, checkDelayMs: 0 },
    ...overrides,
  });
  return { controller, calls, browser };
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

test('superseded contributor work cannot publish into the current view', async () => {
  const first = deferred();
  const seen = [];
  let renderCount = 0;
  const { controller } = fixture({
    render: async (scope) => {
      renderCount += 1;
      if (renderCount === 1) await first.promise;
      seen.push(scope.center);
      return { composition: { center: scope.center, direction: scope.view } };
    },
  });

  const starting = controller.start();
  const navigating = controller.navigate('b');
  first.resolve();
  await Promise.all([starting, navigating]);

  assert.equal(controller.snapshot.center, 'B');
  assert.deepEqual(seen, ['B']);
  assert.equal(controller.snapshot.composition.center, 'B');
});

test('contributor scopes carry explicit current-view state and direct navigation', async () => {
  let evidenceScope;
  const { controller, calls } = fixture({
    evidence: async (scope) => { evidenceScope = scope; },
  });
  await controller.start();
  assert.equal(evidenceScope.center, 'A');
  assert.equal(evidenceScope.view, 'roots');
  assert.equal(evidenceScope.composition.center, 'A');

  await evidenceScope.navigate('b');
  assert.equal(controller.snapshot.center, 'B');
  assert.ok(calls.some(([name]) => name === 'push'));
});

test('supplementary evidence failure does not make structural presentation fail', async () => {
  const { controller } = fixture({
    evidence: async () => { throw new Error('evidence unavailable'); },
  });
  await controller.start();
  assert.notEqual(controller.snapshot.presentation, 'failed');
});
