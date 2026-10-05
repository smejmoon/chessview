import { canonicalPosition } from './graph.js';
import { explorerProvider } from './explorer.js';
import { clearExplorerCacheFields } from './position-store.ts';

export async function clearExplorerCache(positions?: readonly string[]): Promise<void> {
  const canonical = positions
    ? [...new Set(positions.map((position) => canonicalPosition(position)))]
    : undefined;
  explorerProvider.invalidate(canonical);
  await clearExplorerCacheFields(canonical);
}
