import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';

globalThis.indexedDB = fakeIndexedDB;

function seedCache() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('chessview-cache-v1', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('nodes', { keyPath: 'key' });
      const edgeStore = db.createObjectStore('edges', { keyPath: 'id' });
      edgeStore.createIndex('source', 'source', { unique: false });
      edgeStore.createIndex('target', 'target', { unique: false });
      db.createObjectStore('metadata', { keyPath: 'key' });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['nodes', 'edges', 'metadata'], 'readwrite');
      transaction.objectStore('nodes').put({ key: 'position-a', fen: 'cached-fen' });
      transaction.objectStore('edges').put({
        id: 'source|e2e4|target',
        source: 'source',
        target: 'target',
        uci: 'e2e4',
        san: 'e4',
        manual: true,
      });
      transaction.objectStore('metadata').put({
        key: 'store-schemas',
        versions: {
          nodes: 1,
          edges: 1,
        },
      });
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    };
  });
}

test('schema mismatch clears only the incompatible cache store', async () => {
  await seedCache();

  const { getNode } = await import('../src/position-store.ts');
  const { getOutgoing } = await import('../src/edge-store.ts');

  assert.deepEqual(await getNode('position-a'), {
    key: 'position-a',
    fen: 'cached-fen',
  });
  assert.deepEqual(await getOutgoing('source'), []);

  const request = indexedDB.open('chessview-cache-v1', 1);
  const db = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const metadataRequest = db.transaction('metadata').objectStore('metadata').get('store-schemas');
  const metadata = await new Promise((resolve, reject) => {
    metadataRequest.onsuccess = () => resolve(metadataRequest.result);
    metadataRequest.onerror = () => reject(metadataRequest.error);
  });
  db.close();

  assert.deepEqual(metadata, {
    key: 'store-schemas',
    versions: {
      nodes: 1,
      edges: 2,
    },
  });
});
