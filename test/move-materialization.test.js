import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBObjectStore, indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { canonicalPosition, edgeId, resolveMove, START_FEN } from '../src/graph.js';

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

const { clearGraph, getOutgoing, putEdges } = await import('../src/db.js');
const { materializeMove } = await import('../src/move-materialization.js');
const { positionRepository } = await import('../src/position-repository.js');

const center = canonicalPosition(START_FEN);

function assertCanonicalStoredShape(edge) {
  assert.equal('games' in edge, false);
  assert.equal('share' in edge, false);
  assert.equal('qualifies' in edge, false);
  assert.equal('updatedAt' in edge, false);
  assert.equal('manual' in edge, false);
  assert.equal('derived' in edge, false);
}

test('materializing a legal move creates an explicit durable edge and target position without Explorer evidence', async () => {
  await clearGraph();
  const resolved = resolveMove(center, { uci: 'e2e4' });

  const result = await materializeMove({
    source: center,
    move: { from: 'e2', to: 'e4' },
  });

  assert.equal(result.target, resolved.target);
  assert.equal(result.edge.source, center);
  assert.equal(result.edge.target, resolved.target);
  assert.equal(result.edge.uci, 'e2e4');
  assert.equal(result.edge.explicit, true);
  assertCanonicalStoredShape(result.edge);
  assert.ok((await getOutgoing(center)).some((edge) => edge.id === result.edge.id));
  assert.equal((await positionRepository.get(resolved.target))?.fen, resolved.fen);
});

test('materializing an existing edge scrubs legacy state while establishing explicit materialization', async () => {
  await clearGraph();
  const resolved = resolveMove(center, { uci: 'e2e4' });
  const existing = {
    id: '',
    source: center,
    target: resolved.target,
    uci: resolved.uci,
    san: resolved.san,
    games: 600,
    share: 0.6,
    qualifies: true,
    manual: false,
    derived: true,
    updatedAt: 1,
  };
  existing.id = edgeId(existing);
  await putEdges([existing]);

  await materializeMove({
    source: center,
    move: { from: 'e2', to: 'e4' },
  });

  const stored = (await getOutgoing(center)).find((edge) => edge.id === existing.id);
  assert.equal(stored.explicit, true);
  assertCanonicalStoredShape(stored);
});

test('target position exists before the durable move edge is written', async () => {
  await clearGraph();
  const resolved = resolveMove(center, { uci: 'e2e4' });
  const originalPut = IDBObjectStore.prototype.put;
  let observedTarget = null;

  IDBObjectStore.prototype.put = function put(value, ...args) {
    if (this.name === 'edges' && value?.target === resolved.target) {
      const request = this.transaction.db.transaction('nodes').objectStore('nodes').get(resolved.target);
      request.onsuccess = () => { observedTarget = request.result ?? null; };
    }
    return originalPut.call(this, value, ...args);
  };

  try {
    await materializeMove({ source: center, move: { from: 'e2', to: 'e4' } });
  } finally {
    IDBObjectStore.prototype.put = originalPut;
  }

  assert.equal(observedTarget?.key, resolved.target);
  assert.equal(observedTarget?.fen, resolved.fen);
});
