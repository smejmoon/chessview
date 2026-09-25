const DB_NAME = 'chessview';
const DB_VERSION = 1;

let dbPromise;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('nodes')) {
        db.createObjectStore('nodes', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('edges')) {
        const edges = db.createObjectStore('edges', { keyPath: 'id' });
        edges.createIndex('source', 'source', { unique: false });
        edges.createIndex('target', 'target', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getNode(key) {
  const db = await openDb();
  return requestAsPromise(db.transaction('nodes').objectStore('nodes').get(key));
}

export async function putNode(node) {
  const db = await openDb();
  const tx = db.transaction('nodes', 'readwrite');
  tx.objectStore('nodes').put(node);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(node);
    tx.onerror = () => reject(tx.error);
  });
}

export async function putEdges(edges) {
  if (!edges.length) return;
  const db = await openDb();
  const tx = db.transaction('edges', 'readwrite');
  const store = tx.objectStore('edges');
  edges.forEach((edge) => store.put(edge));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function replaceExplorerEdges(source, edges) {
  const db = await openDb();
  const tx = db.transaction('edges', 'readwrite');
  const store = tx.objectStore('edges');
  const index = store.index('source');
  const pending = new Map(edges.map((edge) => [edge.id, edge]));

  await new Promise((resolve, reject) => {
    const request = index.openCursor(source);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        for (const edge of pending.values()) store.put(edge);
        resolve();
        return;
      }

      const existing = cursor.value;
      const incoming = pending.get(existing.id);
      if (incoming) {
        store.put({ ...incoming, manual: Boolean(existing.manual || incoming.manual) });
        pending.delete(existing.id);
      } else if (!existing.manual) {
        cursor.delete();
      }
      cursor.continue();
    };
  });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function getByIndex(indexName, value) {
  const db = await openDb();
  const tx = db.transaction('edges');
  return requestAsPromise(tx.objectStore('edges').index(indexName).getAll(value));
}

export function getOutgoing(key) {
  return getByIndex('source', key);
}

export function getIncoming(key) {
  return getByIndex('target', key);
}

export async function clearGraph() {
  const db = await openDb();
  const tx = db.transaction(['nodes', 'edges'], 'readwrite');
  tx.objectStore('nodes').clear();
  tx.objectStore('edges').clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
