import assert from 'node:assert/strict';
import test from 'node:test';
import { CurrentViewController } from '../src/current-view-controller.ts';

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

function fixture(materializeMove = null) {
  const calls = [];
  const presenter = {
    start() {},
    update() {},
  };
  const controller = new CurrentViewController({
    initial: { center: 'A', view: 'roots', orientation: 'white', navDepth: 0 },
    canonicalize: (value) => String(value).toUpperCase(),
    routeLedger: {
      replace(route) { calls.push(['replace', route]); },
      push(route) { calls.push(['push', route]); },
    },
    structure: async ({ center, mode }) => ({ composition: { center, direction: mode } }),
    materializeMove,
    presenter,
  });
  return { controller, calls };
}

test('a known target recenters directly without move materialization', async () => {
  let materializations = 0;
  const { controller, calls } = fixture(async () => {
    materializations += 1;
    return { target: 'ignored' };
  });

  await controller.start();
  assert.equal(await controller.recenter({ target: 'b' }), true);

  assert.equal(materializations, 0);
  assert.equal(controller.snapshot.center, 'B');
  assert.ok(calls.some(([name, route]) => name === 'push' && route.center === 'B'));
});

test('a move is materialized and then uses the same recenter path', async () => {
  const seen = [];
  const { controller, calls } = fixture(async (request) => {
    seen.push(request);
    return { target: 'b' };
  });

  await controller.start();
  assert.equal(await controller.recenter({ move: { from: 'e2', to: 'e4' } }), true);

  assert.deepEqual(seen, [{ source: 'A', move: { from: 'e2', to: 'e4', promotion: undefined } }]);
  assert.equal(controller.snapshot.center, 'B');
  assert.ok(calls.some(([name, route]) => name === 'push' && route.center === 'B'));
});

test('a stale move materialization cannot recenter a replacement view', async () => {
  const pending = deferred();
  const { controller } = fixture(async () => pending.promise);

  await controller.start();
  const moveRecenter = controller.recenter({ move: { from: 'e2', to: 'e4' } });
  await controller.recenter({ target: 'c' });
  pending.resolve({ target: 'b' });

  assert.equal(await moveRecenter, false);
  assert.equal(controller.snapshot.center, 'C');
});

test('a recenter request must contain exactly one target source', async () => {
  const { controller } = fixture(async () => ({ target: 'b' }));
  await controller.start();

  assert.equal(await controller.recenter({}), false);
  assert.equal(await controller.recenter({ target: 'b', move: { from: 'e2', to: 'e4' } }), false);
  assert.equal(controller.snapshot.center, 'A');
});
