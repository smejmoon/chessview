import { Chess } from 'chess.js';
import {
  START_FEN,
  canonicalPosition,
  edgeId,
  toPlayableFen,
} from './graph.js';
import { getNode, getOutgoing, putEdges, putNode } from './db.js';

const START = canonicalPosition(START_FEN);

function moveArgs(uci = '') {
  if (uci.length < 4) return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.slice(4) || undefined,
  };
}

function derivedEdge(chess, uci) {
  const args = moveArgs(uci);
  if (!args) return null;
  const source = canonicalPosition(chess.fen());
  let played;
  try {
    played = chess.move(args);
  } catch {
    return null;
  }
  if (!played) return null;
  const target = canonicalPosition(chess.fen());
  const edge = {
    source,
    target,
    uci: `${played.from}${played.to}${played.promotion ?? ''}`,
    san: played.san,
    games: 0,
    share: 0,
    qualifies: false,
    manual: false,
    derived: true,
    updatedAt: Date.now(),
  };
  edge.id = edgeId(edge);
  return edge;
}

export function enumerateMoveOrderTranspositions(
  referencePath,
  targetKey,
  { maxPaths = 128, maxStates = 50_000 } = {},
) {
  if (!referencePath?.length) return { paths: [], states: 0, truncated: false };
  if (referencePath[0]?.source !== START) return { paths: [], states: 0, truncated: false };

  const moves = referencePath.map((edge) => edge.uci);
  if (moves.some((uci) => !moveArgs(uci))) return { paths: [], states: 0, truncated: false };

  const target = canonicalPosition(targetKey);
  const chess = new Chess(START_FEN);
  const paths = [];
  const built = [];
  let states = 0;
  let truncated = false;

  function search(ply, usedMask) {
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
    const tried = new Set();
    for (let index = parity; index < moves.length; index += 2) {
      const bit = 1n << BigInt(index);
      if (usedMask & bit) continue;
      const uci = moves[index];
      if (tried.has(uci)) continue;
      tried.add(uci);

      const edge = derivedEdge(chess, uci);
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

export async function persistTranspositionPaths(paths) {
  const edgesById = new Map();
  for (const path of paths) {
    for (const edge of path) edgesById.set(edge.id, edge);
  }

  const bySource = new Map();
  for (const edge of edgesById.values()) {
    if (!bySource.has(edge.source)) bySource.set(edge.source, []);
    bySource.get(edge.source).push(edge);
  }

  const additions = [];
  for (const [source, edges] of bySource) {
    const existing = new Set((await getOutgoing(source)).map((edge) => edge.id));
    for (const edge of edges) {
      if (!existing.has(edge.id)) additions.push(edge);
    }
  }

  if (!additions.length) return { addedEdges: 0, addedNodes: 0 };
  await putEdges(additions);

  const nodeKeys = new Set();
  for (const edge of additions) {
    nodeKeys.add(edge.source);
    nodeKeys.add(edge.target);
  }

  let addedNodes = 0;
  for (const key of nodeKeys) {
    if (await getNode(key)) continue;
    await putNode({ key, fen: toPlayableFen(key) });
    addedNodes += 1;
  }

  return { addedEdges: additions.length, addedNodes };
}

export async function expandMoveOrderTranspositions(referencePath, targetKey, options) {
  const result = enumerateMoveOrderTranspositions(referencePath, targetKey, options);
  const persisted = await persistTranspositionPaths(result.paths);
  return { ...result, ...persisted };
}
