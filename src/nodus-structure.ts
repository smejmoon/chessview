import {
  START_FEN,
  canonicalPosition,
  legalDestinations,
  legalMoveTargets,
  toPlayableFen,
} from './graph.js';
import {
  composeLineNeighborhood,
  chooseRootNeighborhood,
} from './visible-graph.ts';
import type { LineCompositionPlan, VisibleComposition } from './visible-graph.ts';
import { formatPgnMoves, formatPgnSuffix, reconstructPgnPath } from './pgn.js';
import { positionGraph } from './position-graph.ts';
import type { GraphEdge } from './position-graph.ts';
import { positionRepository } from './position-repository.js';
import { rootTranspositionEnricher } from './root-enrichment.js';
import {
  acquireExplorerReading,
  reconcileCachedExplorerReading,
} from './knowledge-acquisition.js';
import { humanResultQuality, moveEvaluation, moveFrequency } from './evidence.js';
import { lichessEval } from './lichess-eval.js';
import {
  rankCrossSourceCandidates,
  rankSameSourceCandidates,
  selectionCandidate,
} from './constellation-selection.ts';
import type { SelectionCandidate } from './constellation-selection.ts';

const START = canonicalPosition(START_FEN);

type LoadPriority = 'foreground' | 'background';
type Priority = LoadPriority | (() => LoadPriority);
type CandidateSource = Readonly<{
  outgoing(source: string): Promise<readonly SelectionCandidate[]>;
  incoming(target: string): Promise<readonly SelectionCandidate[]>;
  hasExplorer(source: string): Promise<boolean>;
}>;
type PositionRecord = {
  key: string;
  fen: string;
  [field: string]: unknown;
};
type RootRow = Readonly<{
  key: string;
  label: string;
  title: string;
}>;

export type NodusMode = 'roots' | 'lines';

export type ComposeNodusStructureOptions = Readonly<{
  center: string;
  mode: NodusMode;
  max: number;
  signal?: AbortSignal;
  priority?: Priority;
}>;

function abortError(): Error {
  const error = new Error('Nodus structure composition aborted');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function immutable<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable)) as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.freeze(Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, child]) => [key, immutable(child)]),
    )) as T;
  }
  return value;
}

function createCandidateSource(
  signal?: AbortSignal,
  { hydrateExplorer = true, priority = 'foreground' }: {
    hydrateExplorer?: boolean;
    priority?: Priority;
  } = {},
): CandidateSource {
  const explorerLoads = new Map<string, Promise<unknown>>();

  function explorerFor(source: string): Promise<unknown> {
    const existing = explorerLoads.get(source);
    if (existing) return existing;
    const pending = (async () => {
      throwIfAborted(signal);
      const explorer = hydrateExplorer
        ? await acquireExplorerReading(source, { signal, priority })
        : await reconcileCachedExplorerReading(source);
      throwIfAborted(signal);
      return explorer;
    })();
    explorerLoads.set(source, pending);
    return pending;
  }

  async function candidate(
    edge: GraphEdge,
    sourceExplorer: unknown | undefined = undefined,
  ): Promise<SelectionCandidate | null> {
    // Explicit materialization is a navigation property, not Candidate admission.
    // When the caller already has current source evidence, an explicit edge may
    // become an ordinary Candidate from that evidence. For incoming explicit-only
    // relationships, consult cached evidence without starting Explorer acquisition.
    const explorer = sourceExplorer !== undefined
      ? sourceExplorer
      : edge.explicit
        ? await reconcileCachedExplorerReading(edge.source)
        : await explorerFor(edge.source);
    throwIfAborted(signal);

    const frequency = moveFrequency(explorer, edge);
    if (!frequency) return null;

    const [sourceEval, targetEval] = await Promise.all([
      lichessEval.available(edge.source),
      lichessEval.available(edge.target),
    ]);
    throwIfAborted(signal);
    return selectionCandidate({
      edge,
      frequency,
      engineQuality: moveEvaluation(edge.source, edge, sourceEval, targetEval),
      humanResult: humanResultQuality(explorer, edge, edge.source),
    });
  }

  async function outgoing(source: string): Promise<readonly SelectionCandidate[]> {
    const explorer = await explorerFor(source);
    throwIfAborted(signal);
    const edges = await positionGraph.outgoing(source);
    throwIfAborted(signal);
    const candidates = (await Promise.all(edges.map((edge) => candidate(edge, explorer))))
      .filter((item): item is SelectionCandidate => item != null);
    return rankSameSourceCandidates(candidates);
  }

  async function incoming(target: string): Promise<readonly SelectionCandidate[]> {
    const edges = await positionGraph.incoming(target);
    throwIfAborted(signal);
    const candidates = (await Promise.all(edges.map((edge) => candidate(edge))))
      .filter((item): item is SelectionCandidate => item != null);
    return rankCrossSourceCandidates(candidates);
  }

  async function hasExplorer(source: string): Promise<boolean> {
    return Boolean(await explorerFor(source));
  }

  return Object.freeze({ outgoing, incoming, hasExplorer });
}

async function composeKnownLineGraph(
  center: string,
  capacity: number,
  candidateSource: CandidateSource,
  signal?: AbortSignal,
): Promise<LineCompositionPlan> {
  const outgoingBySource = new Map<string, readonly SelectionCandidate[]>();
  const readingKnown = new Map<string, boolean>();

  async function inspect(source: string): Promise<void> {
    if (outgoingBySource.has(source)) return;
    const [candidates, hasExplorer] = await Promise.all([
      candidateSource.outgoing(source),
      candidateSource.hasExplorer(source),
    ]);
    throwIfAborted(signal);
    outgoingBySource.set(source, candidates);
    readingKnown.set(source, hasExplorer);
  }

  await inspect(center);
  let plan = composeLineNeighborhood({ center, outgoingBySource, max: capacity });

  while (true) {
    throwIfAborted(signal);
    const uninspected = plan.composition.nodes
      .map((node) => node.key)
      .filter((key) => !outgoingBySource.has(key));
    if (!uninspected.length) break;
    await Promise.all(uninspected.map(inspect));
    plan = composeLineNeighborhood({ center, outgoingBySource, max: capacity });
  }

  const unresolvedReadings = new Set(plan.composition.nodes
    .map((node) => node.key)
    .filter((key) => readingKnown.get(key) === false && legalDestinations(key).size > 0));
  const legalTargetsBySource = new Map<string, ReadonlySet<string>>([...unresolvedReadings]
    .map((key) => [key, legalMoveTargets(key) as ReadonlySet<string>]));
  plan = composeLineNeighborhood({
    center,
    outgoingBySource,
    unresolvedReadings,
    legalTargetsBySource,
    max: capacity,
  });

  return plan;
}

async function collectIncomingGraph(
  center: string,
  capacity: number,
  candidateSource: CandidateSource,
  signal?: AbortSignal,
): Promise<Map<string, readonly SelectionCandidate[]>> {
  const incomingByTarget = new Map<string, readonly SelectionCandidate[]>();
  const queue = [center];
  const visited = new Set<string>();
  while (queue.length && visited.size < capacity) {
    throwIfAborted(signal);
    const key = queue.shift();
    if (!key || visited.has(key)) continue;
    visited.add(key);
    const candidates = await candidateSource.incoming(key);
    throwIfAborted(signal);
    incomingByTarget.set(key, candidates);
    for (const candidate of candidates) {
      if (!visited.has(candidate.edge.source)) queue.push(candidate.edge.source);
    }
  }
  return incomingByTarget;
}

async function collectIncomingToStart(
  target: string,
  { maxDepth = 32, signal }: { maxDepth?: number; signal?: AbortSignal } = {},
): Promise<Map<string, GraphEdge[]>> {
  const incomingByTarget = new Map<string, GraphEdge[]>();
  const queue: Array<{ key: string; depth: number }> = [{ key: target, depth: 0 }];
  const seen = new Set<string>();
  while (queue.length) {
    throwIfAborted(signal);
    const current = queue.shift();
    if (!current) break;
    if (seen.has(current.key) || current.depth >= maxDepth) continue;
    seen.add(current.key);
    const incoming = await positionGraph.incoming(current.key);
    throwIfAborted(signal);
    incomingByTarget.set(current.key, incoming);
    if (incoming.some((edge) => edge.source === START)) break;
    for (const edge of incoming) {
      if (!seen.has(edge.source)) queue.push({ key: edge.source, depth: current.depth + 1 });
    }
  }
  return incomingByTarget;
}

async function rootRows(
  composition: VisibleComposition,
  signal?: AbortSignal,
): Promise<readonly RootRow[]> {
  const rows = await Promise.all(composition.nodes.map(async (node): Promise<RootRow | null> => {
    throwIfAborted(signal);
    const incomingByTarget = await collectIncomingToStart(node.key, { signal });
    const path = reconstructPgnPath(node.key, incomingByTarget, START);
    if (path == null) return null;
    const full = path.length ? formatPgnMoves(path) : 'start position';
    const suffix = path.length ? formatPgnSuffix(path, 6) : 'start position';
    return {
      key: node.key,
      label: node.merge ? `↗ ${suffix}` : suffix,
      title: node.merge ? `Transposition merge · ${full}` : full,
    };
  }));
  return immutable(rows.filter((row): row is RootRow => row != null));
}

export async function composeNodusStructure({
  center,
  mode,
  max,
  signal,
  priority = 'foreground',
}: ComposeNodusStructureOptions) {
  throwIfAborted(signal);
  const capacity = Math.max(1, Number.isFinite(max) ? Math.floor(max) : 1);
  if (mode === 'roots') await rootTranspositionEnricher.ensure(center, { signal });
  else await acquireExplorerReading(center, { signal, priority });
  throwIfAborted(signal);

  const candidateSource = createCandidateSource(signal, { hydrateExplorer: mode === 'roots', priority });
  let selected: VisibleComposition;
  let readingFrontier: string[] = [];
  if (mode === 'roots') {
    const incomingByTarget = await collectIncomingGraph(center, capacity, candidateSource, signal);
    selected = chooseRootNeighborhood({ center, incomingByTarget, max: capacity });
  } else {
    const line = await composeKnownLineGraph(center, capacity, candidateSource, signal);
    selected = line.composition;
    readingFrontier = line.readingFrontier;
  }
  throwIfAborted(signal);

  const composition = immutable(selected);
  const keys = [center, ...composition.nodes.map((node) => node.key)];
  const nodeValues = await Promise.all(keys.map(async (key) => {
    const stored = await positionRepository.get(key) as PositionRecord | null | undefined;
    const value: PositionRecord = stored ?? { key, fen: toPlayableFen(key) };
    throwIfAborted(signal);
    return [key, immutable({ ...value })] as const;
  }));
  const records = new Map<string, PositionRecord>(nodeValues);
  const positions = composition.nodes.map((node) => immutable({
    ...node,
    record: records.get(node.key) ?? { key: node.key, fen: toPlayableFen(node.key) },
  }));

  return immutable({
    composition,
    centerNode: records.get(center) ?? { key: center, fen: toPlayableFen(center) },
    positions,
    readingFrontier,
    rootRows: mode === 'roots' ? await rootRows(composition, signal) : [],
  });
}
