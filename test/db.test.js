import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';

globalThis.indexedDB = fakeIndexedDB;
const { clearGraph, getOutgoing, mutateEdge, putEdges } = await import('../src/db.js');

test('atomic edge mutation serializes concurrent read/modify/write updates', async () => {
  await clearGraph();
  const edge = {
    id: 'source|e2e4|target',
    source: 'source',
    target: 'target',
    uci: 'e2e4',
    games: 600,
    share: 0.6,
    qualifies: true,
    manual: false,
    derived: false,
  };
  await putEdges([edge]);

  await Promise.all([
    mutateEdge(edge.id, (existing) => ({ ...existing, manual: true })),
    mutateEdge(edge.id, (existing) => ({ ...existing, derived: true })),
  ]);

  const [stored] = await getOutgoing('source');
  assert.equal(stored.manual, true);
  assert.equal(stored.derived, true);
  assert.equal(stored.games, 600);
  assert.equal(stored.share, 0.6);
});
