import { canonicalPosition, resolveMove } from './graph.js';
import { debugLog } from './debug.js';
import { positionGraph } from './position-graph.ts';
import { positionRepository } from './position-repository.js';
import type { GraphEdge } from './position-graph.ts';

export type Promotion = 'q' | 'r' | 'b' | 'n';

export interface Move {
  from: string;
  to: string;
  promotion?: Promotion;
}

export interface MoveCandidate {
  from?: string;
  to?: string;
  promotion?: string;
}

export interface MaterializeMoveInput {
  source: string;
  move: MoveCandidate;
}

export type MaterializedEdge = GraphEdge;

export interface MaterializeMoveResult {
  edge: MaterializedEdge;
  target: string;
}

type ResolvedMove = {
  target: string;
  uci: string;
  san: string;
};

type DebugLevel = 'info' | 'warn' | 'error';

function log(event: string, detail: unknown = null, level: DebugLevel = 'info'): void {
  Reflect.apply(debugLog, undefined, [event, detail, level]);
}

export async function materializeMove(input: MaterializeMoveInput): Promise<MaterializeMoveResult | null> {
  const source = input?.source;
  const move = input?.move;
  const canonicalSource = canonicalPosition(source);
  const { from, to, promotion } = move ?? {};
  let resolved: ResolvedMove;

  log('move materialization attempt', {
    source: canonicalSource,
    from,
    to,
    promotion,
  });

  try {
    resolved = resolveMove(canonicalSource, { from, to, promotion }) as ResolvedMove;
  } catch (error: unknown) {
    log('move materialization rejected', {
      source: canonicalSource,
      from,
      to,
      error: error instanceof Error ? error.message : String(error),
    }, 'warn');
    return null;
  }

  const edge = {
    source: canonicalSource,
    target: resolved.target,
    uci: resolved.uci,
    san: resolved.san,
    games: 0,
    share: 0,
    qualifies: false,
    updatedAt: Date.now(),
  };

  await positionRepository.ensure(resolved.target);
  const stored = await positionGraph.ensureEdge(edge, { manual: true });
  log('move materialization stored', {
    san: resolved.san,
    uci: stored.uci,
    source: stored.source,
    target: resolved.target,
  });
  return { edge: stored, target: resolved.target };
}
