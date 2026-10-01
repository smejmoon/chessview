import { clearStores } from './indexed-db.js';
import { invalidateNodeStore } from './position-store.js';

// Compatibility and test/maintenance surface. Application persistence should use
// PositionRepository/PositionGraph, whose adapters live in position-store.js and
// edge-store.js respectively.
export { getNode, nodeStoreVersion, putNode } from './position-store.js';
export { getIncoming, getOutgoing, mutateEdge, putEdges } from './edge-store.js';

export async function clearGraph() {
  await clearStores(['nodes', 'edges']);
  invalidateNodeStore();
}
