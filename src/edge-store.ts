import {
  EDGE_SOURCE_INDEX,
  EDGE_TARGET_INDEX,
  EDGES_STORE,
} from './cache-schema.ts';
import {
  openDb,
  requestAsPromise,
  transactionAsPromise,
} from './indexed-db.ts';

export interface StoredEdge {
  id: string;
  source: string;
  target: string;
  uci: string;
  san: string;
  explicit?: boolean;
}

export type EdgeMutation = (existing: StoredEdge | null) => StoredEdge | null;

type EdgeIndexName = typeof EDGE_SOURCE_INDEX | typeof EDGE_TARGET_INDEX;

export async function putEdges(edges: readonly StoredEdge[]): Promise<void> {
  if (!edges.length) return;
  const db = await openDb();
  const transaction = db.transaction(EDGES_STORE, 'readwrite');
  const store = transaction.objectStore(EDGES_STORE);
  edges.forEach((edge) => store.put(edge));
  await transactionAsPromise(transaction);
}

export async function mutateEdge(id: string, update: EdgeMutation): Promise<StoredEdge | null> {
  const db = await openDb();
  const transaction = db.transaction(EDGES_STORE, 'readwrite');
  const store = transaction.objectStore(EDGES_STORE);
  const existing = (await requestAsPromise<StoredEdge | undefined>(store.get(id))) ?? null;
  const value = update(existing);
  if (value != null) store.put(value);
  return transactionAsPromise(transaction, value ?? null);
}

async function getByIndex(indexName: EdgeIndexName, value: string): Promise<StoredEdge[]> {
  const db = await openDb();
  const transaction = db.transaction(EDGES_STORE);
  return requestAsPromise<StoredEdge[]>(
    transaction.objectStore(EDGES_STORE).index(indexName).getAll(value),
  );
}

export function getOutgoing(key: string): Promise<StoredEdge[]> {
  return getByIndex(EDGE_SOURCE_INDEX, key);
}

export function getIncoming(key: string): Promise<StoredEdge[]> {
  return getByIndex(EDGE_TARGET_INDEX, key);
}
