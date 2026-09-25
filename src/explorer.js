import { Chess } from 'chess.js';
import {
  AUTO_SAMPLE_FLOOR,
  EXPLORER_TTL_MS,
  canonicalPosition,
  decorateExplorerMoves,
  edgeId,
  moveToChild,
  toPlayableFen,
  totalGames,
} from './graph.js';
import { getNode, getOutgoing, putEdges, putNode } from './db.js';

const ENDPOINT = 'https://explorer.lichess.ovh/lichess';
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

export async function loadExplorer(key, { force = false } = {}) {
  const canonical = canonicalPosition(key);
  const cached = await getNode(canonical);
  const fresh = cached?.explorer && Date.now() - (cached.explorerFetchedAt ?? 0) < EXPLORER_TTL_MS;
  if (!force && fresh) return cached;
  if (inFlight.has(canonical)) return inFlight.get(canonical);

  const promise = (async () => {
    const response = await fetch(explorerUrl(canonical), { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Lichess explorer returned ${response.status}`);
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
      } catch {
        // Explorer should only return legal moves. Ignore malformed/stale entries defensively.
      }
    }

    await putNode(node);
    await putEdges(edges);
    return node;
  })().finally(() => inFlight.delete(canonical));

  inFlight.set(canonical, promise);
  return promise;
}

export async function ensureManualEdge(sourceKey, from, to, promotion = 'q') {
  const chess = new Chess(toPlayableFen(sourceKey));
  let played;
  try {
    played = chess.move({ from, to, promotion });
  } catch {
    return null;
  }
  if (!played) return null;

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
  await putEdges([edge]);
  const existing = await getNode(target);
  await putNode({ ...(existing ?? {}), key: target, fen: chess.fen() });
  return { edge, target };
}

export async function discoverForViewport(centerKey, budget, onProgress) {
  const center = canonicalPosition(centerKey);
  const centerNode = await loadExplorer(center);
  onProgress?.();

  const roots = (await getOutgoing(center))
    .filter((edge) => edge.qualifies)
    .sort((a, b) => (b.share ?? 0) - (a.share ?? 0) || a.uci.localeCompare(b.uci));

  // Frontier is branch-balanced: one candidate per root branch at a time.
  const frontier = roots.map((edge) => ({ key: edge.target, branch: edge.uci, depth: 1 }));
  let inspected = 0;
  const requestBudget = Math.max(3, Math.min(14, budget));

  while (frontier.length && inspected < requestBudget) {
    const item = frontier.shift();
    const known = await getNode(item.key);
    if ((known?.games ?? Infinity) < AUTO_SAMPLE_FLOOR && known?.explorer) continue;
    try {
      const node = await loadExplorer(item.key);
      inspected += 1;
      onProgress?.();
      if ((node.games ?? 0) < AUTO_SAMPLE_FLOOR) continue;
      const next = (await getOutgoing(item.key))
        .filter((edge) => edge.qualifies)
        .sort((a, b) => (b.share ?? 0) - (a.share ?? 0) || a.uci.localeCompare(b.uci));
      // Favor narrow branches: enqueue only the strongest continuation initially.
      // Other breadth remains persisted and can appear naturally after recentering.
      if (next[0]) frontier.push({ key: next[0].target, branch: item.branch, depth: item.depth + 1 });
    } catch {
      // Keep the already discovered map usable when the network or explorer is unavailable.
    }
  }

  return centerNode;
}
