import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { canonicalPosition, resolveMove, START_FEN } from '../src/graph.ts';
import { CurrentViewController } from '../src/current-view-controller.ts';

globalThis.indexedDB = fakeIndexedDB;

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.window = { location: { href: 'https://example.test/chessview/', search: '' } };
globalThis.history = { state: null, replaceState() {} };

const { clearGraph, getOutgoing } = await import('../src/db.ts');
const { materializeMove } = await import('../src/move-materialization.ts');

const START = canonicalPosition(START_FEN);

test('a played legal move outside current Constellation selection recenters without replacing ChartedGraph knowledge', async () => {
  await clearGraph();
  const resolved = resolveMove(START, { uci: 'e2e4' });
  const compositions = [];
  const controller = new CurrentViewController({
    initial: { center: START, view: 'roots', orientation: 'white', navDepth: 0 },
    canonicalize: canonicalPosition,
    routeLedger: { replace() {}, push() {} },
    structure: async ({ center, mode }) => {
      const composition = { center, direction: mode, nodes: [{ key: center }] };
      compositions.push(composition);
      return { composition };
    },
    materializeMove,
    presenter: { start() {}, update() {} },
  });

  await controller.start();
  assert.equal(compositions.some(({ center, nodes }) => center === START && nodes.some(({ key }) => key === resolved.target)), false);
  assert.equal((await getOutgoing(START)).some(({ target }) => target === resolved.target), false);

  assert.equal(await controller.recenter({ move: { from: 'e2', to: 'e4' } }), true);
  assert.equal(controller.snapshot.center, resolved.target);

  const established = (await getOutgoing(START)).find(({ target }) => target === resolved.target);
  assert.ok(established);
  assert.equal(established.explicit, true);
  assert.equal('manual' in established, false);
  assert.equal('derived' in established, false);

  assert.equal(await controller.recenter({ target: START }), true);
  const afterRecenter = (await getOutgoing(START)).find(({ id }) => id === established.id);
  assert.deepEqual(afterRecenter, established);
});
