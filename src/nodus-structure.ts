import {
  edgeId,
  legalDestinations,
  legalMoveTargets,
  toPlayableFen,
} from './graph.js';
import { composeLineNeighborhood } from './visible-graph.ts';
import type {
  LineCompositionPlan,
  VisibleComposition,
  VisibleFamily,
  VisibleNode,
  VisibleRelationship,
} from './visible-graph.ts';
import { positionGraph } from './position-graph.ts';
import type { GraphEdge } from './position-graph.ts';
import { positionRepository } from './position-repository.js';
import { reconciledExplorerReadingAvailable } from './knowledge-acquisition.ts';
import { createEvidenceReader } from './evidence-source.ts';
import {
  rankCrossSourceCandidates,
  rankSameSourceCandidates,
  selectionCandidate,
} from './constellation-selection.ts';
import type { SelectionCandidate } from './constellation-selection.ts';

type CandidateSource = Readonly<{
  outgoing(source: string): Promise<readonly SelectionCandidate[]>;
  incoming(target: string): Promise<readonly SelectionCandidate[]>;
  hasReconciledReading(source: string): Promise<boolean>;
  missingReadings(): readonly string[];
}>;
type PositionRecord = { key: string; fen: string; [field: string]: unknown };

export type NodusMode = 'roots' | 'lines';

export type ComposeNodusStructureOptions = Readonly<{
  center: string;
  mode: NodusMode;
  lineMax?: number;
  rootMax?: number;
  signal?: AbortSignal;
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
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, immutable(child)]),
    )) as T;
  }
  return value;
}

function capacity(value: number | undefined, fallback = 1): number {
  const numeric = Number.isFinite(value) ? Number(value) : fallback;
  return Math.max(1, Math.floor(numeric));
}

function createCandidateSource(signal?: AbortSignal): CandidateSource {
  const evidence = createEvidenceReader({ signal });
  const missing = new Set<string>();
  const reconciliationReads = new Map<string, Promise<boolean>>();

  function reconciledReadingFor(source: string): Promise<boolean> {
    const existing = reconciliationReads.get(source);
    if (existing) return existing;
    const pending = reconciledExplorerReadingAvailable(source);
    reconciliationReads.set(source, pending);
    return pending;
  }

  async function candidate(edge: GraphEdge): Promise<SelectionCandidate | null> {
    const [readingAvailable, reconciledReading] = await Promise.all([
      evidence.ratedReadingAvailable(edge.source),
      reconciledReadingFor(edge.source),
    ]);
    throwIfAborted(signal);
    if (!reconciledReading && !edge.explicit) missing.add(edge.source);
    if (!readingAvailable) return null;
    const moveEvidence = await evidence.move(edge, { comparisons: false });
    throwIfAborted(signal);
    if (!moveEvidence.frequency) return null;
    return selectionCandidate({
      edge,
      frequency: moveEvidence.frequency,
      engineQuality: moveEvidence.moveEval,
      humanResult: moveEvidence.humanResult,
    });
  }

  async function outgoing(source: string): Promise<readonly SelectionCandidate[]> {
    const edges = await positionGraph.outgoing(source);
    throwIfAborted(signal);
    const candidates = (await Promise.all(edges.map(candidate)))
      .filter((item): item is SelectionCandidate => item != null);
    return rankSameSourceCandidates(candidates);
  }

  async function incoming(target: string): Promise<readonly SelectionCandidate[]> {
    const edges = await positionGraph.incoming(target);
    throwIfAborted(signal);
    const candidates = (await Promise.all(edges.map(candidate)))
      .filter((item): item is SelectionCandidate => item != null);
    return rankCrossSourceCandidates(candidates);
  }

  return Object.freeze({
    outgoing,
    incoming,
    hasReconciledReading: reconciledReadingFor,
    missingReadings: () => Object.freeze([...missing]),
  });
}

async function composeKnownLineGraph(
  center: string,
  max: number,
  candidateSource: CandidateSource,
  signal?: AbortSignal,
): Promise<LineCompositionPlan> {
  const outgoingBySource = new Map<string, readonly SelectionCandidate[]>();
  const readingReconciled = new Map<string, boolean>();

  async function inspect(source: string): Promise<void> {
    if (outgoingBySource.has(source)) return;
    const [candidates, hasReconciledReading] = await Promise.all([
      candidateSource.outgoing(source),
      candidateSource.hasReconciledReading(source),
    ]);
    throwIfAborted(signal);
    outgoingBySource.set(source, candidates);
    readingReconciled.set(source, hasReconciledReading);
  }

  await inspect(center);
  let plan = composeLineNeighborhood({ center, outgoingBySource, max });
  while (true) {
    throwIfAborted(signal);
    const uninspected = plan.composition.nodes.map((node) => node.key)
      .filter((key) => !outgoingBySource.has(key));
    if (!uninspected.length) break;
    await Promise.all(uninspected.map(inspect));
    plan = composeLineNeighborhood({ center, outgoingBySource, max });
  }

  const unresolvedReadings = new Set(plan.composition.nodes
    .map((node) => node.key)
    .filter((key) => readingReconciled.get(key) === false && legalDestinations(key).size > 0));
  const legalTargetsBySource = new Map<string, ReadonlySet<string>>([...unresolvedReadings]
    .map((key) => [key, legalMoveTargets(key) as ReadonlySet<string>]));
  plan = composeLineNeighborhood({ center, outgoingBySource, unresolvedReadings, legalTargetsBySource, max });
  if (readingReconciled.get(center) === false && legalDestinations(center).size > 0) {
    plan = { ...plan, readingFrontier: [center, ...plan.readingFrontier.filter((key) => key !== center)] };
  }
  return plan;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function addContextNode(nodes: VisibleNode[], byKey: Map<string, VisibleNode>, input: VisibleNode, max: number): VisibleNode | null {
  const existing = byKey.get(input.key);
  if (existing) {
    existing.families = unique([...existing.families, ...input.families]);
    existing.relationships = unique([...existing.relationships, ...input.relationships]);
    existing.merge = true;
    return existing;
  }
  if (nodes.length >= max) return null;
  nodes.push(input);
  byKey.set(input.key, input);
  return input;
}

async function composeRootContext(
  center: string,
  max: number,
  candidateSource: CandidateSource,
): Promise<VisibleComposition> {
  const nodes: VisibleNode[] = [];
  const relationships: VisibleRelationship[] = [];
  const families: VisibleFamily[] = [];
  const nodesByKey = new Map<string, VisibleNode>();
  const relationshipIds = new Set<string>();
  const immediate = await candidateSource.incoming(center);
  const selectedRoots: Array<{ key: string; family: string }> = [];

  function addRelationship(candidate: SelectionCandidate, family: string, distance: number): void {
    const id = edgeId(candidate.edge);
    if (relationshipIds.has(id)) return;
    relationshipIds.add(id);
    relationships.push({ id, edge: candidate.edge, source: candidate.edge.source, target: candidate.edge.target, distance, families: [family] });
    for (const key of [candidate.edge.source, candidate.edge.target]) {
      const node = nodesByKey.get(key);
      if (node && !node.relationships.includes(id)) node.relationships.push(id);
    }
  }

  for (const candidate of immediate) {
    if (nodes.length >= max) break;
    const family = candidate.edge.source;
    families.push({ id: family, rootEdgeId: edgeId(candidate.edge) });
    const node: VisibleNode = {
      key: family,
      distance: 1,
      relation: 'root',
      families: [family],
      relationships: [],
      merge: false,
      edge: candidate.edge,
      branch: family,
      branches: [family],
    };
    if (addContextNode(nodes, nodesByKey, node, max)) {
      selectedRoots.push({ key: family, family });
      addRelationship(candidate, family, 1);
    }
  }

  const siblingLists = await Promise.all(selectedRoots.map(async ({ key, family }) => ({
    family,
    candidates: (await candidateSource.outgoing(key)).filter((candidate) => candidate.edge.target !== center),
  })));
  let siblingIndex = 0;
  while (nodes.length < max && siblingLists.some(({ candidates }) => siblingIndex < candidates.length)) {
    for (const { family, candidates } of siblingLists) {
      if (nodes.length >= max) break;
      const candidate = candidates[siblingIndex];
      if (!candidate) continue;
      const node: VisibleNode = {
        key: candidate.edge.target,
        distance: 1,
        relation: 'sibling',
        families: [family],
        relationships: [],
        merge: false,
        edge: candidate.edge,
        branch: family,
        branches: [family],
      };
      const added = addContextNode(nodes, nodesByKey, node, max);
      if (added) addRelationship(candidate, family, 1);
    }
    siblingIndex += 1;
  }
  return { nodes, relationships, families };
}

function mergeCompositions(primary: VisibleComposition, context: VisibleComposition): VisibleComposition {
  const nodes = primary.nodes.map((node) => ({ ...node, families: [...node.families], relationships: [...node.relationships] }));
  const nodesByKey = new Map(nodes.map((node) => [node.key, node]));
  const relationships = primary.relationships.map((relationship) => ({ ...relationship, families: [...relationship.families] }));
  const relationshipIds = new Set(relationships.map((relationship) => relationship.id));
  const families = primary.families.map((family) => ({ ...family }));
  const familyIds = new Set(families.map((family) => family.id));

  for (const node of context.nodes) {
    const existing = nodesByKey.get(node.key);
    if (existing) {
      existing.families = unique([...existing.families, ...node.families]);
      existing.relationships = unique([...existing.relationships, ...node.relationships]);
      existing.merge = true;
      continue;
    }
    const copy = { ...node, families: [...node.families], relationships: [...node.relationships] };
    nodes.push(copy);
    nodesByKey.set(copy.key, copy);
  }
  for (const relationship of context.relationships) {
    if (relationshipIds.has(relationship.id)) continue;
    relationships.push({ ...relationship, families: [...relationship.families] });
    relationshipIds.add(relationship.id);
  }
  for (const family of context.families) {
    if (familyIds.has(family.id)) continue;
    families.push({ ...family });
    familyIds.add(family.id);
  }
  return { nodes, relationships, families };
}

export async function composeNodusStructure(options: ComposeNodusStructureOptions) {
  const { center, mode, signal } = options;
  throwIfAborted(signal);
  const candidateSource = createCandidateSource(signal);
  const line = await composeKnownLineGraph(
    center,
    capacity(options.lineMax, 1),
    candidateSource,
    signal,
  );
  let selected = line.composition;
  const readingFrontier = [...line.readingFrontier];

  if (mode === 'roots' && (options.rootMax ?? 0) > 0) {
    const before = new Set(candidateSource.missingReadings());
    const context = await composeRootContext(
      center,
      capacity(options.rootMax, 1),
      candidateSource,
    );
    selected = mergeCompositions(selected, context);
    for (const key of candidateSource.missingReadings()) {
      if (!before.has(key) && !readingFrontier.includes(key)) readingFrontier.push(key);
    }
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
    settling: readingFrontier.length > 0,
  });
}
