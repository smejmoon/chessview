import {
  START_FEN,
  canonicalPosition,
  toPlayableFen,
} from './graph.js';
import { chooseLineNeighborhood, chooseRootNeighborhood } from './visible-graph.js';
import { formatPgnMoves, formatPgnSuffix, reconstructPgnPath } from './pgn.js';
import { positionGraph } from './position-graph.js';
import { positionRepository } from './position-repository.js';
import { rootTranspositionEnricher } from './root-enrichment.js';
import { loadExplorer } from './explorer.js';
import { moveEvaluation } from './eval.js';
import { humanResultQuality, moveFrequency } from './evidence-signals.js';
import {
  rankCrossSourceCandidates,
  rankSameSourceCandidates,
  selectionCandidate,
} from './constellation-selection.js';

const START = canonicalPosition(START_FEN);

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

function createCandidateSource(signal, { hydrateExplorer = true } = {}) {
  const explorerLoads = new Map();

  function explorerFor(source) {
    if (explorerLoads.has(source)) return explorerLoads.get(source);
    const pending = (async () => {
      throwIfAborted(signal);
      const loaded = hydrateExplorer
        ? await loadExplorer(source, { signal })
        : await positionRepository.get(source);
      throwIfAborted(signal);
      return loaded?.explorer ?? null;
    })();
    explorerLoads.set(source, pending);
    return pending;
  }

  async function candidate(edge) {
    if (!edge) return null;
    if (edge.manual) {
      return selectionCandidate({ edge: { ...edge, qualifies: true } });
    }

    const explorer = await explorerFor(edge.source);
    throwIfAborted(signal);
    const frequency = moveFrequency(explorer, edge);
    if (!frequency) return null;

    const [sourceNode, targetNode] = await Promise.all([
      positionRepository.get(edge.source),
      positionRepository.get(edge.target),
    ]);
    throwIfAborted(signal);
    const projectedEdge = {
      ...edge,
      games: frequency.games,
      share: frequency.share,
      qualifies: true,
    };
    return selectionCandidate({
      edge: projectedEdge,
      frequency,
      engineQuality: moveEvaluation(edge.source, edge, sourceNode?.cloudEval, targetNode?.cloudEval),
      humanResult: humanResultQuality(explorer, edge, edge.source),
    });
  }

  async function outgoing(source) {
    if (hydrateExplorer) await explorerFor(source);
    throwIfAborted(signal);
    const edges = await positionGraph.outgoing(source);
    throwIfAborted(signal);
    const candidates = (await Promise.all(edges.map(candidate))).filter(Boolean);
    return rankSameSourceCandidates(candidates).map((item) => item.edge);
  }

  async function incoming(target) {
    const edges = await positionGraph.incoming(target);
    throwIfAborted(signal);
    const candidates = (await Promise.all(edges.map(candidate))).filter(Boolean);
    return rankCrossSourceCandidates(candidates).map((item) => item.edge);
  }

  return Object.freeze({ outgoing, incoming });
}

async function collectOutgoingGraph(center, capacity, candidateSource, signal) {
  const outgoingBySource = new Map();
  const queue = [center];
  const visited = new Set();
  while (queue.length && visited.size < capacity) {
    throwIfAborted(signal);
    const key = queue.shift();
    if (visited.has(key)) continue;
    visited.add(key);
    const edges = await candidateSource.outgoing(key);
    throwIfAborted(signal);
    outgoingBySource.set(key, edges);
    for (const edge of edges) {
      if (!visited.has(edge.target)) queue.push(edge.target);
    }
  }
  return outgoingBySource;
}

async function collectIncomingGraph(center, capacity, candidateSource, signal) {
  const incomingByTarget = new Map();
  const queue = [center];
  const visited = new Set();
  while (queue.length && visited.size < capacity) {
    throwIfAborted(signal);
    const key = queue.shift();
    if (visited.has(key)) continue;
    visited.add(key);
    const edges = await candidateSource.incoming(key);
    throwIfAborted(signal);
    incomingByTarget.set(key, edges);
    for (const edge of edges) {
      if (!visited.has(edge.source)) queue.push(edge.source);
    }
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

/** @typedef {'roots' | 'lines'} NodusMode */

/**
 * @typedef {Object} ComposeNodusStructureOptions
 * @property {string} center
 * @property {NodusMode} mode
 * @property {number} max
 * @property {AbortSignal} [signal]
 */

/**
 * @param {ComposeNodusStructureOptions} options
 */
export async function composeNodusStructure({ center, mode, max, signal }) {
  throwIfAborted(signal);
  const capacity = Math.max(1, Number.isFinite(max) ? Math.floor(max) : 1);
  if (mode === 'roots') await rootTranspositionEnricher.ensure(center, { signal });
  else await loadExplorer(center, { signal });
  throwIfAborted(signal);

  const candidateSource = createCandidateSource(signal, { hydrateExplorer: mode === 'roots' });
  const incomingEdges = await positionGraph.incoming(center);
  throwIfAborted(signal);

  let selected;
  let lineEdges = [];
  if (mode === 'roots') {
    const incomingByTarget = await collectIncomingGraph(center, capacity, candidateSource, signal);
    selected = chooseRootNeighborhood({ center, incomingByTarget, max: capacity });
  } else {
    const outgoingBySource = await collectOutgoingGraph(center, capacity, candidateSource, signal);
    selected = chooseLineNeighborhood({ center, incoming: [], outgoingBySource, max: capacity });
    lineEdges = (outgoingBySource.get(center) ?? []).map((edge) => immutable({ ...edge }));
  }
  throwIfAborted(signal);

  const composition = immutable(selected);
  const keys = [center, ...composition.nodes.map((node) => node.key)];
  const nodeValues = await Promise.all(keys.map(async (key) => {
    const value = (await positionRepository.get(key)) ?? { key, fen: toPlayableFen(key) };
    throwIfAborted(signal);
    return [key, immutable({ ...value })];
  }));
  const records = new Map(nodeValues);
  const positions = composition.nodes.map((node) => immutable({
    ...node,
    record: records.get(node.key) ?? { key: node.key, fen: toPlayableFen(node.key) },
  }));

  return immutable({
    composition,
    centerNode: records.get(center) ?? { key: center, fen: toPlayableFen(center) },
    positions,
    incomingCount: incomingEdges.length,
    lineEdges,
    rootRows: mode === 'roots' ? await rootRows(composition, signal) : [],
  });
}
