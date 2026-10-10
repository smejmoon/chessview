import { canonicalPosition } from './graph.ts';
import { explorerProvider } from './explorer.ts';
import { positionRepository } from './position-repository.ts';
import { clearExplorerCacheFields } from './position-store.ts';

// Terminal maintenance: the caller reloads the page after this completes.
export async function clearExplorerCache(
  positions?: readonly string[],
  {
    repository = positionRepository,
    explorer = explorerProvider,
    clearStored = clearExplorerCacheFields,
  }: {
    repository?: Pick<typeof positionRepository, 'quiesceForMaintenance'>;
    explorer?: Pick<typeof explorerProvider, 'invalidate'>;
    clearStored?: typeof clearExplorerCacheFields;
  } = {},
): Promise<void> {
  const canonical = positions
    ? [...new Set(positions.map((position) => canonicalPosition(position)))]
    : undefined;
  await repository.quiesceForMaintenance();
  explorer.invalidate(canonical);
  await clearStored(canonical);
}
