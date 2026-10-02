import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';

globalThis.indexedDB = fakeIndexedDB;

function seedVersionOneEdges(edges) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('chessview', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('nodes', { keyPath: 'key' });
      const edgeStore = db.createObjectStore('edges', { keyPath: 'id' });
      edgeStore.createIndex('source', 'source', { unique: false });
      edgeStore.createIndex('target', 'target', { unique: false });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('edges', 'readwrite');
      const store = transaction.objectStore('edges');
      edges.forEach((edge) => store.put(edge));
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    };
  });
}

test('version 2 migration keeps explicit materialization and strips legacy edge state', async () => {
  await seedVersionOneEdges([
    {
      id: 'source|e2e4|target-a',
      source: 'source',
      target: 'target-a',
      uci: 'e2e4',
      san: 'e4',
      games: 600,
      share: 0.6,
      qualifies: true,
      manual: true,
      derived: true,
      updatedAt: 123,
    },
    {
      id: 'source|d2d4|target-b',
      source: 'source',
      target: 'target-b',
      uci: 'd2d4',
      san: 'd4',
      games: 300,
      manual: false,
      derived: true,
    },
  ]);

  const { getOutgoing } = await import('../src/edge-store.js');
  const stored = (await getOutgoing('source')).sort((a, b) => a.uci.localeCompare(b.uci));

  assert.deepEqual(stored, [
    {
      id: 'source|d2d4|target-b',
      source: 'source',
      target: 'target-b',
      uci: 'd2d4',
      san: 'd4',
      explicit: false,
    },
    {
      id: 'source|e2e4|target-a',
      source: 'source',
      target: 'target-a',
      uci: 'e2e4',
      san: 'e4',
      explicit: true,
    },
  ]);
});
