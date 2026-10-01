const DB_NAME = 'chessview';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
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
