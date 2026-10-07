import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';

import { canonicalPosition, edgeId, resolveMove, START_FEN } from '../src/graph.ts';

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

const { clearGraph, getOutgoing, putEdges, putNode } = await import('../src/db.ts');
const { composeNodusStructure } = await import('../src/nodus-structure.ts');

const CENTER = canonicalPosition(START_FEN);

function explicitEdge(uci) {
  const resolved = resolveMove(CENTER, { uci });
  const edge = {
    id: '',
    source: CENTER,
    target: resolved.target,
    uci: resolved.uci,
    san: resolved.san,
    explicit: true,
  };
  edge.id = edgeId(edge);
  return edge;
}

test('explicit materialization stays navigation-only unless current Prevalence creates a Candidate', async () => {
  await clearGraph();
  const evidenced = explicitEdge('e2e4');
  const explicitOnly = explicitEdge('h2h3');
  await putEdges([evidenced, explicitOnly]);
  await putNode({
    key: CENTER,
    fen: START_FEN,
    explorer: {
      white: 1000,
      draws: 0,
      black: 0,
      moves: [{ uci: evidenced.uci, white: 600, draws: 0, black: 0 }],
    },
    explorerFetchedAt: Date.now(),
    games: 1000,
  });

  globalThis.fetch = async () => { throw new Error('fresh Explorer cache should avoid network'); };

  const structure = await composeNodusStructure({ center: CENTER, mode: 'lines', lineMax: 3 });
  const relationships = structure.composition.relationships;

  assert.deepEqual(relationships.map((relationship) => relationship.edge.uci), [evidenced.uci]);
  assert.equal(relationships[0].edge.explicit, true);
  assert.equal(structure.composition.families[0].lineShare, 0.6);

  const stored = await getOutgoing(CENTER);
  assert.equal(stored.some((edge) => edge.uci === explicitOnly.uci && edge.explicit), true);
  assert.equal(relationships.some((relationship) => relationship.edge.uci === explicitOnly.uci), false);
});
