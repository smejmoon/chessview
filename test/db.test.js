import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';

globalThis.indexedDB = fakeIndexedDB;
const { clearGraph } = await import('../src/db.js');
const { getOutgoing, mutateEdge, putEdges } = await import('../src/edge-store.js');

test('atomic edge mutation serializes concurrent explicit promotion and rewrite', async () => {
  await clearGraph();
  const edge = {
    id: 'source|e2e4|target',
    source: 'source',
    target: 'target',
    uci: 'e2e4',
    san: 'e4',
    explicit: false,
  };
  await putEdges([edge]);

  await Promise.all([
    mutateEdge(edge.id, (existing) => ({ ...existing, explicit: true })),
    mutateEdge(edge.id, (existing) => ({ ...existing, san: existing?.san ?? 'e4' })),
  ]);

  const [stored] = await getOutgoing('source');
  assert.equal(stored.explicit, true);
  assert.equal(stored.san, 'e4');
});
