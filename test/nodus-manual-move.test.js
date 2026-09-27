import assert from 'node:assert/strict';
import test from 'node:test';
import { NodusController } from '../src/nodus-controller.js';

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

function fixture(manualMove) {
  const calls = [];
  const presenter = {
    start() {},
    update() {},
  };
  const controller = new NodusController({
    initial: { center: 'A', view: 'roots', orientation: 'white', navDepth: 0 },
    canonicalize: (value) => String(value).toUpperCase(),
    routeLedger: {
      replace(route) { calls.push(['replace', route]); },
      push(route) { calls.push(['push', route]); },
    },
    structure: async ({ center, mode }) => ({ composition: { center, direction: mode } }),
    manualMove,
    presenter,
  });
  return { controller, calls };
}

test('manual board moves enter through the controller before navigation', async () => {
  const seen = [];
  const { controller, calls } = fixture(async (request) => {
    seen.push(request);
    return { target: 'b' };
  });

  await controller.start();
  const publication = controller.playMove('e2', 'e4', 'q');
  assert.equal(await publication, true);

  assert.deepEqual(seen, [{ source: 'A', from: 'e2', to: 'e4', promotion: 'q' }]);
  assert.equal(controller.snapshot.center, 'B');
  assert.ok(calls.some(([name, route]) => name === 'push' && route.center === 'B'));
});

test('a stale manual-move result cannot recenter a replacement view', async () => {
  const pending = deferred();
  const { controller } = fixture(async () => pending.promise);

  await controller.start();
  const move = controller.playMove('e2', 'e4');
  await controller.navigate('c');
  pending.resolve({ target: 'b' });

  assert.equal(await move, false);
  assert.equal(controller.snapshot.center, 'C');
});
