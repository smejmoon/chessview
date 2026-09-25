import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';

globalThis.indexedDB = fakeIndexedDB;
const { clearGraph, getOutgoing, putEdges, replaceExplorerEdges } = await import('../src/db.js');

test('Explorer refresh removes stale automatic edges and preserves manual state', async () => {
  await clearGraph();
  await putEdges([
    { id: 'source|a|x', source: 'source', target: 'x', uci: 'a', manual: false, share: 0.4, qualifies: true },
    { id: 'source|b|y', source: 'source', target: 'y', uci: 'b', manual: true, share: 0, qualifies: false },
    { id: 'source|c|z', source: 'source', target: 'z', uci: 'c', manual: true, share: 0, qualifies: false },
  ]);

  await replaceExplorerEdges('source', [
    { id: 'source|c|z', source: 'source', target: 'z', uci: 'c', manual: false, share: 0.2, qualifies: true },
    { id: 'source|d|q', source: 'source', target: 'q', uci: 'd', manual: false, share: 0.1, qualifies: true },
  ]);

  const edges = (await getOutgoing('source')).sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(edges.map((edge) => edge.id), ['source|b|y', 'source|c|z', 'source|d|q']);
  assert.equal(edges.find((edge) => edge.id === 'source|c|z').manual, true);
  assert.equal(edges.find((edge) => edge.id === 'source|c|z').share, 0.2);
  assert.equal(edges.find((edge) => edge.id === 'source|b|y').manual, true);
});
