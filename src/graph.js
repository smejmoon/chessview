import { Chess } from 'chess.js';

export const AUTO_THRESHOLD = 0.05;
export const AUTO_SAMPLE_FLOOR = 80;
export const EXPLORER_TTL_MS = 24 * 60 * 60 * 1000;

export const START_FEN = new Chess().fen();

export function toPlayableFen(positionKey) {
  const parts = positionKey.trim().split(/\s+/);
  if (parts.length >= 6) return parts.slice(0, 6).join(' ');
  if (parts.length === 4) return `${parts.join(' ')} 0 1`;
  throw new Error('Invalid chess position');
}

export function canonicalPosition(fen) {
  const chess = new Chess(toPlayableFen(fen));
  const [placement, turn, castling, ep] = chess.fen().split(' ');
  let relevantEp = '-';
  if (ep !== '-') {
    const canCaptureEp = chess.moves({ verbose: true }).some((move) => move.flags.includes('e'));
    if (canCaptureEp) relevantEp = ep;
  }
  return `${placement} ${turn} ${castling || '-'} ${relevantEp}`;
}

export function moveToChild(sourceKey, move) {
  const chess = new Chess(toPlayableFen(sourceKey));
  const uciPromotion = move.uci?.slice(4) || undefined;
  const played = chess.move({
    from: move.from ?? move.uci?.slice(0, 2),
    to: move.to ?? move.uci?.slice(2, 4),
    promotion: move.promotion ?? uciPromotion,
  });
  if (!played) throw new Error(`Illegal move from graph source: ${move.uci ?? ''}`);
  return {
    key: canonicalPosition(chess.fen()),
    fen: chess.fen(),
    san: played.san,
    uci: `${played.from}${played.to}${played.promotion ?? ''}`,
  };
}

export function totalGames(explorer) {
  return (explorer?.white ?? 0) + (explorer?.draws ?? 0) + (explorer?.black ?? 0);
}

export function moveGames(move) {
  return (move?.white ?? 0) + (move?.draws ?? 0) + (move?.black ?? 0);
}

export function decorateExplorerMoves(explorer) {
  const total = totalGames(explorer);
  return (explorer?.moves ?? []).map((move) => ({
    ...move,
    games: moveGames(move),
    share: total ? moveGames(move) / total : 0,
    qualifies: total >= AUTO_SAMPLE_FLOOR && moveGames(move) / Math.max(1, total) >= AUTO_THRESHOLD,
  }));
}

export function omittedShare(explorer) {
  return decorateExplorerMoves(explorer)
    .filter((move) => !move.qualifies)
    .reduce((sum, move) => sum + move.share, 0);
}

export function edgeId(edge) {
  return `${edge.source}|${edge.uci}|${edge.target}`;
}

export function positionFromUrl(search = window.location.search) {
  const params = new URLSearchParams(search);
  const raw = params.get('fen');
  if (!raw) return canonicalPosition(START_FEN);
  try {
    return canonicalPosition(raw);
  } catch {
    return canonicalPosition(START_FEN);
  }
}

export function positionUrl(key) {
  const url = new URL(window.location.href);
  url.searchParams.set('fen', canonicalPosition(key));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function legalDestinations(positionKey) {
  const chess = new Chess(toPlayableFen(positionKey));
  const destinations = new Map();
  for (const move of chess.moves({ verbose: true })) {
    if (!destinations.has(move.from)) destinations.set(move.from, []);
    if (!destinations.get(move.from).includes(move.to)) destinations.get(move.from).push(move.to);
  }
  return destinations;
}

export function stableEdgeOrder(a, b) {
  return (b.share ?? 0) - (a.share ?? 0) || a.uci.localeCompare(b.uci) || a.target.localeCompare(b.target);
}

export function chooseNeighborhood({ center, incoming = [], outgoingBySource = new Map(), max = 19 }) {
  const selected = [];
  const seen = new Set([center]);
  const push = (entry) => {
    if (!entry || seen.has(entry.key) || selected.length >= max) return false;
    seen.add(entry.key);
    selected.push(entry);
    return true;
  };

  incoming
    .slice()
    .sort((a, b) => (b.games ?? 0) - (a.games ?? 0) || a.key.localeCompare(b.key))
    .slice(0, Math.min(4, Math.max(1, Math.floor(max / 4))))
    .forEach((item) => push({ ...item, relation: 'incoming', distance: 1 }));

  const roots = (outgoingBySource.get(center) ?? [])
    .filter((edge) => edge.qualifies || edge.manual)
    .slice()
    .sort(stableEdgeOrder);

  const branchQueues = [];
  for (const root of roots) {
    if (selected.length >= max) break;
    push({ key: root.target, edge: root, relation: 'outgoing', distance: 1, branch: root.uci });
    branchQueues.push({ branch: root.uci, current: root.target, distance: 1 });
  }

  let progressed = true;
  while (selected.length < max && progressed) {
    progressed = false;
    for (const queue of branchQueues) {
      if (selected.length >= max) break;
      const options = (outgoingBySource.get(queue.current) ?? [])
        .filter((edge) => edge.qualifies)
        .slice()
        .sort(stableEdgeOrder);
      const next = options.find((edge) => !seen.has(edge.target));
      if (!next) continue;
      queue.current = next.target;
      queue.distance += 1;
      progressed = push({
        key: next.target,
        edge: next,
        relation: 'descendant',
        distance: queue.distance,
        branch: queue.branch,
      }) || progressed;
    }
  }

  return selected;
}
