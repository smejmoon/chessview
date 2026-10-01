import {
  openDb,
  requestAsPromise,
  transactionAsPromise,
} from './indexed-db.ts';

export interface StoredEdge {
  id: string;
  source: string;
  target: string;
  [field: string]: unknown;
}

export type EdgeMutation = (existing: StoredEdge | null) => StoredEdge | null;

type EdgeIndexName = 'source' | 'target';

export async function putEdges(edges: readonly StoredEdge[]): Promise<void> {
  if (!edges.length) return;
  const db = await openDb();
  const transaction = db.transaction('edges', 'readwrite');
  const store = transaction.objectStore('edges');
  edges.forEach((edge) => store.put(edge));
  await transactionAsPromise(transaction);
}

export async function mutateEdge(id: string, update: EdgeMutation): Promise<StoredEdge | null> {
  const db = await openDb();
  const transaction = db.transaction('edges', 'readwrite');
  const store = transaction.objectStore('edges');
  const existing = (await requestAsPromise<StoredEdge | undefined>(store.get(id))) ?? null;
  const value = update(existing);
  if (value != null) store.put(value);
  return transactionAsPromise(transaction, value ?? null);
}

async function getByIndex(indexName: EdgeIndexName, value: string): Promise<StoredEdge[]> {
  const db = await openDb();
  const transaction = db.transaction('edges');
  return requestAsPromise<StoredEdge[]>(
    transaction.objectStore('edges').index(indexName).getAll(value),
  );
}

export function getOutgoing(key: string): Promise<StoredEdge[]> {
  return getByIndex('source', key);
}

export function getIncoming(key: string): Promise<StoredEdge[]> {
  return getByIndex('target', key);
}
