import { Chess } from 'chess.js';
import {
  START_FEN,
  canonicalPosition,
  edgeId,
} from './graph.js';
import { positionGraph } from './position-graph.ts';
import { positionRepository } from './position-repository.js';

const START = canonicalPosition(START_FEN);
const DEFAULT_TRANSPOSITION_MAX_PATHS = 128;
const DEFAULT_TRANSPOSITION_MAX_STATES = 50_000;

type MoveArgs = Readonly<{
  from: string;
  to: string;
  promotion?: string;
}>;

export type TranspositionEdge = Readonly<{
  id: string;
  source: string;
  target: string;
  uci: string;
  san: string;
}>;

export type TranspositionPath = readonly TranspositionEdge[];

export type TranspositionSearchOptions = Readonly<{
  maxPaths?: number;
  maxStates?: number;
}>;

export type TranspositionSearchResult = Readonly<{
  paths: TranspositionEdge[][];
  states: number;
  truncated: boolean;
}>;

export type PersistTranspositionsResult = Readonly<{
  addedEdges: number;
  addedNodes: number;
}>;

function moveArgs(uci = ''): MoveArgs | null {
  if (uci.length < 4) return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.slice(4) || undefined,
  };
}

function transpositionEdge(chess: Chess, uci: string): TranspositionEdge | null {
  const args = moveArgs(uci);
  if (!args) return null;
  const source = canonicalPosition(chess.fen());
  let played;
  try {
    played = chess.move(args as Parameters<Chess['move']>[0]);
  } catch {
    return null;
  }
  if (!played) return null;
  const target = canonicalPosition(chess.fen());
  const edge = {
    id: '',
    source,
    target,
    uci: `${played.from}${played.to}${played.promotion ?? ''}`,
    san: played.san,
  };
  edge.id = edgeId(edge);
  return edge;
}

export function enumerateMoveOrderTranspositions(
  referencePath: readonly Readonly<{ source: string; uci: string }>[],
  targetKey: string,
  {
    maxPaths = DEFAULT_TRANSPOSITION_MAX_PATHS,
    maxStates = DEFAULT_TRANSPOSITION_MAX_STATES,
  }: TranspositionSearchOptions = {},
): TranspositionSearchResult {
  if (!referencePath.length) return { paths: [], states: 0, truncated: false };
  if (referencePath[0]?.source !== START) return { paths: [], states: 0, truncated: false };

  const moves = referencePath.map((edge) => edge.uci);
  if (moves.some((uci) => !moveArgs(uci))) return { paths: [], states: 0, truncated: false };

  const target = canonicalPosition(targetKey);
  const chess = new Chess(START_FEN);
  const paths: TranspositionEdge[][] = [];
  const built: TranspositionEdge[] = [];
  let states = 0;
  let truncated = false;

  function search(ply: number, usedMask: bigint): void {
    if (paths.length >= maxPaths || states >= maxStates) {
      truncated = true;
      return;
    }
    states += 1;

    if (ply === moves.length) {
      if (canonicalPosition(chess.fen()) === target) paths.push(built.map((edge) => ({ ...edge })));
      return;
    }

    const parity = ply % 2;
    const tried = new Set<string>();
    for (let index = parity; index < moves.length; index += 2) {
      const bit = 1n << BigInt(index);
      if (usedMask & bit) continue;
      const uci = moves[index];
      if (tried.has(uci)) continue;
      tried.add(uci);

      const edge = transpositionEdge(chess, uci);
      if (!edge) continue;
      built.push(edge);
      search(ply + 1, usedMask | bit);
      built.pop();
      chess.undo();

      if (paths.length >= maxPaths || states >= maxStates) {
        truncated = true;
        break;
      }
    }
  }

  search(0, 0n);
  return { paths, states, truncated };
}

export async function persistTranspositionPaths(
  paths: readonly TranspositionPath[],
): Promise<PersistTranspositionsResult> {
  const edgesById = new Map<string, TranspositionEdge>();
  for (const path of paths) {
    for (const edge of path) edgesById.set(edge.id, edge);
  }

  const bySource = new Map<string, TranspositionEdge[]>();
  for (const edge of edgesById.values()) {
    if (!bySource.has(edge.source)) bySource.set(edge.source, []);
    bySource.get(edge.source)?.push(edge);
  }

  const additions: TranspositionEdge[] = [];
  for (const [source, edges] of bySource) {
    const existing = new Set((await positionGraph.outgoing(source)).map((edge) => edge.id));
    for (const edge of edges) {
      if (!existing.has(edge.id)) additions.push(edge);
    }
  }

  for (const edge of edgesById.values()) {
    await positionGraph.ensureEdge(edge);
  }

  if (!additions.length) return { addedEdges: 0, addedNodes: 0 };

  const nodeKeys = new Set<string>();
  for (const edge of additions) {
    nodeKeys.add(edge.source);
    nodeKeys.add(edge.target);
  }

  let addedNodes = 0;
  for (const key of nodeKeys) {
    if (await positionRepository.get(key)) continue;
    await positionRepository.ensure(key);
    addedNodes += 1;
  }

  return { addedEdges: additions.length, addedNodes };
}

export async function expandMoveOrderTranspositions(
  referencePath: readonly Readonly<{ source: string; uci: string }>[],
  targetKey: string,
  options?: TranspositionSearchOptions,
): Promise<TranspositionSearchResult & PersistTranspositionsResult> {
  const result = enumerateMoveOrderTranspositions(referencePath, targetKey, options);
  const persisted = await persistTranspositionPaths(result.paths);
  return { ...result, ...persisted };
}
