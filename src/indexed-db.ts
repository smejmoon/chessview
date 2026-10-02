const DB_NAME = 'chessview';
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

type LegacyEdgeRecord = Readonly<Record<string, unknown> & {
  id?: unknown;
  source?: unknown;
  target?: unknown;
  uci?: unknown;
  san?: unknown;
  explicit?: unknown;
  manual?: unknown;
}>;

function migrateEdgesToVersion2(store: IDBObjectStore): void {
  const request = store.openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;

    const edge = cursor.value as LegacyEdgeRecord;
    cursor.update({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      uci: edge.uci,
      san: edge.san,
      explicit: Boolean(edge.explicit || edge.manual),
    });
    cursor.continue();
  };
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = request.result;
      const transaction = request.transaction;
      if (!transaction) throw new Error('IndexedDB upgrade transaction is unavailable');

      if (!db.objectStoreNames.contains('nodes')) {
        db.createObjectStore('nodes', { keyPath: 'key' });
      }

      let edges: IDBObjectStore;
      if (!db.objectStoreNames.contains('edges')) {
        edges = db.createObjectStore('edges', { keyPath: 'id' });
      } else {
        edges = transaction.objectStore('edges');
      }
      if (!edges.indexNames.contains('source')) {
        edges.createIndex('source', 'source', { unique: false });
      }
      if (!edges.indexNames.contains('target')) {
        edges.createIndex('target', 'target', { unique: false });
      }

      if (event.oldVersion > 0 && event.oldVersion < 2) {
        migrateEdgesToVersion2(edges);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

export function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionAsPromise(transaction: IDBTransaction): Promise<void>;
export function transactionAsPromise<T>(transaction: IDBTransaction, value: T): Promise<T>;
export function transactionAsPromise<T>(transaction: IDBTransaction, value?: T): Promise<T | void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(value);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function clearStores(storeNames: string[]): Promise<void> {
  const db = await openDb();
  const transaction = db.transaction(storeNames, 'readwrite');
  for (const storeName of storeNames) transaction.objectStore(storeName).clear();
  await transactionAsPromise(transaction);
}
