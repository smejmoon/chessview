import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';

globalThis.indexedDB = fakeIndexedDB;
const { clearGraph, getOutgoing, putEdges, putManualEdge, replaceExplorerEdges } = await import('../src/db.js');

test('Explorer refresh removes stale automatic edges and preserves manual and derived state', async () => {
  await clearGraph();
  await putEdges([
    { id: 'source|a|x', source: 'source', target: 'x', uci: 'a', manual: false, derived: false, share: 0.4, qualifies: true },
    { id: 'source|b|y', source: 'source', target: 'y', uci: 'b', manual: true, derived: false, share: 0, qualifies: false },
    { id: 'source|c|z', source: 'source', target: 'z', uci: 'c', manual: true, derived: false, share: 0, qualifies: false },
    { id: 'source|t|v', source: 'source', target: 'v', uci: 't', manual: false, derived: true, share: 0, qualifies: false },
  ]);

  await replaceExplorerEdges('source', [
    { id: 'source|c|z', source: 'source', target: 'z', uci: 'c', manual: false, derived: false, share: 0.2, qualifies: true },
    { id: 'source|d|q', source: 'source', target: 'q', uci: 'd', manual: false, derived: false, share: 0.1, qualifies: true },
  ]);

  const edges = (await getOutgoing('source')).sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(edges.map((edge) => edge.id), ['source|b|y', 'source|c|z', 'source|d|q', 'source|t|v']);
  assert.equal(edges.find((edge) => edge.id === 'source|c|z').manual, true);
  assert.equal(edges.find((edge) => edge.id === 'source|c|z').share, 0.2);
  assert.equal(edges.find((edge) => edge.id === 'source|b|y').manual, true);
  assert.equal(edges.find((edge) => edge.id === 'source|t|v').derived, true);
});

test('marking an existing Explorer edge manual preserves its evidence', async () => {
  await clearGraph();
  await putEdges([
    {
      id: 'source|e2e4|target',
      source: 'source',
      target: 'target',
      uci: 'e2e4',
      san: 'e4',
      games: 600,
      share: 0.6,
      qualifies: true,
      manual: false,
      derived: false,
      updatedAt: 1,
    },
  ]);

  const promoted = await putManualEdge({
    id: 'source|e2e4|target',
    source: 'source',
    target: 'target',
    uci: 'e2e4',
    san: 'e4',
    games: 0,
    share: 0,
    qualifies: false,
    manual: true,
    updatedAt: 2,
  });

  assert.equal(promoted.manual, true);
  assert.equal(promoted.games, 600);
  assert.equal(promoted.share, 0.6);
  assert.equal(promoted.qualifies, true);

  const [stored] = await getOutgoing('source');
  assert.equal(stored.manual, true);
  assert.equal(stored.games, 600);
  assert.equal(stored.share, 0.6);
  assert.equal(stored.qualifies, true);
});
