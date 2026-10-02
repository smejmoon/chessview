import { Chess } from 'chess.js';

export const EXPLORER_TTL_MS = 24 * 60 * 60 * 1000;
export const START_FEN = new Chess().fen();

export type GameCounts = Readonly<{
  white?: number;
  draws?: number;
  black?: number;
}>;

export type ExplorerMove = GameCounts & Readonly<{
  uci: string;
  [field: string]: unknown;
}>;

export type ExplorerReading = GameCounts & Readonly<{
  moves?: readonly ExplorerMove[];
  [field: string]: unknown;
}>;

export type DecoratedExplorerMove = ExplorerMove & Readonly<{
  games: number;
  share: number;
}>;

export type ResolveMoveInput = Readonly<{
  uci?: string;
  from?: string;
  to?: string;
  promotion?: string;
}>;

export type ResolvedMove = Readonly<{
  target: string;
  fen: string;
  san: string;
  uci: string;
}>;

export type EdgeIdentity = Readonly<{
  source: string;
  uci: string;
  target: string;
}>;

export type OrderedEdge = Readonly<{
  uci: string;
  target: string;
  share?: number;
}>;

export function toPlayableFen(positionKey: string): string {
  const parts = positionKey.trim().split(/\s+/);
  if (parts.length >= 6) return parts.slice(0, 6).join(' ');
  if (parts.length === 4) return `${parts.join(' ')} 0 1`;
  throw new Error('Invalid chess position');
}

export function canonicalPosition(fen: string): string {
  const chess = new Chess(toPlayableFen(fen));
  const [placement, turn, castling, ep] = chess.fen().split(' ');
  let relevantEp = '-';
  if (ep !== '-') {
    const canCaptureEp = chess.moves({ verbose: true }).some((move) => move.flags.includes('e'));
    if (canCaptureEp) relevantEp = ep;
  }
  return `${placement} ${turn} ${castling || '-'} ${relevantEp}`;
}

export function resolveMove(sourceKey: string, move: ResolveMoveInput): ResolvedMove {
  const chess = new Chess(toPlayableFen(sourceKey));
  const from = move.from ?? move.uci?.slice(0, 2);
  const to = move.to ?? move.uci?.slice(2, 4);
  if (!from || !to) throw new Error(`Illegal move from graph source: ${move.uci ?? ''}`);

  const uciPromotion = move.uci?.slice(4) || undefined;
  const played = chess.move({
    from,
    to,
    promotion: move.promotion ?? uciPromotion,
  });
  if (!played) throw new Error(`Illegal move from graph source: ${move.uci ?? ''}`);
  return {
    target: canonicalPosition(chess.fen()),
    fen: chess.fen(),
    san: played.san,
    uci: `${played.from}${played.to}${played.promotion ?? ''}`,
  };
}

export function totalGames(explorer?: GameCounts | null): number {
  return (explorer?.white ?? 0) + (explorer?.draws ?? 0) + (explorer?.black ?? 0);
}

export function moveGames(move?: GameCounts | null): number {
  return (move?.white ?? 0) + (move?.draws ?? 0) + (move?.black ?? 0);
}

export function decorateExplorerMoves(
  explorer?: ExplorerReading | null,
): DecoratedExplorerMove[] {
  const total = totalGames(explorer);
  return (explorer?.moves ?? []).map((move) => {
    const games = moveGames(move);
    return {
      ...move,
      games,
      share: total ? games / total : 0,
    };
  });
}

export function edgeId(edge: EdgeIdentity): string {
  return `${edge.source}|${edge.uci}|${edge.target}`;
}

export function positionFromUrl(search = window.location.search): string {
  const params = new URLSearchParams(search);
  const raw = params.get('fen');
  if (!raw) return canonicalPosition(START_FEN);
  try {
    return canonicalPosition(raw);
  } catch {
    return canonicalPosition(START_FEN);
  }
}

export function positionUrl(key: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('fen', canonicalPosition(key));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function legalDestinations(positionKey: string): Map<string, string[]> {
  const chess = new Chess(toPlayableFen(positionKey));
  const destinations = new Map<string, string[]>();
  for (const move of chess.moves({ verbose: true })) {
    if (!destinations.has(move.from)) destinations.set(move.from, []);
    const targets = destinations.get(move.from);
    if (targets && !targets.includes(move.to)) targets.push(move.to);
  }
  return destinations;
}

export function legalMoveTargets(positionKey: string): Set<string> {
  const chess = new Chess(toPlayableFen(positionKey));
  const targets = new Set<string>();
  for (const move of chess.moves({ verbose: true })) {
    chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    targets.add(canonicalPosition(chess.fen()));
    chess.undo();
  }
  return targets;
}

export function stableEdgeOrder(a: OrderedEdge, b: OrderedEdge): number {
  return (b.share ?? 0) - (a.share ?? 0)
    || a.uci.localeCompare(b.uci)
    || a.target.localeCompare(b.target);
}
