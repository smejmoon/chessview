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
  loadExplorerReading,
  subscribeExplorerReadings,
  type ExplorerObservation,
} from './explorer.js';
import type { ExplorerLoadOptions, ExplorerReading } from './knowledge-acquisition.ts';
import { lichessEval } from './lichess-eval.js';
import { loadMasters } from './masters.js';
import { isObsoleteWork, throwIfObsolete } from './obsolete-work.js';
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

type LoadExplorer = (
  position: string,
  options?: ExplorerLoadOptions,
) => Promise<ExplorerReading | null>;

type CurrentExplorer = (position: string) => ExplorerReading | null;
type ObserveExplorer = (listener: (observation: ExplorerObservation) => void) => () => void;

type EvalProvider = Readonly<{
  get(position: string, options?: Readonly<{ signal?: AbortSignal }>): Promise<unknown>;
}>;

type MastersLoader = (
  position: string,
  options?: Readonly<{ signal?: AbortSignal }>,
) => Promise<unknown>;

export type RailSourceOptions = Readonly<{
  loadExplorer?: LoadExplorer;
  currentExplorer?: CurrentExplorer;
  observeExplorer?: ObserveExplorer;
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
  loadExplorer = loadExplorerReading as LoadExplorer,
  currentExplorer = currentExplorerReading as CurrentExplorer,
  observeExplorer = subscribeExplorerReadings as ObserveExplorer,
  graph = positionGraph,
  evalProvider = lichessEval as EvalProvider,
  loadMastersReading = loadMasters as MastersLoader,
}: RailSourceOptions = {}) {
  return async function loadRail({ center, signal, onProgress }: RailLoadOptions = {}) {
    throwIfObsolete(signal, 'Rail view became obsolete');

    const [incoming, outgoing] = await Promise.all([
      graph.incoming(center),
      graph.outgoing(center),
    ]);
    throwIfObsolete(signal, 'Rail view became obsolete');

    let explorer: ExplorerReading | null = currentExplorer(center);
    let sourceEval: unknown = null;
    let masters: unknown = null;
    let current = railValue(center, explorer, incoming, outgoing, sourceEval, masters);
    await onProgress?.(current);

    let publishTail = Promise.resolve();
    async function publish(): Promise<void> {
      throwIfObsolete(signal, 'Rail view became obsolete');
      current = railValue(center, explorer, incoming, outgoing, sourceEval, masters);
      await onProgress?.(current);
    }
    function queuePublish(): Promise<void> {
      publishTail = publishTail.catch(() => undefined).then(publish);
      return publishTail;
    }

    const stopObservingExplorer = observeExplorer((observation) => {
      if (observation.position !== center || signal?.aborted) return;
      if (observation.reading === explorer) return;
      explorer = observation.reading;
      void queuePublish();
    });

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

    try {
      const explorerWork = (async () => {
        let value: ExplorerReading | null;
        try {
          value = await loadExplorer(center, { signal });
        } catch (error) {
          if (isObsoleteWork(error, signal)) throw error;
          debugLog('Rail Explorer unavailable; keeping known graph inventory', {
            position: center,
            error: error?.message ?? String(error),
          }, 'warn');
          return;
        }
        if (!value || value === explorer) return;
        explorer = value;
        await queuePublish();
      })();

      const engineWork = supplement('engine evidence', () => evalProvider.get(center, { signal }))
        .then(async (value) => {
          sourceEval = value;
          await queuePublish();
        });

      const mastersWork = supplement('Masters evidence', () => loadMastersReading(center, { signal }))
        .then(async (value) => {
          masters = value;
          await queuePublish();
        });

      await Promise.all([explorerWork, engineWork, mastersWork]);
      await publishTail;

      throwIfObsolete(signal, 'Rail view became obsolete');
      return current;
    } finally {
      stopObservingExplorer();
    }
  };
}

export const loadNodusRail = createRailSource();
