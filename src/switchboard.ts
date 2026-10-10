import type { RefinementInput, RefinementTask } from './current-view-controller.ts';
import { deriveCurrentViewRefinementDemand } from './current-view-refinement.ts';
import { refineExplorerReading } from './knowledge-acquisition.ts';
import { discoverRootPredecessors } from './root-bootstrap.ts';
import { loadMasters } from './masters.ts';
import { lichessEval } from './lichess-eval.ts';
import { rootTranspositionEnricher } from './root-enrichment.ts';

// Bind Current View demand to executable operations; the controller owns their lifetimes.
export function switchboard({ center, mode, structure }: RefinementInput): readonly RefinementTask[] {
  const demand = deriveCurrentViewRefinementDemand({ center, mode, structure });
  const tasks: RefinementTask[] = [];

  if (demand.rootDiscovery) {
    const root = demand.rootDiscovery;
    tasks.push({
      key: `root-discovery:${root}`,
      purpose: 'root-discovery',
      modes: ['roots'],
      run: ({ signal, priority }) => discoverRootPredecessors(root, { signal, priority }),
    });
  }

  if (demand.rootTransposition) {
    const root = demand.rootTransposition;
    tasks.push({
      key: `root-transpositions:${root}`,
      nodusWide: true,
      run: ({ signal }) => rootTranspositionEnricher.ensure(root, { signal }),
    });
  }

  for (const target of demand.explorer) {
    tasks.push({
      key: `explorer:${target.position}`,
      modes: target.modes,
      nodusWide: target.nodusWide,
      structuralReading: target.structuralModes.includes(mode) ? target.position : null,
      run: ({ signal, priority }) => refineExplorerReading(target.position, { signal, priority }),
    });
  }

  for (const target of demand.cloudEval) {
    tasks.push({
      key: `cloud-eval:${target.position}`,
      modes: target.modes,
      nodusWide: target.nodusWide,
      run: ({ signal, priority }) => lichessEval.get(target.position, { signal, priority }),
    });
  }

  for (const target of demand.masters) {
    tasks.push({
      key: `masters:${target.position}`,
      modes: target.modes,
      nodusWide: target.nodusWide,
      run: ({ signal, priority }) => loadMasters(target.position, { signal, priority }),
    });
  }

  return tasks;
}
