import {
  addLineCandidates,
  createLineFrontier,
  hasLineCandidates,
  takeLineCandidate,
} from './line-frontier.js';
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

function lineChildren(outgoingBySource, key, distance, breadth = 0) {
  return (outgoingBySource.get(key) ?? [])
    .filter((edge) => edge.qualifies)
    .slice()
    .sort(stableEdgeOrder)
    .map((edge, index) => ({
      key: edge.target,
      edge,
      distance,
      depth: distance,
      breadth: breadth + index,
    }));
}

/** @returns {VisibleComposition} */
export function chooseLineNeighborhood({ center, incoming = [], outgoingBySource = new Map(), max = 19 }) {
  const visible = createVisibleGraph({ center, direction: 'lines', max });

  incoming
    .slice()
    .sort((a, b) => (b.games ?? 0) - (a.games ?? 0) || a.key.localeCompare(b.key))
    .slice(0, Math.min(4, Math.max(1, Math.floor(max / 4))))
    .forEach((item) => visible.addNode({ ...item, relation: 'incoming', distance: 1 }));

  const roots = (outgoingBySource.get(center) ?? [])
    .filter((edge) => edge.qualifies || edge.manual)
    .slice()
    .sort(stableEdgeOrder);

  const lineFrontiers = [];
  for (const root of roots) {
    if (!visible.hasNode(root.target) && visible.boardCount() >= max) continue;
    const family = root.uci;
    const lineShare = root.share ?? 0;
    visible.ensureFamily(family, { lineShare, rootEdgeId: edgeId(root) });
    const result = visible.addNode({
      key: root.target,
      edge: root,
      relation: 'outgoing',
      distance: 1,
      branch: family,
      lineShare,
      families: [family],
    });
    if (!result.node) continue;
    visible.addRelationship({ edge: root, family, distance: 1 });

    const frontier = createLineFrontier(family, null, lineShare);
    frontier.seenEdges = new Set([edgeId(root)]);
    addLineCandidates(frontier, lineChildren(outgoingBySource, root.target, 2));
    lineFrontiers.push(frontier);
  }

  while (hasLineCandidates(lineFrontiers)) {
    let progressed = false;
    for (const frontier of lineFrontiers) {
      const next = takeLineCandidate(frontier, (candidate) => (
        !frontier.seenEdges.has(edgeId(candidate.edge))
        && (visible.hasNode(candidate.key) || visible.boardCount() < max)
      ));
      if (!next) continue;
      frontier.seenEdges.add(edgeId(next.edge));

      const result = visible.addNode({
        ...next,
        relation: 'descendant',
        branch: frontier.branch,
        lineShare: frontier.lineShare,
        families: [frontier.branch],
      });
      if (!result.node) continue;

      visible.addRelationship({
        edge: next.edge,
        family: frontier.branch,
        distance: next.distance,
      });
      addLineCandidates(frontier, lineChildren(
        outgoingBySource,
        next.key,
        next.distance + 1,
        next.breadth,
      ));
      progressed = true;
    }
    if (!progressed) break;
  }

  return visible.result();
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
