import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { canonicalPosition, resolveMove } from '../src/graph.ts';

globalThis.indexedDB = fakeIndexedDB;

globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {},
};
globalThis.sessionStorage = globalThis.localStorage;
globalThis.window = { location: { href: 'https://example.test/chessview/', search: '' } };
globalThis.history = { state: null, replaceState() {} };

const { clearGraph } = await import('../src/db.ts');
const { materializeMove } = await import('../src/move-materialization.ts');

const source = canonicalPosition('k7/4P3/8/8/8/8/8/7K w - - 0 1');

for (const promotion of ['q', 'r', 'b', 'n']) {
  test(`materialized ${promotion} promotion preserves its distinct move and target`, async () => {
    await clearGraph();
    const expected = resolveMove(source, { from: 'e7', to: 'e8', promotion });
    const result = await materializeMove({
      source,
      move: { from: 'e7', to: 'e8', promotion },
    });

    assert.equal(result?.edge.uci, `e7e8${promotion}`);
    assert.equal(result?.target, expected.target);
  });
}

test('promotion without a selected piece is rejected instead of defaulting to queen', async () => {
  await clearGraph();
  const result = await materializeMove({
    source,
    move: { from: 'e7', to: 'e8' },
  });
  assert.equal(result, null);
});
