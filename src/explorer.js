import { EXPLORER_TTL_MS } from './config.ts';
import {
  canonicalPosition,
  toPlayableFen,
  totalGames,
} from './graph.js';
import { debugLog } from './debug.js';
import { lichessSession } from './lichess-session.js';
import { lichessGateway } from './lichess-gateway.js';
import { positionRepository } from './position-repository.js';

const ENDPOINT = 'https://explorer.lichess.org/lichess';
const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

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

function invalidDataError() {
  const error = new Error('Lichess explorer returned invalid data');
  error.kind = 'invalid-data';
  return error;
}

function validCount(value) {
  return Number.isInteger(value) && value >= 0;
}

function validExplorerMove(move, sourceGames) {
  if (!move || typeof move !== 'object' || Array.isArray(move)) return false;
  if (typeof move.uci !== 'string' || !UCI_MOVE.test(move.uci)) return false;
  if (![move.white, move.draws, move.black].every(validCount)) return false;
  return (move.white + move.draws + move.black) <= sourceGames;
}

function parseExplorerReading(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidDataError();
  if (![value.white, value.draws, value.black].every(validCount)) throw invalidDataError();
  if (!Array.isArray(value.moves)) throw invalidDataError();

  const sourceGames = totalGames(value);
  if (!value.moves.every((move) => validExplorerMove(move, sourceGames))) throw invalidDataError();
  return value;
}

function cachedExplorerReading(record) {
  if (!record?.explorer) return null;
  try {
    return parseExplorerReading(record.explorer);
  } catch {
    return null;
  }
}

export async function readCachedExplorerReading(key) {
  const cached = await positionRepository.get(canonicalPosition(key));
  return cachedExplorerReading(cached);
}

function recoverExplorerRefresh(error, canonical, cachedExplorer) {
  if (error?.name === 'AbortError') throw error;
  if (cachedExplorer) {
    debugLog('Explorer refresh failed; using stale Reading', {
      position: canonical,
      error: error?.message ?? String(error),
      games: totalGames(cachedExplorer),
    }, 'warn');
    return cachedExplorer;
  }
  debugLog('explorer refresh failed', {
    position: canonical,
    error: error?.message ?? String(error),
  }, 'error');
  throw error;
}

export function loadExplorerReading(key, { force = false, signal, priority = 'foreground' } = {}) {
  const canonical = canonicalPosition(key);
  const facet = force ? 'explorer:force' : 'explorer';
  return positionRepository.load(canonical, facet, async ({ signal: requestSignal, priority: requestPriority }) => {
    const cached = await positionRepository.get(canonical);
    const cachedExplorer = cachedExplorerReading(cached);
    const fresh = cachedExplorer && Date.now() - (cached.explorerFetchedAt ?? 0) < EXPLORER_TTL_MS;
    if (!force && fresh) {
      debugLog('Explorer Reading cache hit', {
        position: canonical,
        games: totalGames(cachedExplorer),
      });
      return cachedExplorer;
    }

    try {
      const token = await lichessSession.requireAccessToken();
      const url = explorerUrl(canonical);
      debugLog('explorer request queued', { position: canonical, url: url.toString(), authenticated: true });

      const response = await lichessGateway.request(url, {
        signal: requestSignal,
        priority: requestPriority,
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

      const explorer = parseExplorerReading(await response.json());
      await positionRepository.merge(canonical, {
        fen: cached?.fen ?? toPlayableFen(canonical),
        opening: explorer.opening ?? cached?.opening ?? null,
        explorer,
        explorerFetchedAt: Date.now(),
        games: totalGames(explorer),
      });

      debugLog('Explorer Reading stored', { position: canonical, games: totalGames(explorer) });
      return explorer;
    } catch (error) {
      return recoverExplorerRefresh(error, canonical, cachedExplorer);
    }
  }, { signal, priority });
}
