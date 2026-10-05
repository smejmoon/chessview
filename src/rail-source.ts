import {
  decorateExplorerMoves,
  resolveMove,
  stableEdgeOrder,
} from './graph.js';
import { debugLog } from './debug.js';
import { createEvidenceReader } from './evidence-source.ts';
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
  lines: readonly unknown[];
}>;

export type RailLoadOptions = Readonly<{
  center?: string;
  signal?: AbortSignal;
}>;

type CurrentExplorer = (position: string) => ExplorerReading | null;
type ReadCachedExplorer = (position: string) => Promise<ExplorerReading | null>;
type EvalProvider = Readonly<{ available(position: string): Promise<unknown> }>;
type MastersProvider = Readonly<{ available(position: string): Promise<unknown> }>;

export type RailSourceOptions = Readonly<{
  currentExplorer?: CurrentExplorer;
  readCachedExplorer?: ReadCachedExplorer;
  graph?: Pick<PositionGraph, 'outgoing'>;
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

async function sourceLine(center: string, move: DecoratedExplorerMove, evidence: ReturnType<typeof createEvidenceReader>) {
  let resolved;
  try {
    resolved = resolveMove(center, { uci: move.uci });
  } catch (error) {
    debugLog('ignored Rail Explorer move', {
      position: center,
      uci: move.uci,
      error: error instanceof Error ? error.message : String(error),
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
  const signals = await evidence.move(edge);
  return immutable({
    edge,
    frequency: signals.frequency,
    moveEval: signals.moveEval,
    humanResult: signals.humanResult,
    mastersMismatch: signals.mastersMismatch,
    lichessMismatch: signals.lichessMismatch,
    source: 'lichess' as const,
  });
}

async function explicitLine(edge: GraphEdge, evidence: ReturnType<typeof createEvidenceReader>) {
  const signals = await evidence.move(edge);
  return immutable({
    edge,
    frequency: signals.frequency,
    moveEval: signals.moveEval,
    humanResult: signals.humanResult,
    mastersMismatch: signals.mastersMismatch,
    lichessMismatch: signals.lichessMismatch,
    source: 'explicit' as const,
  });
}

async function railValue(
  center: string,
  explorer: ExplorerReading | null,
  outgoing: readonly GraphEdge[],
  evidence: ReturnType<typeof createEvidenceReader>,
): Promise<RailValue> {
  const sourceLines = (await Promise.all(
    (decorateExplorerMoves(explorer) as DecoratedExplorerMove[]).map((move) => sourceLine(center, move, evidence)),
  )).filter((line): line is NonNullable<typeof line> => Boolean(line));
  const sourceUci = new Set(sourceLines.map((line) => line.edge.uci));
  const explicitLines = await Promise.all(outgoing
    .filter((edge) => edge.explicit && !sourceUci.has(edge.uci))
    .sort(stableEdgeOrder)
    .map((edge) => explicitLine(edge, evidence)));
  return immutable({ lines: [...sourceLines, ...explicitLines] });
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
    const [outgoing, cachedExplorer] = await Promise.all([
      graph.outgoing(center),
      readCachedExplorer(center),
    ]);
    throwIfObsolete(signal, 'Rail view became obsolete');
    const explorer = currentExplorer(center) ?? cachedExplorer;
    const evidence = createEvidenceReader({
      signal,
      currentExplorer: (position) => position === center ? explorer : currentExplorer(position),
      readCachedExplorer: async (position) => position === center ? explorer : readCachedExplorer(position),
      evalProvider,
      mastersProvider: masters,
    });
    return railValue(center, explorer, outgoing, evidence);
  };
}

export const composeNodusRail = createRailSource();
