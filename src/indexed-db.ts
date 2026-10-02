const DB_NAME = 'chessview-cache-v1';
const DB_VERSION = 1;
const METADATA_STORE = 'metadata';
const CACHE_SCHEMA_KEY = 'store-schemas';

const CACHE_SCHEMA_VERSIONS = {
  nodes: 1,
  edges: 2,
} as const;

type CacheStoreName = keyof typeof CACHE_SCHEMA_VERSIONS;

type CacheSchemaRecord = Readonly<{
  key: typeof CACHE_SCHEMA_KEY;
  versions?: Partial<Record<CacheStoreName, unknown>>;
}>;

let dbPromise: Promise<IDBDatabase> | null = null;

function createStores(db: IDBDatabase, transaction: IDBTransaction): void {
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

  if (!db.objectStoreNames.contains(METADATA_STORE)) {
    db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
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
