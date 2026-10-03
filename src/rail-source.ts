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
import {
  currentExplorerReading,
  readCachedExplorerReading,
} from './explorer.js';
import type { ExplorerReading } from './knowledge-acquisition.ts';
import { lichessEval } from './lichess-eval.js';
import { mastersProvider } from './masters.js';
import { throwIfObsolete } from './obsolete-work.js';
import { positionGraph } from './position-graph.ts';
import type { GraphEdge, PositionGraph } from './position-graph.ts';

export type RailValue = Readonly<{
  rootsCount: number;
  lines: readonly unknown[];
}>;

export type RailLoadOptions = Readonly<{
  center?: string;
  signal?: AbortSignal;
}>;

type CurrentExplorer = (position: string) => ExplorerReading | null;
type ReadCachedExplorer = (position: string) => Promise<ExplorerReading | null>;

type EvalProvider = Readonly<{
  available(position: string): Promise<unknown>;
}>;

type MastersProvider = Readonly<{
  available(position: string): Promise<unknown>;
}>;

export type RailSourceOptions = Readonly<{
  currentExplorer?: CurrentExplorer;
  readCachedExplorer?: ReadCachedExplorer;
  graph?: Pick<PositionGraph, 'incoming' | 'outgoing'>;
  evalProvider?: EvalProvider;
  mastersProvider?: MastersProvider;
}>;

type DecoratedExplorerMove = Readonly<{
  uci: string;
  games?: number;
  share?: number;
  [field: string]: unknown;
}>;

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
    source: 'explicit' as const,
  });
}

function railValue(
  center: string,
  explorer: ExplorerReading | null,
  incoming: readonly unknown[],
  outgoing: readonly GraphEdge[],
  sourceEval: unknown,
  masters: unknown,
): RailValue {
  const sourceLines = (decorateExplorerMoves(explorer) as DecoratedExplorerMove[])
    .map((move) => sourceLine(center, explorer, move, sourceEval, masters))
    .filter(Boolean);
  const sourceUci = new Set(sourceLines.map((line) => line.edge.uci));
  const explicitLines = outgoing
    .filter((edge) => edge.explicit && !sourceUci.has(edge.uci))
    .sort(stableEdgeOrder)
    .map((edge) => explicitLine(center, edge, sourceEval, masters));

  return immutable({
    rootsCount: incoming.length,
    lines: [...sourceLines, ...explicitLines],
  });
}

export function createRailSource({
  currentExplorer = currentExplorerReading as CurrentExplorer,
  readCachedExplorer = readCachedExplorerReading as ReadCachedExplorer,
  graph = positionGraph,
  evalProvider = lichessEval as EvalProvider,
  mastersProvider: masters = mastersProvider as MastersProvider,
}: RailSourceOptions = {}) {
  return async function composeRail({ center, signal }: RailLoadOptions = {}) {
    throwIfObsolete(signal, 'Rail view became obsolete');

    const [incoming, outgoing, cachedExplorer, sourceEval, mastersReading] = await Promise.all([
      graph.incoming(center),
      graph.outgoing(center),
      readCachedExplorer(center),
      evalProvider.available(center),
      masters.available(center),
    ]);
    throwIfObsolete(signal, 'Rail view became obsolete');

    const explorer = currentExplorer(center) ?? cachedExplorer;
    return railValue(center, explorer, incoming, outgoing, sourceEval, mastersReading);
  };
}

export const composeNodusRail = createRailSource();
