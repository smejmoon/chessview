import { lichessGateway } from '../../src/lichess-gateway.ts';
import { lichessSession } from '../../src/lichess-session.ts';
import type { GameRecord } from './matcher.ts';

export type Log = (area: string, event: string, detail?: Record<string, unknown>) => void;
export type StrongPlayer = { id: string; name: string; title: string; rating: number; board: string };
export type GameResult = { games: GameRecord[]; rejected: number };
const SPEEDS = ['blitz', 'rapid', 'classical'] as const;
const TITLES = new Set(['GM', 'WGM', 'IM', 'WIM', 'FM', 'WFM']);
const MAX_BYTES = 3_000_000;

function httpError(label: string, status: number): Error {
  const error = new Error(label + ' returned HTTP ' + status);
  Object.assign(error, { status });
  return error;
}

export function httpStatus(error: unknown): number | null {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : null;
}

export async function accountName(log: Log, signal: AbortSignal): Promise<string> {
  const started = performance.now();
  log('auth', 'checking active Lichess account');
  const response = await lichessSession.authorizedRequest('https://lichess.org/api/account', {
    headers: { Accept: 'application/json' }, signal,
  }, { signal, urgency: 'foreground' });
  log('auth', 'account response', { status: response.status, ms: Math.round(performance.now() - started) });
  if (!response.ok) throw httpError('Lichess account', response.status);
  const value = await response.json();
  const name = value?.username || value?.id;
  if (typeof name !== 'string' || !/^[A-Za-z0-9_-]{2,30}$/.test(name)) {
    throw new Error('Lichess account returned no usable username');
  }
  return name;
}

export async function discoverCandidates(
  ownUsername: string, count: number, log: Log, signal: AbortSignal,
): Promise<StrongPlayer[]> {
  const lists: StrongPlayer[][] = [];
  for (const board of SPEEDS) {
    const started = performance.now();
    log('discovery', 'requesting leaderboard', { board });
    try {
      const url = 'https://lichess.org/api/player/top/100/' + board;
      const response = await lichessGateway.request(url, {
        headers: { Accept: 'application/vnd.lichess.v3+json' }, signal,
      }, { signal, urgency: 'background' });
      log('network', 'leaderboard response', { board, status: response.status, ms: Math.round(performance.now() - started) });
      if (!response.ok) throw httpError('Leaderboard ' + board, response.status);
      const payload = await response.json();
      if (!Array.isArray(payload?.users)) throw new Error('Malformed leaderboard response: ' + board);
      const players: StrongPlayer[] = [];
      for (const value of payload.users) {
        const id = value?.id;
        const name = value?.username;
        const title = value?.title;
        const rating = value?.perfs?.[board]?.rating;
        if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{2,30}$/.test(id) ||
            typeof name !== 'string' || !TITLES.has(title) ||
            !Number.isFinite(rating) || rating < 2200) continue;
        players.push({ id, name, title, rating, board });
      }
      lists.push(players);
      log('discovery', 'eligible titled players', { board, count: players.length });
    } catch (error) {
      if (signal.aborted) throw error;
      log('error', 'leaderboard unavailable', {
        board, status: httpStatus(error), reason: error instanceof Error ? error.message : String(error),
      });
      if (httpStatus(error) === 429 || httpStatus(error) === 401) throw error;
      lists.push([]);
    }
  }
  // Round-robin across speeds rather than letting one leaderboard monopolize the sample.
  const seen = new Set([ownUsername.toLowerCase()]);
  const candidates: StrongPlayer[] = [];
  for (let row = 0; row < 100 && candidates.length < count; row++) {
    for (const list of lists) {
      const player = list[row];
      if (!player || seen.has(player.id.toLowerCase())) continue;
      seen.add(player.id.toLowerCase());
      candidates.push(player);
      if (candidates.length === count) break;
    }
  }
  log('discovery', 'candidate cohort assembled', { count: candidates.length, requested: count });
  return candidates;
}

async function parseNdjson(response: Response, signal: AbortSignal): Promise<GameResult> {
  const games: GameRecord[] = [];
  let rejected = 0, bytes = 0, buffer = '';
  const add = (line: string) => {
    if (!line.trim()) return;
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) games.push(parsed as GameRecord);
      else rejected++;
    } catch { rejected++; }
  };
  if (!response.body) {
    const whole = await response.text();
    if (new TextEncoder().encode(whole).length > MAX_BYTES) throw new Error('Game export exceeds safety limit');
    for (const line of whole.split(/\r?\n/)) add(line);
    return { games, rejected };
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      if (signal.aborted) throw new Error('Export cancelled');
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw new Error('Game export exceeds 3 MB safety limit');
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) add(line.trim());
    }
    buffer += decoder.decode();
    add(buffer.trim());
  } finally {
    reader.releaseLock();
    if (signal.aborted || bytes > MAX_BYTES) await response.body.cancel().catch(() => {});
  }
  return { games, rejected };
}

export async function exportGames(
  player: string, limit: number, months: number, log: Log, signal: AbortSignal,
): Promise<GameResult> {
  const url = new URL('https://lichess.org/api/games/user/' + encodeURIComponent(player));
  url.searchParams.set('max', String(limit));
  url.searchParams.set('rated', 'true');
  url.searchParams.set('perfType', SPEEDS.join(','));
  url.searchParams.set('since', String(Math.floor(Date.now() - months * 30.44 * 86400000)));
  url.searchParams.set('moves', 'true');
  url.searchParams.set('opening', 'false');
  url.searchParams.set('clocks', 'false');
  url.searchParams.set('evals', 'false');
  const started = performance.now();
  log('network', 'game export started', { player, limit, months });
  const response = await lichessSession.authorizedRequest(url, {
    headers: { Accept: 'application/x-ndjson' }, signal,
  }, { signal, urgency: 'background' });
  log('network', 'game export response', { player, status: response.status, ms: Math.round(performance.now() - started) });
  if (!response.ok) throw httpError('Game export for ' + player, response.status);
  const result = await parseNdjson(response, signal);
  log('games', 'export parsed', {
    player, received: result.games.length, rejectedLines: result.rejected,
    elapsedMs: Math.round(performance.now() - started),
  });
  return result;
}
