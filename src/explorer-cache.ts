import { canonicalPosition } from './graph.ts';
import { explorerProvider } from './explorer.ts';
import { clearExplorerCacheFields } from './position-store.ts';

export async function clearExplorerCache(positions?: readonly string[]): Promise<void> {
  const canonical = positions
    ? [...new Set(positions.map((position) => canonicalPosition(position)))]
    : undefined;
  explorerProvider.invalidate(canonical);
  await clearExplorerCacheFields(canonical);
}
