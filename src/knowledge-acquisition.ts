import {
  AUTO_SAMPLE_FLOOR,
  canonicalPosition,
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
type DebugLevel = 'info' | 'warn' | 'error';

export type KnowledgeAcquisitionOptions = Readonly<{
  loadExplorer?: LoadExplorer;
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

function log(event: string, detail: unknown = null, level: DebugLevel = 'info'): void {
  Reflect.apply(debugLog, undefined, [event, detail, level]);
}

export function createKnowledgeAcquisition({
  loadExplorer = loadExplorerReading as LoadExplorer,
  readCachedExplorer = readCachedExplorerReading as ReadCachedExplorer,
  graph = positionGraph,
  repository = positionRepository,
  warmTimeoutMs = SUPPLEMENTARY_WARM_TIMEOUT_MS,
  createTimeoutSignal = (ms: number) => AbortSignal.timeout(ms),
}: KnowledgeAcquisitionOptions = {}) {
  async function reconcileExplorerReading(
    canonical: string,
    explorer: ExplorerReading,
  ): Promise<GraphEdge[]> {
    const edges: GraphEdge[] = [];
    const admitUnknown = totalGames(explorer) >= AUTO_SAMPLE_FLOOR;
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
