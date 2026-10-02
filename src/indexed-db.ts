import {
  CACHE_SCHEMA_KEY,
  CACHE_SCHEMA_VERSIONS,
  EDGE_SOURCE_INDEX,
  EDGE_TARGET_INDEX,
  EDGES_KEY_PATH,
  EDGES_STORE,
  METADATA_KEY_PATH,
  METADATA_STORE,
  NODES_KEY_PATH,
  NODES_STORE,
  type CacheSchemaRecord,
  type CacheStoreName,
} from './cache-schema.ts';
import { DB_NAME, DB_VERSION } from './indexed-db-identity.ts';

let dbPromise: Promise<IDBDatabase> | null = null;

function createStores(db: IDBDatabase, transaction: IDBTransaction): void {
  if (!db.objectStoreNames.contains(NODES_STORE)) {
    db.createObjectStore(NODES_STORE, { keyPath: NODES_KEY_PATH });
  }

  let edges: IDBObjectStore;
  if (!db.objectStoreNames.contains(EDGES_STORE)) {
    edges = db.createObjectStore(EDGES_STORE, { keyPath: EDGES_KEY_PATH });
  } else {
    edges = transaction.objectStore(EDGES_STORE);
  }
  if (!edges.indexNames.contains(EDGE_SOURCE_INDEX)) {
    edges.createIndex(EDGE_SOURCE_INDEX, EDGE_SOURCE_INDEX, { unique: false });
  }
  if (!edges.indexNames.contains(EDGE_TARGET_INDEX)) {
    edges.createIndex(EDGE_TARGET_INDEX, EDGE_TARGET_INDEX, { unique: false });
  }

  if (!db.objectStoreNames.contains(METADATA_STORE)) {
    db.createObjectStore(METADATA_STORE, { keyPath: METADATA_KEY_PATH });
  }
}

function currentSchemaRecord(): CacheSchemaRecord {
  return {
    key: CACHE_SCHEMA_KEY,
    versions: { ...CACHE_SCHEMA_VERSIONS },
  };
}

async function ensureCacheSchemas(db: IDBDatabase): Promise<void> {
  const storeNames = Object.keys(CACHE_SCHEMA_VERSIONS) as CacheStoreName[];
  const transaction = db.transaction([METADATA_STORE, ...storeNames], 'readwrite');
  const metadata = transaction.objectStore(METADATA_STORE);
  const request = metadata.get(CACHE_SCHEMA_KEY);

  request.onsuccess = () => {
    const record = request.result as CacheSchemaRecord | undefined;
    const storedVersions = record?.versions ?? {};

    for (const storeName of storeNames) {
      if (storedVersions[storeName] !== CACHE_SCHEMA_VERSIONS[storeName]) {
        transaction.objectStore(storeName).clear();
      }
    }

    metadata.put(currentSchemaRecord());
  };

  await transactionAsPromise(transaction);
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const transaction = request.transaction;
      if (!transaction) throw new Error('IndexedDB upgrade transaction is unavailable');
      createStores(request.result, transaction);
    };
    request.onsuccess = async () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };

      try {
        await ensureCacheSchemas(db);
        resolve(db);
      } catch (error) {
        db.close();
        dbPromise = null;
        reject(error);
      }
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
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
