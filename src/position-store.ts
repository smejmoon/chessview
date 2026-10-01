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

export async function getNode(key: string): Promise<StoredPosition | undefined> {
  const db = await openDb();
  return requestAsPromise<StoredPosition | undefined>(
    db.transaction('nodes').objectStore('nodes').get(key),
  );
}

export async function putNode<T extends StoredPosition>(node: T): Promise<T> {
  const db = await openDb();
  const transaction = db.transaction('nodes', 'readwrite');
  transaction.objectStore('nodes').put(node);
  await transactionAsPromise(transaction);
  invalidateNodeStore();
  return node;
}
