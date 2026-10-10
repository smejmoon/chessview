import { debugLog } from './debug.ts';
import { loadExplorerReading } from './explorer.ts';
import {
  classifyExplorerRefinementFailure,
  type ExplorerRefinementFailureClassifier,
} from './explorer-refinement.ts';
import {
  refineExplorerReading,
  type ExplorerRefinementRunOutcome,
} from './knowledge-acquisition.ts';
import {
  discoverSampledPredecessors,
  sampleGameIds,
  type PredecessorNomination,
} from './sampled-predecessors.ts';
import type { ProducerWork } from './work-demand.ts';

type ExplorerReading = Awaited<ReturnType<typeof loadExplorerReading>>;
type LoadExplorer = (center: string, work: ProducerWork) => Promise<ExplorerReading>;
type DiscoverPredecessors = (
  center: string,
  gameIds: readonly string[],
  work: ProducerWork,
) => Promise<readonly PredecessorNomination[]>;
type RefineExplorer = (
  position: string,
  work: ProducerWork,
) => Promise<ExplorerRefinementRunOutcome>;
type Log = (event: string, detail?: unknown) => unknown;

type RootDiscoveryDependencies = Readonly<{
  loadExplorer?: LoadExplorer;
  discoverPredecessors?: DiscoverPredecessors;
  refineExplorer?: RefineExplorer;
  classifyExplorerFailure?: ExplorerRefinementFailureClassifier;
  log?: Log;
}>;

export async function discoverRootPredecessors(
  center: string,
  work: ProducerWork,
  {
    loadExplorer = loadExplorerReading,
    discoverPredecessors = discoverSampledPredecessors,
    refineExplorer = refineExplorerReading,
    classifyExplorerFailure = classifyExplorerRefinementFailure,
    log = debugLog,
  }: RootDiscoveryDependencies = {},
): Promise<ExplorerRefinementRunOutcome> {
  let reading: ExplorerReading;
  try {
    reading = await loadExplorer(center, work);
  } catch (error: unknown) {
    const outcome = classifyExplorerFailure(error);
    if (outcome) return outcome;
    throw error;
  }

  const ids = sampleGameIds(reading);
  if (!ids.length) return Object.freeze({ refinement: 'satisfied' as const });

  log('Root discovery replaying sampled games', { center, games: ids.length });
  const nominations = await discoverPredecessors(center, ids, work);
  let unavailable = false;
  for (const nomination of nominations) {
    if (work.signal.aborted) return Object.freeze({ refinement: 'unavailable' as const });
    const outcome = await refineExplorer(nomination.source, work);
    if (outcome.refinement === 'unavailable') unavailable = true;
  }
  return unavailable
    ? Object.freeze({ refinement: 'unavailable' as const })
    : Object.freeze({ refinement: 'satisfied' as const });
}
