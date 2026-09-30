import { edgeId, stableEdgeOrder } from './graph.js';

/**
 * @typedef {Object} VisibleComposition
 * @property {Object[]} nodes
 * @property {Object[]} relationships
 * @property {Object[]} families
 */

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function createVisibleGraph({ center, direction, max = 19 }) {
  const nodes = [];
  const nodesByKey = new Map();
  const relationships = [];
  const relationshipsById = new Map();
  const families = new Map();

  const centerNode = {
    key: center,
    distance: 0,
    relation: 'center',
    families: [],
    relationships: [],
    merge: false,
  };
  nodesByKey.set(center, centerNode);

  function refreshMerge(node) {
    if (!node) return;
    const converging = node.relationships
      .map((id) => relationshipsById.get(id))
      .filter((relationship) => relationship && (
        direction === 'roots'
          ? relationship.source === node.key
          : relationship.target === node.key
      ));
    node.merge = converging.length > 1;
  }

  function ensureFamily(id, metadata = {}) {
    if (!id) return null;
    const existing = families.get(id);
    if (existing) {
      Object.assign(existing, metadata);
      return existing;
    }
    const family = { id, ...metadata };
    families.set(id, family);
    return family;
  }

  function addNode({ key, distance, relation, families: familyIds = [], ...metadata }) {
    const existing = nodesByKey.get(key);
    if (existing) {
      existing.families = unique([...existing.families, ...familyIds]);
      refreshMerge(existing);
      return { node: existing, added: false };
    }
    if (nodes.length >= max) return { node: null, added: false };

    const node = {
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

  function addRelationship({ edge, family, families: familyIds = [], distance }) {
    if (!edge) return null;
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

    const relationship = {
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

  function relationshipsFor(key, { incoming = true, outgoing = true } = {}) {
    const node = nodesByKey.get(key);
    if (!node) return [];
    return node.relationships
      .map((id) => relationshipsById.get(id))
      .filter((relationship) => relationship && (
        (incoming && relationship.target === key)
        || (outgoing && relationship.source === key)
      ));
  }

  /** @returns {VisibleComposition} */
  function result() {
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
    getNode: (key) => nodesByKey.get(key) ?? null,
    hasNode: (key) => nodesByKey.has(key),
    boardCount: () => nodes.length,
    relationshipsFor,
    result,
  };
}

function rankedLineEdges(outgoingBySource, key) {
  return (outgoingBySource.get(key) ?? [])
    .filter((edge) => edge.qualifies || edge.manual)
    .slice()
    .sort(stableEdgeOrder);
}

function compareLineStructure(a, b) {
  return a.pathCost - b.pathCost
    || a.depth - b.depth
    || a.localOrder - b.localOrder
    || a.rootOrder - b.rootOrder;
}

function compareLineCandidates(a, b) {
  return compareLineStructure(a, b)
    || a.family.localeCompare(b.family)
    || a.edge.uci.localeCompare(b.edge.uci)
    || a.edge.target.localeCompare(b.edge.target);
}

function lineChildren(outgoingBySource, key, context) {
  return rankedLineEdges(outgoingBySource, key).map((edge, localOrder) => ({
    key: edge.target,
    edge,
    family: context.family,
    lineShare: context.lineShare,
    rootOrder: context.rootOrder,
    localOrder,
    depth: context.depth + 1,
    pathCost: context.pathCost + 1 + localOrder,
  }));
}

function bestUnknownContinuation(contexts = []) {
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
  outgoingBySource = new Map(),
  unresolvedReadings = new Set(),
  legalTargetsBySource = new Map(),
  max = 19,
}) {
  const visible = createVisibleGraph({ center, direction: 'lines', max });

  incoming
    .slice()
    .sort((a, b) => (b.games ?? 0) - (a.games ?? 0) || a.key.localeCompare(b.key))
    .slice(0, Math.min(4, Math.max(1, Math.floor(max / 4))))
    .forEach((item) => visible.addNode({ ...item, relation: 'incoming', distance: 1 }));

  const agenda = rankedLineEdges(outgoingBySource, center).map((edge, rootOrder) => ({
    key: edge.target,
    edge,
    family: edge.uci,
    lineShare: edge.share ?? 0,
    rootOrder,
    localOrder: rootOrder,
    depth: 1,
    pathCost: 1 + rootOrder,
  }));
  const expandedContexts = new Set();
  const contextsByNode = new Map();
  const selectedRank = new Map();

  function noteContext(key, context) {
    if (!contextsByNode.has(key)) contextsByNode.set(key, []);
    const contexts = contextsByNode.get(key);
    if (!contexts.some((item) => item.family === context.family)) contexts.push(context);
  }

  function expand(key, context) {
    const id = `${context.family}\u0000${key}`;
    if (expandedContexts.has(id)) return;
    expandedContexts.add(id);
    agenda.push(...lineChildren(outgoingBySource, key, context));
    agenda.sort(compareLineCandidates);
  }

  agenda.sort(compareLineCandidates);
  while (agenda.length) {
    const next = agenda.shift();
    if (!visible.hasNode(next.key) && visible.boardCount() >= max) continue;

    if (next.depth === 1) {
      visible.ensureFamily(next.family, {
        lineShare: next.lineShare,
        rootEdgeId: edgeId(next.edge),
      });
    } else {
      visible.ensureFamily(next.family, { lineShare: next.lineShare });
    }

    const result = visible.addNode({
      key: next.key,
      edge: next.edge,
      relation: next.depth === 1 ? 'outgoing' : 'descendant',
      distance: next.depth,
      branch: next.family,
      lineShare: next.lineShare,
      families: [next.family],
    });
    if (!result.node) continue;

    visible.addRelationship({
      edge: next.edge,
      family: next.family,
      distance: next.depth,
    });

    const context = {
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
  const selectedTargets = new Map();
  for (const relationship of composition.relationships) {
    if (!selectedTargets.has(relationship.source)) selectedTargets.set(relationship.source, new Set());
    selectedTargets.get(relationship.source).add(relationship.target);
  }

  const readingFrontier = composition.nodes
    .filter((node) => unresolvedReadings.has(node.key))
    .filter((node) => {
      const legalTargets = legalTargetsBySource.get(node.key) ?? new Set();
      const knownTargets = selectedTargets.get(node.key) ?? new Set();
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

/** @returns {VisibleComposition} */
export function chooseLineNeighborhood(options) {
  return composeLineNeighborhood(options).composition;
}

function rootCandidates(incomingByTarget, target, distance) {
  return (incomingByTarget.get(target) ?? [])
    .map((edge) => ({ key: edge.source, edge, distance }));
}

/** @returns {VisibleComposition} */
export function chooseRootNeighborhood({ center, incomingByTarget = new Map(), max = 19 }) {
  const visible = createVisibleGraph({ center, direction: 'roots', max });
  const frontiers = [];

  const immediate = (incomingByTarget.get(center) ?? []).slice();

  for (const edge of immediate) {
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
    visible.addRelationship({ edge, family, distance: 1 });
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
        const candidate = frontier.pending.shift();
        if (!candidate || candidate.key === center) continue;
        const candidateEdgeId = edgeId(candidate.edge);
        if (frontier.seenEdges.has(candidateEdgeId)) continue;
        frontier.seenEdges.add(candidateEdgeId);
        if (!visible.hasNode(candidate.key) && visible.boardCount() >= max) continue;

        const downstream = visible.getNode(candidate.edge.target);
        const families = downstream?.families?.length ? downstream.families : [frontier.branch];
        families.forEach((family) => visible.ensureFamily(family));
        const result = visible.addNode({
          ...candidate,
          relation: 'root',
          branch: families[0] ?? frontier.branch,
          branches: families,
          families,
        });
        if (!result.node) continue;
        visible.addRelationship({ edge: candidate.edge, families, distance: candidate.distance });

        frontier.pending.push(...rootCandidates(
          incomingByTarget,
          candidate.key,
          candidate.distance + 1,
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
