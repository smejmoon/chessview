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
import type { ExplorerLoadOptions, ExplorerReading } from './knowledge-acquisition.ts';
import { lichessEval } from './lichess-eval.js';
import { loadMasters } from './masters.js';
import { positionGraph } from './position-graph.ts';
import type { GraphEdge, PositionGraph } from './position-graph.ts';
import { isNotableLine } from './rail-selection.ts';

export type RailLoadOptions = Readonly<{
  center?: string;
  signal?: AbortSignal;
}>;

type AcquireExplorer = (
  position: string,
  options?: ExplorerLoadOptions,
) => Promise<ExplorerReading | null>;

type EvalProvider = Readonly<{
  get(position: string, options?: Readonly<{ signal?: AbortSignal }>): Promise<unknown>;
}>;

type MastersLoader = (
  position: string,
  options?: Readonly<{ signal?: AbortSignal }>,
) => Promise<unknown>;

export type RailSourceOptions = Readonly<{
  acquireExplorer?: AcquireExplorer;
  graph?: Pick<PositionGraph, 'incoming' | 'outgoing'>;
  evalProvider?: EvalProvider;
  loadMastersReading?: MastersLoader;
}>;

type DecoratedExplorerMove = Readonly<{
  uci: string;
  games?: number;
  share?: number;
  [field: string]: unknown;
}>;

function abortError(): Error {
  const error = new Error('Rail view became obsolete');
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

function sourceLine(
  center: string,
  explorer: ExplorerReading | null,
  move: DecoratedExplorerMove,
  sourceEval: unknown,
  masters: unknown,
) {
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
    source: 'lichess' as const,
  });
}

function explicitLine(center: string, edge: GraphEdge, sourceEval: unknown, masters: unknown) {
  const moveEval = moveEvaluation(center, edge, sourceEval);
  return immutable({
    edge,
    frequency: null,
    moveEval,
    humanResult: null,
    mastersMismatch: humanMismatch(masters, edge, center, moveEval),
    lichessMismatch: null,
    notable: false,
    source: 'explicit' as const,
  });
}

export function createRailSource({
  acquireExplorer = acquireExplorerReading as AcquireExplorer,
  graph = positionGraph,
  evalProvider = lichessEval as EvalProvider,
  loadMastersReading = loadMasters as MastersLoader,
}: RailSourceOptions = {}) {
  return async function loadRail({ center, signal }: RailLoadOptions = {}) {
    throwIfAborted(signal);
    const [explorer, incoming, outgoing, sourceEval, masters] = await Promise.all([
      acquireExplorer(center, { signal }),
      graph.incoming(center),
      graph.outgoing(center),
      evalProvider.get(center, { signal }),
      loadMastersReading(center, { signal }),
    ]);
    throwIfAborted(signal);

    const sourceLines = (decorateExplorerMoves(explorer) as DecoratedExplorerMove[])
      .map((move) => sourceLine(center, explorer, move, sourceEval, masters))
      .filter(Boolean);
    const sourceUci = new Set(sourceLines.map((line) => line.edge.uci));
    const explicitLines = outgoing
      .filter((edge) => edge.explicit && !sourceUci.has(edge.uci))
      .sort(stableEdgeOrder)
      .map((edge) => explicitLine(center, edge, sourceEval, masters));
    const lines = immutable([...sourceLines, ...explicitLines]);

    return immutable({
      rootsCount: incoming.length,
      notableLinesCount: sourceLines.filter((line) => line.notable).length,
      lines,
      masters,
    });
  };
}

export const loadNodusRail = createRailSource();
