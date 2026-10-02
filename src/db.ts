import { EDGES_STORE, NODES_STORE } from './cache-schema.ts';
import { clearStores } from './indexed-db.ts';
import { invalidateNodeStore } from './position-store.ts';

// Test/maintenance surface. Application persistence should use
// PositionRepository/PositionGraph, whose adapters live in position-store.ts and
// edge-store.ts respectively.
export { getNode, nodeStoreVersion, putNode } from './position-store.ts';
export { getIncoming, getOutgoing, mutateEdge, putEdges } from './edge-store.ts';

export async function clearGraph(): Promise<void> {
  await clearStores([NODES_STORE, EDGES_STORE]);
  invalidateNodeStore();
}
