import type { WorkDemand } from './work-demand.ts';
import {
  GRAPH_EDGE_ADMISSION_SAMPLE_FLOOR,
  SUPPLEMENTARY_EXPLORER_WARM_TIMEOUT_MS,
} from './config.ts';
import { debugLog } from './debug.ts';
import {
  currentExplorerReading,
  loadExplorerReading,
  readCachedExplorerReading,
} from './explorer.ts';
import { isSourceUnavailable } from './source-unavailable.ts';
import {
  canonicalPosition,
  moveGames,
  resolveMove,
  totalGames,
} from './graph.ts';
import { positionGraph } from './position-graph.ts';
import { positionRepository } from './position-repository.ts';
import type { GraphEdge, GraphEdgeInput, PositionGraph } from './position-graph.ts';

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

export type ExplorerLoadOptions = WorkDemand;

export type ExplorerRefinementRunOutcome =
  | Readonly<{ refinement: 'unavailable' }>
  | Readonly<{ refinement: 'satisfied' }>;

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

type CurrentExplorer = (key: string) => ExplorerReading | null;
type ReadCachedExplorer = (key: string) => Promise<ExplorerReading | null>;

type KnowledgeRecord = Readonly<{
  explorerReconciledSignature?: string;
  [field: string]: unknown;
}>;

type KnowledgeRepository = Readonly<{
  get?(position: string): Promise<KnowledgeRecord | null>;
  merge(position: string, fields?: Readonly<Record<string, unknown>>): Promise<unknown>;
}>;

type TimeoutSignalFactory = (ms: number) => AbortSignal;
type DebugLevel = 'info' | 'warn' | 'error';

export type KnowledgeAcquisitionOptions = Readonly<{
  loadExplorer?: LoadExplorer;
  currentExplorer?: CurrentExplorer;
  readCachedExplorer?: ReadCachedExplorer;
  graph?: Pick<PositionGraph, 'outgoing' | 'ensureEdge'>;
  repository?: KnowledgeRepository;
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

function relationshipKey(uci: string, target: string): string {
  return `${uci}\u0000${target}`;
}

function explorerGraphSignature(explorer: ExplorerReading): string {
  return JSON.stringify([
    explorer.white,
    explorer.draws,
    explorer.black,
    explorer.moves.map((move) => [move.uci, move.white, move.draws, move.black]),
  ]);
}

function log(event: string, detail: unknown = null, level: DebugLevel = 'info'): void {
  Reflect.apply(debugLog, undefined, [event, detail, level]);
}

export function createKnowledgeAcquisition({
  loadExplorer = loadExplorerReading as LoadExplorer,
  currentExplorer = currentExplorerReading as CurrentExplorer,
  readCachedExplorer = readCachedExplorerReading as ReadCachedExplorer,
  graph = positionGraph,
  repository = positionRepository,
  warmTimeoutMs = SUPPLEMENTARY_EXPLORER_WARM_TIMEOUT_MS,
  createTimeoutSignal = (ms: number) => AbortSignal.timeout(ms),
}: KnowledgeAcquisitionOptions = {}) {
  const reconciledSignatures = new Map<string, string>();

  async function markExplorerReadingReconciled(
    canonical: string,
    explorer: ExplorerReading,
  ): Promise<void> {
    const signature = explorerGraphSignature(explorer);
    reconciledSignatures.set(canonical, signature);
    try {
      await repository.merge(canonical, { explorerReconciledSignature: signature });
    } catch (error: unknown) {
      log('Explorer reconciliation marker persistence failed', {
        position: canonical,
        error: errorMessage(error),
      }, 'warn');
    }
  }

  async function reconciledExplorerReadingAvailable(key: string): Promise<boolean> {
    const canonical = canonicalPosition(key);
    const explorer = currentExplorer(canonical) ?? await readCachedExplorer(canonical);
    if (!explorer) return false;
    const signature = explorerGraphSignature(explorer);
    if (reconciledSignatures.get(canonical) === signature) return true;
    if (typeof repository.get !== 'function') return false;
    const stored = await repository.get(canonical);
    return stored?.explorerReconciledSignature === signature;
  }

  async function reconcileExplorerReading(
    canonical: string,
    explorer: ExplorerReading,
  ): Promise<GraphEdge[]> {
    const edges: GraphEdge[] = [];
    const admitUnknown = totalGames(explorer) >= GRAPH_EDGE_ADMISSION_SAMPLE_FLOOR;
    const knownByRelationship = new Map(
      (await graph.outgoing(canonical)).map((edge) => [relationshipKey(edge.uci, edge.target), edge]),
    );

    for (const move of explorer.moves) {
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

      const key = relationshipKey(resolved.uci, resolved.target);
      let stored = knownByRelationship.get(key) ?? null;
      if (!stored) {
        if (!admitUnknown) continue;
        const edge: GraphEdgeInput = {
          source: canonical,
          target: resolved.target,
          uci: resolved.uci,
          san: resolved.san,
        };
        stored = await graph.ensureEdge(edge);
        knownByRelationship.set(key, stored);
      }

      await repository.merge(resolved.target, { fen: resolved.fen });
      edges.push(stored);
    }

    await markExplorerReadingReconciled(canonical, explorer);
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

  async function refineExplorerReading(
    key: string,
    options: ExplorerLoadOptions = {},
  ): Promise<ExplorerRefinementRunOutcome> {
    const canonical = canonicalPosition(key);
    let explorer: ExplorerReading | null;
    try {
      explorer = await loadExplorer(canonical, options);
    } catch (error: unknown) {
      if (isSourceUnavailable(error)) return Object.freeze({ refinement: 'unavailable' as const });
      throw error;
    }
    if (!explorer) return Object.freeze({ refinement: 'unavailable' as const });

    const edges = await reconcileExplorerReading(canonical, explorer);
    log('Explorer Reading reconciled', {
      position: canonical,
      games: totalGames(explorer),
      edges: edges.length,
    });
    return Object.freeze({ refinement: 'satisfied' as const });
  }

  async function warmExplorerReading(
    key: string,
    { signal }: Readonly<{ signal?: AbortSignal }> = {},
  ): Promise<ExplorerReading | null> {
    if (signal?.aborted) throw abortError();
    const canonical = canonicalPosition(key);
    const warmSignal = createTimeoutSignal(warmTimeoutMs);
    const explorer = await loadExplorer(canonical, { signal: warmSignal, urgency: 'background' });
    if (!explorer) return null;
    log('Explorer Reading warmed', {
      position: canonical,
      games: totalGames(explorer),
    });
    return explorer;
  }

  return Object.freeze({
    acquireExplorerReading,
    refineExplorerReading,
    reconcileExplorerReading,
    reconcileCachedExplorerReading,
    reconciledExplorerReadingAvailable,
    warmExplorerReading,
  });
}

export async function explorerMoveGames(
  source: string,
  uci: string,
): Promise<number | null> {
  const canonical = canonicalPosition(source);
  const explorer = currentExplorerReading(canonical) ?? await readCachedExplorerReading(canonical);
  if (!explorer) return null;
  const move = explorer.moves.find((candidate) => candidate.uci === uci);
  return move ? moveGames(move) : null;
}

export async function explorerTotalGames(position: string): Promise<number | null> {
  const canonical = canonicalPosition(position);
  const explorer = currentExplorerReading(canonical) ?? await readCachedExplorerReading(canonical);
  return explorer ? totalGames(explorer) : null;
}

export const {
  acquireExplorerReading,
  refineExplorerReading,
  reconcileExplorerReading,
  reconcileCachedExplorerReading,
  reconciledExplorerReadingAvailable,
  warmExplorerReading,
} = createKnowledgeAcquisition();
