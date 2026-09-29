import {
  AUTO_SAMPLE_FLOOR,
  EXPLORER_TTL_MS,
  canonicalPosition,
  decorateExplorerMoves,
  resolveMove,
  toPlayableFen,
  totalGames,
} from './graph.js';
import { debugLog } from './debug.js';
import { lichessSession } from './lichess-session.js';
import { lichessGateway } from './lichess-gateway.js';
import { positionGraph } from './position-graph.js';
import { positionRepository } from './position-repository.js';

const ENDPOINT = 'https://explorer.lichess.org/lichess';

function explorerUrl(key) {
  const url = new URL(ENDPOINT);
  url.searchParams.set('variant', 'standard');
  url.searchParams.set('fen', toPlayableFen(key));
  url.searchParams.set('moves', '30');
  url.searchParams.set('topGames', '0');
  url.searchParams.set('recentGames', '0');
  return url;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function reconcileExplorerReading(canonical, explorer) {
  const edges = [];
  const admitUnknown = totalGames(explorer) >= AUTO_SAMPLE_FLOOR;

  for (const move of decorateExplorerMoves(explorer)) {
    try {
      const resolved = resolveMove(canonical, { uci: move.uci });
      const edge = {
        source: canonical,
        target: resolved.target,
        uci: resolved.uci,
        san: resolved.san,
        games: move.games,
        share: move.share,
        manual: false,
        derived: false,
        updatedAt: Date.now(),
      };

      const stored = await positionGraph.updateEdge(edge, { create: admitUnknown });
      if (!stored) continue;
      await positionRepository.merge(resolved.target, { fen: resolved.fen });
      edges.push(stored);
    } catch (error) {
      debugLog('ignored Explorer Reading move', {
        position: canonical,
        uci: move.uci,
        error: error?.message ?? String(error),
      }, 'warn');
    }
  }

  return edges;
}

async function staleExplorerOrThrow(error, canonical, cached) {
  if (error?.name === 'AbortError') throw error;
  if (!cached?.explorer) throw error;
  const edges = await reconcileExplorerReading(canonical, cached.explorer);
  debugLog('Explorer refresh failed; using stale Reading', {
    position: canonical,
    error: error?.message ?? String(error),
    edges: edges.length,
  }, 'warn');
  return cached;
}

export function loadExplorer(key, { force = false, signal } = {}) {
  const canonical = canonicalPosition(key);
  const facet = force ? 'explorer:force' : 'explorer';
  return positionRepository.load(canonical, facet, async ({ signal: requestSignal }) => {
    const cached = await positionRepository.get(canonical);
    const fresh = cached?.explorer && Date.now() - (cached.explorerFetchedAt ?? 0) < EXPLORER_TTL_MS;
    if (!force && fresh) {
      const edges = await reconcileExplorerReading(canonical, cached.explorer);
      debugLog('Explorer Reading cache hit', {
        position: canonical,
        games: cached.games ?? 0,
        edges: edges.length,
      });
      return cached;
    }

    try {
      const token = await lichessSession.requireAccessToken();
      const url = explorerUrl(canonical);
      debugLog('explorer request queued', { position: canonical, url: url.toString(), authenticated: true });

      const response = await lichessGateway.request(url, {
        signal: requestSignal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      debugLog('explorer response', { position: canonical, status: response.status, ok: response.ok });
      if (!response.ok) {
        let body = '';
        try { body = (await response.text()).slice(0, 500); } catch {}
        debugLog('explorer HTTP error', { position: canonical, status: response.status, body }, 'error');
        if (response.status === 401) {
          lichessSession.clearAccessToken();
          throw httpError(401, 'Lichess authorization expired. Reload to sign in again.');
        }
        if (response.status === 429) {
          const retryAfterMs = Math.max(0, lichessGateway.cooldownUntil - Date.now());
          debugLog('explorer cooldown started', { retryAfterMs }, 'warn');
          throw httpError(429, 'Lichess explorer is rate-limited. Requests are paused for one minute.');
        }
        throw httpError(response.status, `Lichess explorer returned ${response.status}`);
      }

      const explorer = await response.json();
      const node = await positionRepository.merge(canonical, {
        fen: cached?.fen ?? toPlayableFen(canonical),
        opening: explorer.opening ?? cached?.opening ?? null,
        explorer,
        explorerFetchedAt: Date.now(),
        games: totalGames(explorer),
      });

      const edges = await reconcileExplorerReading(canonical, explorer);
      debugLog('Explorer Reading stored', { position: canonical, games: node.games, edges: edges.length });
      return node;
    } catch (error) {
      debugLog('explorer refresh failed', { position: canonical, error: error?.message ?? String(error) }, 'error');
      return staleExplorerOrThrow(error, canonical, cached);
    }
  }, { signal });
}
