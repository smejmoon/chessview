import {
  AUTO_SAMPLE_FLOOR,
  canonicalPosition,
  decorateExplorerMoves,
  resolveMove,
  totalGames,
} from './graph.js';
import { debugLog } from './debug.js';
import { loadExplorerReading, readCachedExplorerReading } from './explorer.js';
import { positionGraph } from './position-graph.ts';
import { positionRepository } from './position-repository.js';
import type { GraphEdge, GraphEdgeInput, PositionGraph } from './position-graph.ts';

const SUPPLEMENTARY_WARM_TIMEOUT_MS = 30_000;

export type AcquisitionPriority = 'foreground' | 'background';
export type AcquisitionPriorityInput = AcquisitionPriority | (() => AcquisitionPriority);

export type ExplorerMove = Readonly<{
  uci: string;
  white: number;
  draws: number;
  black: number;
}>;

export type ExplorerReading = Readonly<{
  white: number;
  draws: number;
  black: number;
  moves: readonly ExplorerMove[];
  opening?: unknown;
  [key: string]: unknown;
}>;

export type ExplorerLoadOptions = Readonly<{
  force?: boolean;
  signal?: AbortSignal;
  priority?: AcquisitionPriorityInput;
}>;

type DecoratedExplorerMove = Readonly<{
  uci: string;
  games: number;
  share: number;
}>;

type ResolvedMove = Readonly<{
  target: string;
  uci: string;
  san: string;
  fen: string;
}>;

type LoadExplorer = (
  key: string,
  options?: ExplorerLoadOptions,
) => Promise<ExplorerReading | null>;

type ReadCachedExplorer = (key: string) => Promise<ExplorerReading | null>;

type KnowledgeRepository = Readonly<{
  merge(position: string, fields?: Readonly<Record<string, unknown>>): Promise<unknown>;
}>;

type TimeoutSignalFactory = (ms: number) => AbortSignal;
type Clock = () => number;
type DebugLevel = 'info' | 'warn' | 'error';

export type KnowledgeAcquisitionOptions = Readonly<{
  loadExplorer?: LoadExplorer;
  readCachedExplorer?: ReadCachedExplorer;
  graph?: Pick<PositionGraph, 'updateEdge'>;
  repository?: KnowledgeRepository;
  now?: Clock;
  warmTimeoutMs?: number;
  createTimeoutSignal?: TimeoutSignalFactory;
}>;

function abortError(): Error {
  const error = new Error('Supplementary lookahead became obsolete before warming started');
  error.name = 'AbortError';
  return error;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(error);
}

function log(event: string, detail: unknown = null, level: DebugLevel = 'info'): void {
  Reflect.apply(debugLog, undefined, [event, detail, level]);
}

export function createKnowledgeAcquisition({
  loadExplorer = loadExplorerReading as LoadExplorer,
  readCachedExplorer = readCachedExplorerReading as ReadCachedExplorer,
  graph = positionGraph,
  repository = positionRepository,
  now = () => Date.now(),
  warmTimeoutMs = SUPPLEMENTARY_WARM_TIMEOUT_MS,
  createTimeoutSignal = (ms: number) => AbortSignal.timeout(ms),
}: KnowledgeAcquisitionOptions = {}) {
  async function reconcileExplorerReading(
    canonical: string,
    explorer: ExplorerReading,
  ): Promise<GraphEdge[]> {
    const edges: GraphEdge[] = [];
    const admitUnknown = totalGames(explorer) >= AUTO_SAMPLE_FLOOR;
    const moves = decorateExplorerMoves(explorer) as readonly DecoratedExplorerMove[];

    for (const move of moves) {
      let resolved: ResolvedMove;
      try {
        resolved = resolveMove(canonical, { uci: move.uci }) as ResolvedMove;
      } catch (error: unknown) {
        log('ignored Explorer Reading move', {
          position: canonical,
          uci: move.uci,
          error: errorMessage(error),
        }, 'warn');
        continue;
      }

      const edge: GraphEdgeInput = {
        source: canonical,
        target: resolved.target,
        uci: resolved.uci,
        san: resolved.san,
        games: move.games,
        share: move.share,
        manual: false,
        derived: false,
        updatedAt: now(),
      };

      const stored = await graph.updateEdge(edge, { create: admitUnknown });
      if (!stored) continue;
      await repository.merge(resolved.target, { fen: resolved.fen });
      edges.push(stored);
    }

    return edges;
  }

  async function reconcileCachedExplorerReading(key: string): Promise<ExplorerReading | null> {
    const canonical = canonicalPosition(key);
    const explorer = await readCachedExplorer(canonical);
    if (!explorer) return null;
    const edges = await reconcileExplorerReading(canonical, explorer);
    log('cached Explorer Reading reconciled', {
      position: canonical,
      games: totalGames(explorer),
      edges: edges.length,
    });
    return explorer;
  }

  async function acquireExplorerReading(
    key: string,
    options: ExplorerLoadOptions = {},
  ): Promise<ExplorerReading | null> {
    const canonical = canonicalPosition(key);
    const explorer = await loadExplorer(canonical, options);
    if (!explorer) return null;
    const edges = await reconcileExplorerReading(canonical, explorer);
    log('Explorer Reading reconciled', {
      position: canonical,
      games: totalGames(explorer),
      edges: edges.length,
    });
    return explorer;
  }

  async function warmExplorerReading(
    key: string,
    { signal }: Readonly<{ signal?: AbortSignal }> = {},
  ): Promise<ExplorerReading | null> {
    if (signal?.aborted) throw abortError();
    const canonical = canonicalPosition(key);
    const warmSignal = createTimeoutSignal(warmTimeoutMs);
    const explorer = await loadExplorer(canonical, { signal: warmSignal, priority: 'background' });
    if (!explorer) return null;
    log('Explorer Reading warmed', {
      position: canonical,
      games: totalGames(explorer),
    });
    return explorer;
  }

  return Object.freeze({
    acquireExplorerReading,
    reconcileCachedExplorerReading,
    warmExplorerReading,
  });
}

export const {
  acquireExplorerReading,
  reconcileCachedExplorerReading,
  warmExplorerReading,
} = createKnowledgeAcquisition();
