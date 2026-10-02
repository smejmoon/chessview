import { edgeId } from './graph.js';
import type { SelectionCandidate } from './constellation-selection.ts';
import type { GraphEdge } from './position-graph.ts';

export type VisibleFamily = {
  id: string;
  lineShare?: number;
  rootEdgeId?: string;
  [field: string]: unknown;
};

export type VisibleNode = {
  key: string;
  distance: number;
  relation: string;
  families: string[];
  relationships: string[];
  merge: boolean;
  edge?: GraphEdge;
  edges?: GraphEdge[];
  branch?: string;
  branches?: string[];
  lineShare?: number;
  [field: string]: unknown;
};

export type VisibleRelationship = {
  id: string;
  edge: GraphEdge;
  source: string;
  target: string;
  distance: number;
  families: string[];
};

export type VisibleComposition = {
  nodes: VisibleNode[];
  relationships: VisibleRelationship[];
  families: VisibleFamily[];
};

export type LineCompositionPlan = {
  composition: VisibleComposition;
  readingFrontier: string[];
};

type Direction = 'roots' | 'lines';
type NodeInput = {
  key: string;
  distance: number;
  relation: string;
  families?: readonly string[];
  [field: string]: unknown;
};
type IncomingNode = Readonly<{
  key: string;
  games?: number;
  [field: string]: unknown;
}>;
type LineStructure = {
  pathCost: number;
  depth: number;
  localOrder: number;
  rootOrder: number;
};
type LineContext = {
  family: string;
  lineShare: number;
  rootOrder: number;
  depth: number;
  pathCost: number;
};
type LineAgendaItem = LineStructure & {
  key: string;
  candidate: SelectionCandidate;
  family: string;
  lineShare: number;
};
type RootAgendaItem = {
  key: string;
  candidate: SelectionCandidate;
  distance: number;
};
type RootFrontier = {
  branch: string;
  pending: RootAgendaItem[];
  seenEdges: Set<string>;
};

type LineNeighborhoodOptions = Readonly<{
  center: string;
  incoming?: readonly IncomingNode[];
  outgoingBySource?: ReadonlyMap<string, readonly SelectionCandidate[]>;
  unresolvedReadings?: ReadonlySet<string>;
  legalTargetsBySource?: ReadonlyMap<string, ReadonlySet<string>>;
  max?: number;
}>;

type RootNeighborhoodOptions = Readonly<{
  center: string;
  incomingByTarget?: ReadonlyMap<string, readonly SelectionCandidate[]>;
  max?: number;
}>;

function unique(values: readonly (string | null | undefined | false)[] = []): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function createVisibleGraph({ center, direction, max = 19 }: {
  center: string;
  direction: Direction;
  max?: number;
}) {
  const nodes: VisibleNode[] = [];
  const nodesByKey = new Map<string, VisibleNode>();
  const relationships: VisibleRelationship[] = [];
  const relationshipsById = new Map<string, VisibleRelationship>();
  const families = new Map<string, VisibleFamily>();

  const centerNode: VisibleNode = {
    key: center,
    distance: 0,
    relation: 'center',
    families: [],
    relationships: [],
    merge: false,
  };
  nodesByKey.set(center, centerNode);

  function refreshMerge(node: VisibleNode | null | undefined): void {
    if (!node) return;
    const converging = node.relationships
      .map((id) => relationshipsById.get(id))
      .filter((relationship): relationship is VisibleRelationship => Boolean(relationship && (
        direction === 'roots'
          ? relationship.source === node.key
          : relationship.target === node.key
      )));
    node.merge = converging.length > 1;
  }

  function ensureFamily(id: string, metadata: Record<string, unknown> = {}): VisibleFamily | null {
    if (!id) return null;
    const existing = families.get(id);
    if (existing) {
      Object.assign(existing, metadata);
      return existing;
    }
    const family: VisibleFamily = { id, ...metadata };
    families.set(id, family);
    return family;
  }

  function addNode({ key, distance, relation, families: familyIds = [], ...metadata }: NodeInput) {
    const existing = nodesByKey.get(key);
    if (existing) {
      existing.families = unique([...existing.families, ...familyIds]);
      refreshMerge(existing);
      return { node: existing, added: false };
    }
    if (nodes.length >= max) return { node: null, added: false };

    const node: VisibleNode = {
      key,
      distance,
      relation,
      ...metadata,
      families: unique(familyIds),
      relationships: [],
      merge: false,
    };
    nodes.push(node);
    nodesByKey.set(key, node);
    return { node, added: true };
  }

  function addRelationship({
    candidate,
    family,
    families: familyIds = [],
    distance,
  }: {
    candidate: SelectionCandidate;
    family?: string | null;
    families?: readonly string[];
    distance: number;
  }): VisibleRelationship | null {
    const edge = candidate.edge;
    const ids = unique([family, ...familyIds]);
    const id = edgeId(edge);
    const existing = relationshipsById.get(id);
    if (existing) {
      existing.families = unique([...existing.families, ...ids]);
      for (const key of [edge.source, edge.target]) {
        const node = nodesByKey.get(key);
        if (!node) continue;
        node.families = unique([...node.families, ...ids]);
        refreshMerge(node);
      }
      return existing;
    }

    const relationship: VisibleRelationship = {
      id,
      edge,
      source: edge.source,
      target: edge.target,
      distance,
      families: ids,
    };
    relationships.push(relationship);
    relationshipsById.set(id, relationship);

    for (const key of [edge.source, edge.target]) {
      const node = nodesByKey.get(key);
      if (!node) continue;
      if (!node.relationships.includes(id)) node.relationships.push(id);
      node.families = unique([...node.families, ...ids]);
      refreshMerge(node);
    }
    return relationship;
  }

  function relationshipsFor(key: string, {
    incoming = true,
    outgoing = true,
  }: { incoming?: boolean; outgoing?: boolean } = {}): VisibleRelationship[] {
    const node = nodesByKey.get(key);
    if (!node) return [];
    return node.relationships
      .map((id) => relationshipsById.get(id))
      .filter((relationship): relationship is VisibleRelationship => Boolean(relationship && (
        (incoming && relationship.target === key)
        || (outgoing && relationship.source === key)
      )));
  }

  function result(): VisibleComposition {
    return {
      nodes,
      relationships,
      families: [...families.values()],
    };
  }

  return {
    ensureFamily,
    addNode,
    addRelationship,
    getNode: (key: string) => nodesByKey.get(key) ?? null,
    hasNode: (key: string) => nodesByKey.has(key),
    boardCount: () => nodes.length,
    relationshipsFor,
    result,
  };
}

function selectedLineCandidates(
  outgoingBySource: ReadonlyMap<string, readonly SelectionCandidate[]>,
  key: string,
): readonly SelectionCandidate[] {
  return outgoingBySource.get(key) ?? [];
}

function compareLineStructure(a: LineStructure, b: LineStructure): number {
  return a.pathCost - b.pathCost
    || a.depth - b.depth
    || a.localOrder - b.localOrder
    || a.rootOrder - b.rootOrder;
}

function compareLineCandidates(a: LineAgendaItem, b: LineAgendaItem): number {
  return compareLineStructure(a, b)
    || a.family.localeCompare(b.family)
    || a.candidate.edge.uci.localeCompare(b.candidate.edge.uci)
    || a.candidate.edge.target.localeCompare(b.candidate.edge.target);
}

function lineChildren(
  outgoingBySource: ReadonlyMap<string, readonly SelectionCandidate[]>,
  key: string,
  context: LineContext,
): LineAgendaItem[] {
  return selectedLineCandidates(outgoingBySource, key).map((candidate, localOrder) => ({
    key: candidate.edge.target,
    candidate,
    family: context.family,
    lineShare: context.lineShare,
    rootOrder: context.rootOrder,
    localOrder,
    depth: context.depth + 1,
    pathCost: context.pathCost + 1 + localOrder,
  }));
}

function bestUnknownContinuation(contexts: readonly LineContext[] = []): LineStructure | null {
  return contexts
    .map((context) => ({
      pathCost: context.pathCost + 1,
      depth: context.depth + 1,
      localOrder: 0,
      rootOrder: context.rootOrder,
    }))
    .sort(compareLineStructure)[0] ?? null;
}

export function composeLineNeighborhood({
  center,
  incoming = [],
  outgoingBySource = new Map<string, readonly SelectionCandidate[]>(),
  unresolvedReadings = new Set<string>(),
  legalTargetsBySource = new Map<string, ReadonlySet<string>>(),
  max = 19,
}: LineNeighborhoodOptions): LineCompositionPlan {
  const visible = createVisibleGraph({ center, direction: 'lines', max });

  incoming
    .slice()
    .sort((a, b) => (b.games ?? 0) - (a.games ?? 0) || a.key.localeCompare(b.key))
    .slice(0, Math.min(4, Math.max(1, Math.floor(max / 4))))
    .forEach((item) => visible.addNode({ ...item, relation: 'incoming', distance: 1 }));

  const agenda: LineAgendaItem[] = selectedLineCandidates(outgoingBySource, center)
    .map((candidate, rootOrder) => ({
      key: candidate.edge.target,
      candidate,
      family: candidate.edge.uci,
      lineShare: candidate.frequency?.share ?? 0,
      rootOrder,
      localOrder: rootOrder,
      depth: 1,
      pathCost: 1 + rootOrder,
    }));
  const expandedContexts = new Set<string>();
  const contextsByNode = new Map<string, LineContext[]>();
  const selectedRank = new Map<string, LineAgendaItem>();

  function noteContext(key: string, context: LineContext): void {
    if (!contextsByNode.has(key)) contextsByNode.set(key, []);
    const contexts = contextsByNode.get(key);
    if (contexts && !contexts.some((item) => item.family === context.family)) contexts.push(context);
  }

  function expand(key: string, context: LineContext): void {
    const id = `${context.family}\u0000${key}`;
    if (expandedContexts.has(id)) return;
    expandedContexts.add(id);
    agenda.push(...lineChildren(outgoingBySource, key, context));
    agenda.sort(compareLineCandidates);
  }

  agenda.sort(compareLineCandidates);
  while (agenda.length) {
    const next = agenda.shift();
    if (!next) break;
    if (!visible.hasNode(next.key) && visible.boardCount() >= max) continue;

    if (next.depth === 1) {
      visible.ensureFamily(next.family, {
        lineShare: next.lineShare,
        rootEdgeId: edgeId(next.candidate.edge),
      });
    } else {
      visible.ensureFamily(next.family, { lineShare: next.lineShare });
    }

    const result = visible.addNode({
      key: next.key,
      edge: next.candidate.edge,
      relation: next.depth === 1 ? 'outgoing' : 'descendant',
      distance: next.depth,
      branch: next.family,
      lineShare: next.lineShare,
      families: [next.family],
    });
    if (!result.node) continue;

    visible.addRelationship({
      candidate: next.candidate,
      family: next.family,
      distance: next.depth,
    });

    const context: LineContext = {
      family: next.family,
      lineShare: next.lineShare,
      rootOrder: next.rootOrder,
      depth: next.depth,
      pathCost: next.pathCost,
    };
    noteContext(next.key, context);
    if (result.added) selectedRank.set(next.key, next);
    expand(next.key, context);
  }

  const composition = visible.result();
  const constrained = composition.nodes.length >= max;
  const marginal = constrained
    ? [...selectedRank.values()].sort(compareLineStructure).at(-1) ?? null
    : null;
  const visibleKeys = new Set([center, ...composition.nodes.map((node) => node.key)]);
  const selectedTargets = new Map<string, Set<string>>();
  for (const relationship of composition.relationships) {
    if (!selectedTargets.has(relationship.source)) selectedTargets.set(relationship.source, new Set());
    selectedTargets.get(relationship.source)?.add(relationship.target);
  }

  const readingFrontier = composition.nodes
    .filter((node) => unresolvedReadings.has(node.key))
    .filter((node) => {
      const legalTargets = legalTargetsBySource.get(node.key) ?? new Set<string>();
      const knownTargets = selectedTargets.get(node.key) ?? new Set<string>();
      if ([...legalTargets].some((target) => visibleKeys.has(target) && !knownTargets.has(target))) {
        return true;
      }
      if (!constrained) return true;
      const best = bestUnknownContinuation(contextsByNode.get(node.key));
      return Boolean(best && marginal && compareLineStructure(best, marginal) <= 0);
    })
    .map((node) => node.key);

  return { composition, readingFrontier };
}

export function chooseLineNeighborhood(options: LineNeighborhoodOptions): VisibleComposition {
  return composeLineNeighborhood(options).composition;
}

function rootCandidates(
  incomingByTarget: ReadonlyMap<string, readonly SelectionCandidate[]>,
  target: string,
  distance: number,
): RootAgendaItem[] {
  return (incomingByTarget.get(target) ?? [])
    .map((candidate) => ({ key: candidate.edge.source, candidate, distance }));
}

export function chooseRootNeighborhood({
  center,
  incomingByTarget = new Map<string, readonly SelectionCandidate[]>(),
  max = 19,
}: RootNeighborhoodOptions): VisibleComposition {
  const visible = createVisibleGraph({ center, direction: 'roots', max });
  const frontiers: RootFrontier[] = [];

  const immediate = [...(incomingByTarget.get(center) ?? [])];

  for (const candidate of immediate) {
    const edge = candidate.edge;
    const family = edge.source;
    if (!visible.hasNode(family) && visible.boardCount() >= max) continue;
    visible.ensureFamily(family, { rootEdgeId: edgeId(edge) });
    const result = visible.addNode({
      key: family,
      edge,
      relation: 'root',
      distance: 1,
      branch: family,
      branches: [family],
      families: [family],
    });
    if (!result.node) continue;
    visible.addRelationship({ candidate, family, distance: 1 });
    frontiers.push({
      branch: family,
      pending: rootCandidates(incomingByTarget, family, 2),
      seenEdges: new Set([edgeId(edge)]),
    });
  }

  while (frontiers.some((frontier) => frontier.pending.length > 0)) {
    let progressed = false;

    for (const frontier of frontiers) {
      while (frontier.pending.length) {
        const next = frontier.pending.shift();
        if (!next || next.key === center) continue;
        const edge = next.candidate.edge;
        const candidateEdgeId = edgeId(edge);
        if (frontier.seenEdges.has(candidateEdgeId)) continue;
        frontier.seenEdges.add(candidateEdgeId);
        if (!visible.hasNode(next.key) && visible.boardCount() >= max) continue;

        const downstream = visible.getNode(edge.target);
        const families = downstream?.families?.length ? downstream.families : [frontier.branch];
        families.forEach((family) => visible.ensureFamily(family));
        const result = visible.addNode({
          key: next.key,
          edge,
          distance: next.distance,
          relation: 'root',
          branch: families[0] ?? frontier.branch,
          branches: families,
          families,
        });
        if (!result.node) continue;
        visible.addRelationship({ candidate: next.candidate, families, distance: next.distance });

        frontier.pending.push(...rootCandidates(
          incomingByTarget,
          next.key,
          next.distance + 1,
        ));
        progressed = true;
        break;
      }
    }

    if (!progressed) break;
  }

  const composition = visible.result();
  for (const node of composition.nodes) {
    node.branches = [...node.families];
    node.edges = visible.relationshipsFor(node.key, { incoming: false })
      .map((relationship) => relationship.edge);
    node.edge = node.edges[0] ?? node.edge;
    node.branch = node.branches[0] ?? node.branch;
    node.merge = node.edges.length > 1;
  }
  return composition;
}
