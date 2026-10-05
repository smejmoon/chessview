import { NODES_STORE } from './cache-schema.ts';
import {
  openDb,
  requestAsPromise,
  transactionAsPromise,
} from './indexed-db.ts';

export interface StoredPosition {
  key: string;
  [field: string]: unknown;
}

let nodeVersion = 0;

export function nodeStoreVersion(): number {
  return nodeVersion;
}

export function invalidateNodeStore(): void {
  nodeVersion += 1;
}

function withoutExplorerCache(node: StoredPosition): StoredPosition {
  const {
    explorer: _explorer,
    explorerFetchedAt: _explorerFetchedAt,
    games: _games,
    opening: _opening,
    ...rest
  } = node;
  return rest;
}

export async function clearExplorerCacheFields(keys?: readonly string[]): Promise<void> {
  const db = await openDb();
  const transaction = db.transaction(NODES_STORE, 'readwrite');
  const done = transactionAsPromise(transaction);
  const store = transaction.objectStore(NODES_STORE);

  if (keys) {
    const unique = [...new Set(keys)];
    await Promise.all(unique.map(async (key) => {
      const node = await requestAsPromise<StoredPosition | undefined>(store.get(key));
      if (node) store.put(withoutExplorerCache(node));
    }));
  } else {
    await new Promise<void>((resolve, reject) => {
      const request = store.openCursor();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }
        cursor.update(withoutExplorerCache(cursor.value as StoredPosition));
        cursor.continue();
      };
    });
  }

  await done;
  invalidateNodeStore();
}

export async function getNode(key: string): Promise<StoredPosition | undefined> {
  const db = await openDb();
  return requestAsPromise<StoredPosition | undefined>(
    db.transaction(NODES_STORE).objectStore(NODES_STORE).get(key),
  );
}

export async function putNode<T extends StoredPosition>(node: T): Promise<T> {
  const db = await openDb();
  const transaction = db.transaction(NODES_STORE, 'readwrite');
  transaction.objectStore(NODES_STORE).put(node);
  await transactionAsPromise(transaction);
  invalidateNodeStore();
  return node;
}
