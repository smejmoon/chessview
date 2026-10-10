import type { ViewMode } from './route-ledger.ts';

type StructureLike = Readonly<{
  readingFrontier?: readonly string[];
  composition?: Readonly<{
    nodes?: readonly Readonly<{ key?: string }>[];
    relationships?: readonly Readonly<{
      edge?: Readonly<{ source?: string; target?: string }>;
    }>[];
  }>;
}>;

type MutableTarget = {
  relevant: boolean;
};

type MutableExplorerTarget = MutableTarget & {
  structural: boolean;
};

type CurrentViewRefinementTarget = Readonly<{
  position: string;
  modes: readonly ViewMode[];
  nodusWide: boolean;
}>;

type CurrentViewExplorerDemand = CurrentViewRefinementTarget & Readonly<{
  structuralModes: readonly ViewMode[];
}>;

type CurrentViewRefinementDemand = Readonly<{
  rootDiscovery: string | null;
  rootTransposition: string | null;
  explorer: readonly CurrentViewExplorerDemand[];
  cloudEval: readonly CurrentViewRefinementTarget[];
  masters: readonly CurrentViewRefinementTarget[];
}>;

type CurrentViewRefinementInput = Readonly<{
  center: string;
  mode: ViewMode;
  structure: unknown | null;
}>;

function addTarget(
  demand: Map<string, MutableTarget>,
  position: string | null | undefined,
  relevant = false,
): void {
  if (!position) return;
  let target = demand.get(position);
  if (!target) {
    target = { relevant: false };
    demand.set(position, target);
  }
  if (relevant) target.relevant = true;
}

function addExplorer(
  demand: Map<string, MutableExplorerTarget>,
  position: string | null | undefined,
  structural = false,
): void {
  if (!position) return;
  let target = demand.get(position);
  if (!target) {
    target = { relevant: true, structural: false };
    demand.set(position, target);
  }
  target.relevant = true;
  if (structural) target.structural = true;
}

function freezeTargets(
  demand: Map<string, MutableTarget>,
  center: string,
  mode: ViewMode,
): readonly CurrentViewRefinementTarget[] {
  return Object.freeze([...demand].map(([position, target]) => Object.freeze({
    position,
    modes: Object.freeze(target.relevant ? [mode] : []),
    nodusWide: position === center,
  })));
}

function freezeExplorerTargets(
  demand: Map<string, MutableExplorerTarget>,
  center: string,
  mode: ViewMode,
): readonly CurrentViewExplorerDemand[] {
  return Object.freeze([...demand].map(([position, target]) => Object.freeze({
    position,
    modes: Object.freeze(target.relevant ? [mode] : []),
    structuralModes: Object.freeze(target.structural ? [mode] : []),
    nodusWide: position === center,
  })));
}

function hasAuthoritativeRoot(
  center: string,
  mode: ViewMode,
  structure: StructureLike | null,
): boolean {
  if (mode !== 'roots') return false;
  return (structure?.composition?.relationships ?? []).some(({ edge }) => (
    Boolean(edge?.source) && edge?.target === center
  ));
}

export function deriveCurrentViewRefinementDemand({
  center,
  mode,
  structure: inputStructure,
}: CurrentViewRefinementInput): CurrentViewRefinementDemand {
  const explorerDemand = new Map<string, MutableExplorerTarget>();
  const evalDemand = new Map<string, MutableTarget>();
  const mastersDemand = new Map<string, MutableTarget>();
  const structure = inputStructure as StructureLike | null;

  for (const position of structure?.readingFrontier ?? []) {
    addExplorer(explorerDemand, position, true);
  }
  for (const node of structure?.composition?.nodes ?? []) {
    addExplorer(explorerDemand, node.key);
  }
  for (const relationship of structure?.composition?.relationships ?? []) {
    const edge = relationship.edge;
    if (!edge?.source || !edge.target) continue;
    addExplorer(explorerDemand, edge.source);
    addTarget(evalDemand, edge.source, true);
    addTarget(evalDemand, edge.target, true);
    addTarget(mastersDemand, edge.source, true);
  }

  if (!explorerDemand.has(center)) {
    explorerDemand.set(center, { relevant: false, structural: false });
  }
  addTarget(evalDemand, center);
  addTarget(mastersDemand, center);

  return Object.freeze({
    rootDiscovery: mode === 'roots' ? center : null,
    rootTransposition: hasAuthoritativeRoot(center, mode, structure) ? center : null,
    explorer: freezeExplorerTargets(explorerDemand, center, mode),
    cloudEval: freezeTargets(evalDemand, center, mode),
    masters: freezeTargets(mastersDemand, center, mode),
  });
}
