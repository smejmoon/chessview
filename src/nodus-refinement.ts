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
  modes: Set<ViewMode>;
};

type MutableExplorerTarget = MutableTarget & {
  structuralModes: Set<ViewMode>;
};

export type CurrentViewRefinementTarget = Readonly<{
  position: string;
  modes: readonly ViewMode[];
  nodusWide: boolean;
}>;

export type CurrentViewExplorerDemand = CurrentViewRefinementTarget & Readonly<{
  structuralModes: readonly ViewMode[];
}>;

export type CurrentViewRefinementDemand = Readonly<{
  rootTransposition: string;
  explorer: readonly CurrentViewExplorerDemand[];
  cloudEval: readonly CurrentViewRefinementTarget[];
  masters: readonly CurrentViewRefinementTarget[];
}>;

export type CurrentViewRefinementInput = Readonly<{
  center: string;
  mode: ViewMode;
  structure: unknown | null;
}>;

export type CurrentViewRefinementPriority = 'foreground' | 'background';

function addTarget(
  demand: Map<string, MutableTarget>,
  position: string | null | undefined,
  mode?: ViewMode,
): void {
  if (!position) return;
  let target = demand.get(position);
  if (!target) {
    target = { modes: new Set<ViewMode>() };
    demand.set(position, target);
  }
  if (mode) target.modes.add(mode);
}

function addExplorer(
  demand: Map<string, MutableExplorerTarget>,
  position: string | null | undefined,
  mode: ViewMode,
  structural = false,
): void {
  if (!position) return;
  let target = demand.get(position);
  if (!target) {
    target = {
      modes: new Set<ViewMode>(),
      structuralModes: new Set<ViewMode>(),
    };
    demand.set(position, target);
  }
  target.modes.add(mode);
  if (structural) target.structuralModes.add(mode);
}

function freezeTargets(
  demand: Map<string, MutableTarget>,
  center: string,
): readonly CurrentViewRefinementTarget[] {
  return Object.freeze([...demand].map(([position, target]) => Object.freeze({
    position,
    modes: Object.freeze([...target.modes]),
    nodusWide: position === center,
  })));
}

function freezeExplorerTargets(
  demand: Map<string, MutableExplorerTarget>,
  center: string,
): readonly CurrentViewExplorerDemand[] {
  return Object.freeze([...demand].map(([position, target]) => Object.freeze({
    position,
    modes: Object.freeze([...target.modes]),
    structuralModes: Object.freeze([...target.structuralModes]),
    nodusWide: position === center,
  })));
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
    addExplorer(explorerDemand, position, mode, true);
  }
  for (const node of structure?.composition?.nodes ?? []) {
    addExplorer(explorerDemand, node.key, mode);
  }
  for (const relationship of structure?.composition?.relationships ?? []) {
    const edge = relationship.edge;
    if (!edge?.source || !edge.target) continue;
    addExplorer(explorerDemand, edge.source, mode);
    addTarget(evalDemand, edge.source, mode);
    addTarget(evalDemand, edge.target, mode);
    addTarget(mastersDemand, edge.source, mode);
  }

  if (!explorerDemand.has(center)) {
    explorerDemand.set(center, {
      modes: new Set<ViewMode>(),
      structuralModes: new Set<ViewMode>(),
    });
  }
  addTarget(evalDemand, center);
  addTarget(mastersDemand, center);

  return Object.freeze({
    rootTransposition: center,
    explorer: freezeExplorerTargets(explorerDemand, center),
    cloudEval: freezeTargets(evalDemand, center),
    masters: freezeTargets(mastersDemand, center),
  });
}

export function currentViewRefinementPriority(
  demand: CurrentViewRefinementTarget,
  activeMode: ViewMode,
): CurrentViewRefinementPriority {
  return demand.nodusWide || demand.modes.includes(activeMode) ? 'foreground' : 'background';
}

// Compatibility aliases while callers move from the former Nodus-owned wording.
export type NodusRefinementTarget = CurrentViewRefinementTarget;
export type NodusExplorerDemand = CurrentViewExplorerDemand;
export type NodusRefinementDemand = CurrentViewRefinementDemand;
export type NodusRefinementInput = CurrentViewRefinementInput;
export type NodusRefinementPriority = CurrentViewRefinementPriority;
export const deriveNodusRefinementDemand = deriveCurrentViewRefinementDemand;
export const nodusRefinementPriority = currentViewRefinementPriority;
