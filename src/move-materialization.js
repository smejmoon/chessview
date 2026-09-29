import { canonicalPosition, resolveMove } from './graph.js';
import { debugLog } from './debug.js';
import { positionGraph } from './position-graph.js';
import { positionRepository } from './position-repository.js';

export async function materializeMove({ source, move } = {}) {
  const canonicalSource = canonicalPosition(source);
  const { from, to, promotion } = move ?? {};
  let resolved;

  debugLog('move materialization attempt', {
    source: canonicalSource,
    from,
    to,
    promotion,
  });

  try {
    resolved = resolveMove(canonicalSource, { from, to, promotion });
  } catch (error) {
    debugLog('move materialization rejected', {
      source: canonicalSource,
      from,
      to,
      error: error?.message ?? String(error),
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
  const storedEdge = await positionGraph.ensureEdge(edge, { manual: true });
  debugLog('move materialization stored', {
    san: resolved.san,
    uci: storedEdge.uci,
    source: storedEdge.source,
    target: resolved.target,
  });
  return { edge: storedEdge, target: resolved.target };
}
