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
import { isObsoleteWork } from './obsolete-work.js';
import { positionGraph } from './position-graph.ts';
import type { GraphEdge, PositionGraph } from './position-graph.ts';

export type RailValue = Readonly<{
  rootsCount: number;
  lines: readonly unknown[];
}>;

export type RailLoadOptions = Readonly<{
  center?: string;
  signal?: AbortSignal;
  onProgress?: (value: RailValue) => unknown | Promise<unknown>;
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
  acquireExplorer = acquireExplorerReading as AcquireExplorer,
  graph = positionGraph,
  evalProvider = lichessEval as EvalProvider,
  loadMastersReading = loadMasters as MastersLoader,
}: RailSourceOptions = {}) {
  return async function loadRail({ center, signal, onProgress }: RailLoadOptions = {}) {
    throwIfAborted(signal);
    const [explorer, incoming, outgoing] = await Promise.all([
      acquireExplorer(center, { signal }),
      graph.incoming(center),
      graph.outgoing(center),
    ]);
    throwIfAborted(signal);

    let sourceEval: unknown = null;
    let masters: unknown = null;
    let current = railValue(center, explorer, incoming, outgoing, sourceEval, masters);
    await onProgress?.(current);

    async function supplement(label: string, load: () => Promise<unknown>): Promise<unknown> {
      try {
        return await load();
      } catch (error) {
        if (isObsoleteWork(error, signal)) throw error;
        debugLog(`Rail ${label} unavailable`, {
          position: center,
          error: error?.message ?? String(error),
        }, 'warn');
        return null;
      }
    }

    async function publish(): Promise<void> {
      throwIfAborted(signal);
      current = railValue(center, explorer, incoming, outgoing, sourceEval, masters);
      await onProgress?.(current);
    }

    await Promise.all([
      supplement('engine evidence', () => evalProvider.get(center, { signal }))
        .then(async (value) => {
          sourceEval = value;
          await publish();
        }),
      supplement('Masters evidence', () => loadMastersReading(center, { signal }))
        .then(async (value) => {
          masters = value;
          await publish();
        }),
    ]);

    throwIfAborted(signal);
    return current;
  };
}

export const loadNodusRail = createRailSource();
