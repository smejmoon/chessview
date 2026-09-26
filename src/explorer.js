import { Chess } from 'chess.js';
import {
  AUTO_SAMPLE_FLOOR,
  EXPLORER_TTL_MS,
  canonicalPosition,
  decorateExplorerMoves,
  edgeId,
  moveToChild,
  stableEdgeOrder,
  toPlayableFen,
  totalGames,
} from './graph.js';
import {
  addLineCandidates,
  createLineFrontier,
  hasLineCandidates,
  takeLineCandidate,
} from './line-frontier.js';
import { getNode, getOutgoing, putManualEdge, putNode, replaceExplorerEdges } from './db.js';
import { debugLog } from './debug.js';
import { clearLichessAccessToken, requireLichessAccessToken } from './auth.js';
import { lichessGateway } from './lichess-gateway.js';

const ENDPOINT = 'https://explorer.lichess.org/lichess';
const inFlight = new Map();

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

async function reconcileExplorerSnapshot(canonical, explorer) {
  const edges = [];
  for (const move of decorateExplorerMoves(explorer)) {
    try {
      const child = moveToChild(canonical, { uci: move.uci });
      const edge = {
        id: '',
        source: canonical,
        target: child.key,
        uci: child.uci,
        san: move.san || child.san,
        games: move.games,
        share: move.share,
        qualifies: move.qualifies,
        manual: false,
        updatedAt: Date.now(),
      };
      edge.id = edgeId(edge);
      edges.push(edge);
      const previousChild = await getNode(child.key);
      await putNode({
        ...(previousChild ?? {}),
        key: child.key,
        fen: child.fen,
      });
    } catch (error) {
      debugLog('ignored explorer move', { position: canonical, uci: move.uci, error: error?.message ?? String(error) }, 'warn');
    }
  }

  await replaceExplorerEdges(canonical, edges);
  return edges;
}

export async function loadExplorer(key, { force = false, signal } = {}) {
  const canonical = canonicalPosition(key);
  const cached = await getNode(canonical);
  const fresh = cached?.explorer && Date.now() - (cached.explorerFetchedAt ?? 0) < EXPLORER_TTL_MS;
  if (!force && fresh) {
    const edges = await reconcileExplorerSnapshot(canonical, cached.explorer);
    debugLog('explorer cache hit', {
      position: canonical,
      games: cached.games ?? 0,
      edges: edges.length,
      qualifying: edges.filter((edge) => edge.qualifies).length,
    });
    return cached;
  }
  if (inFlight.has(canonical)) {
    debugLog('explorer request joined', { position: canonical });
    return inFlight.get(canonical);
  }

  const promise = (async () => {
    const token = await requireLichessAccessToken();
    const url = explorerUrl(canonical);
    debugLog('explorer request queued', { position: canonical, url: url.toString(), authenticated: true });

    let response;
    try {
      response = await lichessGateway.request(url, {
        signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      debugLog('explorer network error', { position: canonical, url: url.toString(), error: error?.message ?? String(error) }, 'error');
      throw error;
    }

    debugLog('explorer response', { position: canonical, status: response.status, ok: response.ok });
    if (!response.ok) {
      let body = '';
      try { body = (await response.text()).slice(0, 500); } catch {}
      debugLog('explorer HTTP error', { position: canonical, status: response.status, body }, 'error');
      if (response.status === 401) {
        clearLichessAccessToken();
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
    const node = {
      ...(cached ?? {}),
      key: canonical,
      fen: toPlayableFen(canonical),
      opening: explorer.opening ?? cached?.opening ?? null,
      explorer,
      explorerFetchedAt: Date.now(),
      games: totalGames(explorer),
    };

    await putNode(node);
    const edges = await reconcileExplorerSnapshot(canonical, explorer);
    debugLog('explorer stored', { position: canonical, games: node.games, edges: edges.length, qualifying: edges.filter((edge) => edge.qualifies).length });
    return node;
  })().finally(() => inFlight.delete(canonical));

  inFlight.set(canonical, promise);
  return promise;
}

export async function ensureManualEdge(sourceKey, from, to, promotion = 'q') {
  const chess = new Chess(toPlayableFen(sourceKey));
  let played;
  debugLog('manual move attempt', { source: canonicalPosition(sourceKey), from, to, promotion, turn: chess.turn() });
  try {
    played = chess.move({ from, to, promotion });
  } catch (error) {
    debugLog('manual move rejected', { source: canonicalPosition(sourceKey), from, to, error: error?.message ?? String(error) }, 'warn');
    return null;
  }
  if (!played) {
    debugLog('manual move rejected', { source: canonicalPosition(sourceKey), from, to }, 'warn');
    return null;
  }

  const target = canonicalPosition(chess.fen());
  const edge = {
    source: canonicalPosition(sourceKey),
    target,
    uci: `${played.from}${played.to}${played.promotion ?? ''}`,
    san: played.san,
    games: 0,
    share: 0,
    qualifies: false,
    manual: true,
    updatedAt: Date.now(),
  };
  edge.id = edgeId(edge);
  const storedEdge = await putManualEdge(edge);
  const existing = await getNode(target);
  await putNode({ ...(existing ?? {}), key: target, fen: chess.fen() });
  debugLog('manual move stored', { san: played.san, uci: edge.uci, source: edge.source, target });
  return { edge: storedEdge, target };
}

export async function discoverForViewport(centerKey, budget, onProgress, { signal } = {}) {
  const center = canonicalPosition(centerKey);
  debugLog('discovery start', { center, budget });
  if (signal?.aborted) return null;

  const centerNode = await loadExplorer(center, { signal });
  if (signal?.aborted) return centerNode;
  onProgress?.();

  const roots = (await getOutgoing(center))
    .filter((edge) => edge.qualifies)
    .sort(stableEdgeOrder);

  const frontiers = roots.map((edge) => createLineFrontier(
    edge.uci,
    { key: edge.target, depth: 1, breadth: 0 },
    edge.share ?? 0,
  ));
  const seen = new Set([center]);
  let inspected = 0;
  const requestBudget = Math.max(3, Math.min(14, budget));

  while (hasLineCandidates(frontiers) && inspected < requestBudget && !signal?.aborted) {
    let progressed = false;
    for (const frontier of frontiers) {
      if (inspected >= requestBudget || signal?.aborted) break;
      const item = takeLineCandidate(frontier, (candidate) => !seen.has(candidate.key));
      if (!item) continue;
      seen.add(item.key);
      progressed = true;

      const known = await getNode(item.key);
      if ((known?.games ?? Infinity) < AUTO_SAMPLE_FLOOR && known?.explorer) continue;
      try {
        const node = await loadExplorer(item.key, { signal });
        if (signal?.aborted) break;
        inspected += 1;
        onProgress?.();
        if ((node.games ?? 0) < AUTO_SAMPLE_FLOOR) continue;
        const next = (await getOutgoing(item.key))
          .filter((edge) => edge.qualifies)
          .sort(stableEdgeOrder)
          .map((edge, index) => ({
            key: edge.target,
            depth: item.depth + 1,
            breadth: item.breadth + index,
          }));
        addLineCandidates(frontier, next);
      } catch (error) {
        if (signal?.aborted) break;
        if (error?.status === 429) {
          debugLog('discovery paused by rate limit', { position: item.key, branch: frontier.branch, depth: item.depth }, 'warn');
          return centerNode;
        }
        debugLog('branch discovery failed', { position: item.key, branch: frontier.branch, depth: item.depth, error: error?.message ?? String(error) }, 'warn');
      }
    }
    if (!progressed) break;
  }

  debugLog(signal?.aborted ? 'discovery cancelled' : 'discovery complete', { center, inspected, roots: roots.length });
  return centerNode;
}
