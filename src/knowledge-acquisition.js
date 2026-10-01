import {
  AUTO_SAMPLE_FLOOR,
  canonicalPosition,
  decorateExplorerMoves,
  resolveMove,
  totalGames,
} from './graph.js';
import { debugLog } from './debug.js';
import { loadExplorerReading, readCachedExplorerReading } from './explorer.js';
import { positionGraph } from './position-graph.js';
import { positionRepository } from './position-repository.js';

export function createKnowledgeAcquisition({
  loadExplorer = loadExplorerReading,
  readCachedExplorer = readCachedExplorerReading,
  graph = positionGraph,
  repository = positionRepository,
  now = () => Date.now(),
} = {}) {
  async function reconcileExplorerReading(canonical, explorer) {
    const edges = [];
    const admitUnknown = totalGames(explorer) >= AUTO_SAMPLE_FLOOR;

    for (const move of decorateExplorerMoves(explorer)) {
      let resolved;
      try {
        resolved = resolveMove(canonical, { uci: move.uci });
      } catch (error) {
        debugLog('ignored Explorer Reading move', {
          position: canonical,
          uci: move.uci,
          error: error?.message ?? String(error),
        }, 'warn');
        continue;
      }

      const edge = {
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

  async function reconcileCachedExplorerReading(key) {
    const canonical = canonicalPosition(key);
    const explorer = await readCachedExplorer(canonical);
    if (!explorer) return null;
    const edges = await reconcileExplorerReading(canonical, explorer);
    debugLog('cached Explorer Reading reconciled', {
      position: canonical,
      games: totalGames(explorer),
      edges: edges.length,
    });
    return explorer;
  }

  async function acquireExplorerReading(key, options = {}) {
    const canonical = canonicalPosition(key);
    const explorer = await loadExplorer(canonical, options);
    if (!explorer) return null;
    const edges = await reconcileExplorerReading(canonical, explorer);
    debugLog('Explorer Reading reconciled', {
      position: canonical,
      games: totalGames(explorer),
      edges: edges.length,
    });
    return explorer;
  }

  async function warmExplorerReading(key, { signal } = {}) {
    const canonical = canonicalPosition(key);
    const explorer = await loadExplorer(canonical, { signal, priority: 'background' });
    if (!explorer) return null;
    debugLog('Explorer Reading warmed', {
      position: canonical,
      games: totalGames(explorer),
    });
    return explorer;
  }

  return Object.freeze({ acquireExplorerReading, reconcileCachedExplorerReading, warmExplorerReading });
}

export const {
  acquireExplorerReading,
  reconcileCachedExplorerReading,
  warmExplorerReading,
} = createKnowledgeAcquisition();
