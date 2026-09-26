import { getIncoming, getNode, getOutgoing } from './db.js';
import {
  START_FEN,
  canonicalPosition,
  chooseNeighborhood,
  chooseRootNeighborhood,
  stableEdgeOrder,
  toPlayableFen,
} from './graph.js';
import { formatPgnMoves, formatPgnSuffix, reconstructPgnPath } from './pgn.js';
import { expandMoveOrderTranspositions } from './transpositions.js';

const START = canonicalPosition(START_FEN);
const expandedTargets = new Set();
const expandingTargets = new Map();

function abortError() {
  const error = new Error('Nodus structure composition aborted');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, immutable(child)]),
    ));
  }
  return value;
}

function normalizeComposition(value) {
  const nodes = (value?.nodes ?? value ?? []).map((node) => ({
    ...node,
    families: [...(node.families ?? [])],
    branches: [...(node.branches ?? [])],
    relationships: [...(node.relationships ?? [])],
    edges: node.edges?.map((edge) => ({ ...edge })),
    edge: node.edge ? { ...node.edge } : null,
  }));
  const relationships = (value?.relationships ?? []).map((relationship) => ({
    ...relationship,
    families: [...(relationship.families ?? [])],
    edge: relationship.edge ? { ...relationship.edge } : null,
  }));
  const families = (value?.families ?? []).map((family) => ({ ...family }));
  return immutable({
    center: value?.center,
    direction: value?.direction,
    nodes,
    relationships,
    families,
  });
}

async function collectOutgoingGraph(center, max, signal) {
  const outgoingBySource = new Map();
  const queue = [{ key: center, depth: 0 }];
  const visited = new Set();
  while (queue.length && visited.size < max * 3) {
    throwIfAborted(signal);
    const current = queue.shift();
    if (visited.has(current.key) || current.depth > max) continue;
    visited.add(current.key);
    const edges = await getOutgoing(current.key);
    throwIfAborted(signal);
    outgoingBySource.set(current.key, edges);
    for (const edge of edges.filter((item) => item.qualifies || item.manual).sort(stableEdgeOrder)) {
      if (!visited.has(edge.target)) queue.push({ key: edge.target, depth: current.depth + 1 });
    }
  }
  return outgoingBySource;
}

async function collectIncomingGraph(center, max, signal) {
  const incomingByTarget = new Map();
  const queue = [{ key: center, depth: 0 }];
  const visited = new Set();
  while (queue.length && visited.size < max * 3) {
    throwIfAborted(signal);
    const current = queue.shift();
    if (visited.has(current.key) || current.depth > max) continue;
    visited.add(current.key);
    const edges = await getIncoming(current.key);
    throwIfAborted(signal);
    incomingByTarget.set(current.key, edges);
    for (const edge of edges) if (!visited.has(edge.source)) queue.push({ key: edge.source, depth: current.depth + 1 });
  }
  return incomingByTarget;
}

async function collectIncomingToStart(target, { maxDepth = 32, signal } = {}) {
  const incomingByTarget = new Map();
  const queue = [{ key: target, depth: 0 }];
  const seen = new Set();
  while (queue.length) {
    throwIfAborted(signal);
    const current = queue.shift();
    if (seen.has(current.key) || current.depth >= maxDepth) continue;
    seen.add(current.key);
    const incoming = await getIncoming(current.key);
    throwIfAborted(signal);
    incomingByTarget.set(current.key, incoming);
    if (incoming.some((edge) => edge.source === START)) break;
    for (const edge of incoming) {
      if (!seen.has(edge.source)) queue.push({ key: edge.source, depth: current.depth + 1 });
    }
  }
  return incomingByTarget;
}

async function expandCurrentRootTranspositions(target, signal) {
  throwIfAborted(signal);
  if (!target || expandedTargets.has(target)) return;
  if (expandingTargets.has(target)) return expandingTargets.get(target);
  const promise = (async () => {
    const incomingByTarget = await collectIncomingToStart(target, { signal });
    throwIfAborted(signal);
    const referencePath = reconstructPgnPath(target, incomingByTarget, START);
    if (!referencePath?.length) return;
    await expandMoveOrderTranspositions(referencePath, target, { maxPaths: 256, maxStates: 75_000 });
    throwIfAborted(signal);
    expandedTargets.add(target);
  })().finally(() => expandingTargets.delete(target));
  expandingTargets.set(target, promise);
  return promise;
}

async function rootRows(composition, signal) {
  const rows = await Promise.all(composition.nodes.map(async (node) => {
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
  return immutable(rows.filter(Boolean));
}

export async function composeNodusStructure({ center, mode, max = 19, signal } = {}) {
  throwIfAborted(signal);
  if (mode === 'roots') await expandCurrentRootTranspositions(center, signal);
  throwIfAborted(signal);

  const [incomingEdges, outgoingEdges] = await Promise.all([
    getIncoming(center),
    getOutgoing(center),
  ]);
  throwIfAborted(signal);

  let selected;
  if (mode === 'roots') {
    const incomingByTarget = await collectIncomingGraph(center, max, signal);
    selected = chooseRootNeighborhood({ center, incomingByTarget, max });
  } else {
    const outgoingBySource = await collectOutgoingGraph(center, max, signal);
    selected = chooseNeighborhood({ center, incoming: [], outgoingBySource, max });
  }
  throwIfAborted(signal);

  const composition = normalizeComposition(selected);
  const keys = [center, ...composition.nodes.map((node) => node.key)];
  const nodeValues = await Promise.all(keys.map(async (key) => {
    const value = (await getNode(key)) ?? { key, fen: toPlayableFen(key) };
    throwIfAborted(signal);
    return [key, immutable({ ...value })];
  }));
  const records = new Map(nodeValues);
  const positions = composition.nodes.map((node) => immutable({
    ...node,
    record: records.get(node.key) ?? { key: node.key, fen: toPlayableFen(node.key) },
  }));

  const lineEdges = outgoingEdges
    .filter((edge) => edge.qualifies || edge.manual)
    .slice()
    .sort(stableEdgeOrder)
    .map((edge) => immutable({ ...edge }));

  return immutable({
    composition,
    centerNode: records.get(center) ?? { key: center, fen: toPlayableFen(center) },
    positions,
    incomingCount: incomingEdges.length,
    lineEdges,
    rootRows: mode === 'roots' ? await rootRows(composition, signal) : [],
  });
}
