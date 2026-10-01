import {
  decorateExplorerMoves,
  resolveMove,
  stableEdgeOrder,
} from './graph.js';
import { debugLog } from './debug.js';
import {
  humanMismatch,
  humanResultQuality,
  moveEvaluation,
  moveFrequency,
} from './evidence.js';
import { acquireExplorerReading } from './knowledge-acquisition.js';
import { lichessEval } from './lichess-eval.js';
import { loadMasters } from './masters.js';
import { positionGraph } from './position-graph.js';
import { isNotableLine } from './rail-selection.js';

function abortError() {
  const error = new Error('Rail view became obsolete');
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

function sourceLine(center, explorer, move, sourceEval, masters) {
  let resolved;
  try {
    resolved = resolveMove(center, { uci: move.uci });
  } catch (error) {
    debugLog('ignored Rail Explorer move', {
      position: center,
      uci: move.uci,
      error: error?.message ?? String(error),
    }, 'warn');
    return null;
  }

  const edge = {
    source: center,
    target: resolved.target,
    uci: resolved.uci,
    san: resolved.san,
    games: move.games,
    share: move.share,
    manual: false,
    derived: false,
  };
  const frequency = moveFrequency(explorer, edge);
  const moveEval = moveEvaluation(center, edge, sourceEval);
  const humanResult = humanResultQuality(explorer, edge, center);
  return immutable({
    edge,
    frequency,
    moveEval,
    humanResult,
    mastersMismatch: humanMismatch(masters, edge, center, moveEval),
    lichessMismatch: humanMismatch(explorer, edge, center, moveEval),
    notable: isNotableLine({
      edge,
      frequency,
      engineQuality: moveEval,
      humanResult,
    }),
    source: 'lichess',
  });
}

function manualLine(center, edge, sourceEval, masters) {
  const moveEval = moveEvaluation(center, edge, sourceEval);
  return immutable({
    edge,
    frequency: null,
    moveEval,
    humanResult: null,
    mastersMismatch: humanMismatch(masters, edge, center, moveEval),
    lichessMismatch: null,
    notable: false,
    source: 'manual',
  });
}

export function createRailSource({
  acquireExplorer = acquireExplorerReading,
  graph = positionGraph,
  evalProvider = lichessEval,
  loadMastersReading = loadMasters,
} = {}) {
  return async function loadRail({ center, signal } = {}) {
    throwIfAborted(signal);
    const [explorer, incoming, outgoing, sourceEval, masters] = await Promise.all([
      acquireExplorer(center, { signal }),
      graph.incoming(center),
      graph.outgoing(center),
      evalProvider.get(center, { signal }),
      loadMastersReading(center, { signal }),
    ]);
    throwIfAborted(signal);

    const sourceLines = decorateExplorerMoves(explorer)
      .map((move) => sourceLine(center, explorer, move, sourceEval, masters))
      .filter(Boolean);
    const sourceUci = new Set(sourceLines.map((line) => line.edge.uci));
    const manualLines = outgoing
      .filter((edge) => edge.manual && !sourceUci.has(edge.uci))
      .sort(stableEdgeOrder)
      .map((edge) => manualLine(center, edge, sourceEval, masters));
    const lines = immutable([...sourceLines, ...manualLines]);

    return immutable({
      rootsCount: incoming.length,
      notableLinesCount: sourceLines.filter((line) => line.notable).length,
      lines,
      masters,
    });
  };
}

export const loadNodusRail = createRailSource();
