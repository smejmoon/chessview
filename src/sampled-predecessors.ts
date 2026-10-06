import { Chess } from 'chess.js';
import { canonicalPosition, START_FEN } from './graph.js';
import { lichessSession } from './lichess-session.js';

const EXPORT_ENDPOINT = 'https://lichess.org/api/games/export/_ids';
const GAME_ID = /^[A-Za-z0-9]{8}$/;
const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const MAX_REPRESENTATIVE_GAMES = 8;

export type PredecessorNomination = Readonly<{
  source: string;
  uci: string;
  gameId: string;
}>;

type GameExport = Readonly<{
  id?: unknown;
  moves?: unknown;
  initialFen?: unknown;
}>;

type ExportResponse = Readonly<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

type ExportRequest = (
  input: string,
  init: Readonly<Record<string, unknown>>,
) => Promise<ExportResponse>;

export type SampledPredecessorOptions = Readonly<{
  signal?: AbortSignal;
  priority?: 'foreground' | 'background' | (() => 'foreground' | 'background');
  request?: ExportRequest;
}>;

function playExportedMove(chess: Chess, token: string) {
  try {
    if (UCI_MOVE.test(token)) {
      return chess.move({
        from: token.slice(0, 2),
        to: token.slice(2, 4),
        promotion: token.slice(4) || undefined,
      });
    }
    return chess.move(token);
  } catch {
    return null;
  }
}

function replayPredecessor(target: string, game: GameExport): PredecessorNomination | null {
  if (typeof game.id !== 'string' || !GAME_ID.test(game.id) || typeof game.moves !== 'string') return null;
  const initialFen = typeof game.initialFen === 'string' && game.initialFen !== 'startpos'
    ? game.initialFen
    : START_FEN;
  let chess: Chess;
  try { chess = new Chess(initialFen); } catch { return null; }

  for (const token of game.moves.trim().split(/\s+/).filter(Boolean)) {
    const source = canonicalPosition(chess.fen());
    const played = playExportedMove(chess, token);
    if (!played) return null;
    if (canonicalPosition(chess.fen()) === target) {
      return Object.freeze({
        source,
        uci: `${played.from}${played.to}${played.promotion ?? ''}`,
        gameId: game.id,
      });
    }
  }
  return null;
}

export function sampleGameIds(reading: unknown): readonly string[] {
  if (!reading || typeof reading !== 'object') return Object.freeze([]);
  const value = reading as { topGames?: unknown; recentGames?: unknown };
  const ids: string[] = [];
  for (const list of [value.topGames, value.recentGames]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const id = item && typeof item === 'object' ? (item as { id?: unknown }).id : null;
      if (typeof id === 'string' && GAME_ID.test(id) && !ids.includes(id)) ids.push(id);
    }
  }
  return Object.freeze(ids);
}

export function representativeSampleComplete(reading: unknown): boolean {
  if (!reading || typeof reading !== 'object') return false;
  const value = reading as { white?: unknown; draws?: unknown; black?: unknown };
  const counts = [value.white, value.draws, value.black];
  if (!counts.every((count) => Number.isInteger(count) && (count as number) >= 0)) return false;
  const total = (value.white as number) + (value.draws as number) + (value.black as number);
  return sampleGameIds(reading).length >= Math.min(MAX_REPRESENTATIVE_GAMES, total);
}

export async function discoverSampledPredecessors(
  target: string,
  gameIds: readonly string[],
  {
    signal,
    priority = 'foreground',
    request = (input, init) => lichessSession.authorizedRequest(input, init) as Promise<ExportResponse>,
  }: SampledPredecessorOptions = {},
): Promise<readonly PredecessorNomination[]> {
  const canonical = canonicalPosition(target);
  const ids = [...new Set(gameIds.filter((id) => GAME_ID.test(id)))];
  if (!ids.length) return Object.freeze([]);

  const url = new URL(EXPORT_ENDPOINT);
  url.searchParams.set('moves', 'true');
  url.searchParams.set('tags', 'false');
  url.searchParams.set('clocks', 'false');
  url.searchParams.set('evals', 'false');
  url.searchParams.set('opening', 'false');

  const response = await request(url.toString(), {
    method: 'POST',
    signal,
    priority,
    headers: {
      Accept: 'application/x-ndjson',
      'Content-Type': 'text/plain',
    },
    body: ids.join(','),
  });
  if (!response.ok) throw Object.assign(new Error(`Lichess game export returned ${response.status}`), { status: response.status });

  const nominations = new Map<string, PredecessorNomination>();
  for (const line of (await response.text()).split(/\r?\n/)) {
    if (!line.trim()) continue;
    let game: GameExport;
    try { game = JSON.parse(line) as GameExport; } catch { continue; }
    const nomination = replayPredecessor(canonical, game);
    if (!nomination) continue;
    const key = `${nomination.source}|${nomination.uci}`;
    if (!nominations.has(key)) nominations.set(key, nomination);
  }
  return Object.freeze([...nominations.values()]);
}
