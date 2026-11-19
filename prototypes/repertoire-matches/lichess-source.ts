import { lichessSession } from '../../src/lichess-session.ts';
import { toPlayableFen } from '../../src/graph.ts';
import type { GameRecord, OpeningSeed, Side } from './matcher.ts';

export type Log = (area: string, event: string, detail?: Record<string, unknown>) => void;
export type StrongPlayer = {
  id: string;
  name: string;
  title: string;
  rating: number;
  board: string;
  source: 'opening-explorer';
  seedHits: number;
  seedRoutes: string[];
  exampleGames: number;
};
export type DiscoveryBranch = {
  side: Side; key: string; route: string;
  discoveredAccounts: number; titledAccounts: number; selectedAccounts: number;
};
export type GameResult = {
  games: GameRecord[];
  rejected: number;
  received: number;
  overflow: number;
  bytes: number;
  streamStoppedAtLimit: boolean;
};
const SPEEDS = ['blitz', 'rapid', 'classical'] as const;
const TITLES = new Set(['GM', 'WGM', 'IM', 'WIM', 'FM', 'WFM']);
const MAX_BYTES = 3_000_000;
const USERNAME = /^[A-Za-z0-9_-]{2,30}$/;

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
  if (typeof name !== 'string' || !USERNAME.test(name)) {
    throw new Error('Lichess account returned no usable username');
  }
  return name;
}

type Prospect = {
  id: string;
  name: string;
  title: string | null;
  maxObservedRating: number;
  routes: Set<string>;
  seenGames: Set<string>;
};
function extractProspects(seeds: OpeningSeed[], responses: { seed: OpeningSeed; payload: any }[], ownUsername: string) {
  const found = new Map<string, Prospect>();
  for (const { seed, payload } of responses) {
    for (const game of [...(payload.topGames ?? []), ...(payload.recentGames ?? [])]) {
      const selected = game?.[seed.side as Side];
      const name = selected?.name;
      const rating = selected?.rating;
      if (typeof name !== 'string' || !USERNAME.test(name) ||
          name.toLowerCase() === ownUsername.toLowerCase() ||
          !Number.isFinite(rating) || rating < 2200) continue;
      const id = name.toLowerCase();
      let player = found.get(id);
      if (!player) {
        player = {
          id, name, title: null, maxObservedRating: 0,
          routes: new Set(), seenGames: new Set(),
        };
        found.set(id, player);
      }
      if (TITLES.has(selected.title)) player.title = selected.title;
      player.maxObservedRating = Math.max(player.maxObservedRating, rating);
      player.routes.add(seed.originRoute ?? seed.route);
      if (typeof game.id === 'string') player.seenGames.add(game.id);
    }
  }
  return [...found.values()].sort((a, b) => b.routes.size - a.routes.size ||
    b.maxObservedRating - a.maxObservedRating || b.seenGames.size - a.seenGames.size);
}

export async function discoverCandidates(
  ownUsername: string, seeds: OpeningSeed[], count: number, log: Log, signal: AbortSignal,
  authorizedRequest: typeof lichessSession.authorizedRequest = lichessSession.authorizedRequest,
  onBranches?: (stats: DiscoveryBranch[]) => void,
  months = 12,
): Promise<StrongPlayer[]> {
  const explorerResults: { seed: OpeningSeed; payload: any }[] = [];
  log('discovery', 'opening-first discovery started', {
    openingQueries: seeds.length, requestedCandidates: count,
    seedRoutes: seeds.map(seed => ({
      side: seed.side, route: seed.route, originRoute: seed.originRoute ?? null,
      visits: seed.visits, ply: seed.ply,
    })),
  });
  for (const [index, seed] of seeds.entries()) {
    const url = new URL('https://explorer.lichess.org/lichess');
    url.searchParams.set('variant', 'standard');
    url.searchParams.set('fen', seed.key);
    url.searchParams.set('speeds', SPEEDS.join(','));
    url.searchParams.set('ratings', '2200,2500');
    url.searchParams.set('since', new Date(Date.now() - months * 30.44 * 86400000).toISOString().slice(0, 7));
    url.searchParams.set('moves', '0');
    url.searchParams.set('topGames', '4');
    url.searchParams.set('recentGames', '4');
    const started = performance.now();
    try {
      log('discovery', 'opening explorer request', {
        index: index + 1, total: seeds.length, side: seed.side, route: seed.route, visits: seed.visits,
        auth: 'LichessSession',
      });
      // The rated Explorer endpoint requires the same authenticated session as Chessview's Explorer client.
      const response = await authorizedRequest(url, {
        headers: { Accept: 'application/json' }, signal,
      }, { signal, urgency: 'background' });
      log('network', 'opening explorer response', {
        side: seed.side, route: seed.route, status: response.status,
        elapsedMs: Math.round(performance.now() - started), auth: 'LichessSession',
      });
      if (!response.ok) throw httpError('Opening Explorer', response.status);
      const payload = await response.json();
      if (!Array.isArray(payload?.topGames) || !Array.isArray(payload?.recentGames)) {
        throw new Error('Malformed opening Explorer response');
      }
      explorerResults.push({ seed, payload });
      log('discovery', 'opening explorer games', {
        route: seed.route, side: seed.side, top: payload.topGames.length,
        recent: payload.recentGames.length,
        totalPositionGames: (payload.white ?? 0) + (payload.draws ?? 0) + (payload.black ?? 0),
        ms: Math.round(performance.now() - started),
      });
    } catch (error) {
      if (signal.aborted) throw error;
      log('error', 'opening discovery query failed', {
        route: seed.route, status: httpStatus(error),
        reason: error instanceof Error ? error.message : String(error),
      });
      if ([401, 429].includes(httpStatus(error) ?? -1)) throw error;
    }
  }
  const prospects = extractProspects(seeds, explorerResults, ownUsername);
  log('discovery', 'opening-derived prospect pool', {
    prospects: prospects.length,
    withKnownTitles: prospects.filter(p => p.title).length,
    top: prospects.slice(0, 12).map(p => ({
      player: p.name, seedHits: p.routes.size, exampleGames: p.seenGames.size,
      observedRating: p.maxObservedRating,
    })),
  });

  // Verify titled identity and current ratings for Explorer-derived names in one bounded batch.
  let users: any[] = [];
  if (prospects.length) {
    const started = performance.now();
    try {
      const response = await authorizedRequest('https://lichess.org/api/users?profile=false', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'text/plain' },
        body: prospects.slice(0, 100).map(p => p.id).join(','),
        signal,
      }, { signal, urgency: 'background' });
      if (!response.ok) throw httpError('User title lookup', response.status);
      const payload = await response.json();
      if (!Array.isArray(payload)) throw new Error('Malformed user title lookup');
      users = payload;
      log('discovery', 'user title lookup completed', {
        requested: Math.min(prospects.length, 100), received: users.length,
        ms: Math.round(performance.now() - started),
      });
    } catch (error) {
      if (signal.aborted) throw error;
      log('error', 'user title lookup failed; using Explorer titles where present', {
        status: httpStatus(error), reason: error instanceof Error ? error.message : String(error),
      });
      if ([401, 429].includes(httpStatus(error) ?? -1)) throw error;
    }
  }
  const resolved = new Map<string, any>();
  for (const user of users) if (typeof user?.id === 'string') resolved.set(user.id.toLowerCase(), user);
  const discovered: StrongPlayer[] = [];
  for (const prospect of prospects) {
    const account = resolved.get(prospect.id);
    const title = account ? account.title : prospect.title;
    if (!TITLES.has(title)) continue;
    const perfs = SPEEDS.map(board => ({ board, rating: Number(account?.perfs?.[board]?.rating ?? 0) }));
    perfs.sort((a, b) => b.rating - a.rating);
    const board = perfs[0]?.rating >= 2200 ? perfs[0].board : 'sample';
    discovered.push({
      id: prospect.id, name: account?.username || prospect.name, title,
      rating: board === 'sample' ? prospect.maxObservedRating : perfs[0].rating,
      board, source: 'opening-explorer', seedHits: prospect.routes.size,
      seedRoutes: [...prospect.routes], exampleGames: prospect.seenGames.size,
    });
  }
  discovered.sort((a, b) => b.seedHits - a.seedHits || b.rating - a.rating || a.id.localeCompare(b.id));
  discovered.splice(count);
  const branchStats = seeds.filter(seed => !seed.originKey).map(seed => {
    const found = prospects.filter(p => p.routes.has(seed.route));
    return {
      side: seed.side, key: seed.key, route: seed.route,
      discoveredAccounts: found.length,
      titledAccounts: found.filter(p => TITLES.has(resolved.get(p.id)?.title ?? p.title)).length,
      selectedAccounts: discovered.filter(d => d.seedRoutes.includes(seed.route)).length,
    };
  });
  onBranches?.(branchStats);
  log('discovery', 'per-branch candidate funnel', { branches: branchStats });
  log('discovery', 'opening candidates verified', {
    candidates: discovered.length,
    names: discovered.map(p => ({ player: p.name, seedHits: p.seedHits, games: p.exampleGames })),
  });

  log('discovery', 'candidate cohort assembled', {
    requested: count, total: discovered.length,
    openingDerived: discovered.filter(p => p.source === 'opening-explorer').length,
    leaderboardFallback: 0,
  });
  return discovered;
}

async function parseNdjson(
  response: Response, signal: AbortSignal, limit: number,
): Promise<Omit<GameResult, 'overflow'>> {
  const games: GameRecord[] = [];
  let rejected = 0, received = 0, bytes = 0, buffer = '', streamStoppedAtLimit = false;
  const add = (line: string) => {
    if (!line.trim()) return;
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        received++;
        if (games.length < limit) games.push(parsed as GameRecord);
      } else rejected++;
    } catch { rejected++; }
  };
  if (!response.body) {
    const whole = await response.text();
    bytes = new TextEncoder().encode(whole).length;
    if (bytes > MAX_BYTES) throw new Error('Game export exceeds safety limit');
    for (const line of whole.split(/\\r?\\n/)) add(line);
    return { games, rejected, received, bytes, streamStoppedAtLimit };
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let completed = false;
  try {
    for (;;) {
      if (signal.aborted) throw new Error('Export cancelled');
      const { done, value } = await reader.read();
      if (done) { completed = true; break; }
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw new Error('Game export exceeds 3 MB safety limit');
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        add(line.trim());
        if (games.length >= limit) {
          // We deliberately do not wait for the export's trailing stream/keepalive.
          streamStoppedAtLimit = true;
          break;
        }
      }
      if (streamStoppedAtLimit) break;
    }
    if (!streamStoppedAtLimit) {
      buffer += decoder.decode();
      add(buffer.trim());
    }
  } finally {
    if (!completed) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return { games, rejected, received, bytes, streamStoppedAtLimit };
}

export async function exportGames(
  player: string, limit: number, months: number, log: Log, signal: AbortSignal,
  authorizedRequest: typeof lichessSession.authorizedRequest = lichessSession.authorizedRequest,
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
  const response = await authorizedRequest(url, {
    headers: { Accept: 'application/x-ndjson' }, signal,
  }, { signal, urgency: 'background' });
  log('network', 'game export response', {
    player, status: response.status, firstByteMs: Math.round(performance.now() - started),
  });
  if (!response.ok) throw httpError('Game export for ' + player, response.status);
  const parsed = await parseNdjson(response, signal, limit);
  // Some exports include more records than the requested max; enforce a local sample boundary.
  const result: GameResult = {
    ...parsed, games: parsed.games.slice(0, limit),
    overflow: Math.max(0, parsed.received - limit),
  };
  log('games', 'export parsed', {
    player, requested: limit, received: parsed.received, used: result.games.length,
    overflow: result.overflow, rejectedLines: result.rejected, bytes: result.bytes,
    streamStoppedAtLimit: result.streamStoppedAtLimit,
    elapsedMs: Math.round(performance.now() - started),
  });
  return result;
}


/**
 * Bounded diagnostic probe of one player/color at a canonical opening root.
 * Player Explorer is a live indexing stream: a partial snapshot never means
 * authoritative absence and never enters the game-sample similarity score.
 */
export type PlayerBranchProbe = {
  side: Side;
  key: string;
  route: string;
  status: 'complete' | 'partial' | 'timeout' | 'unavailable';
  snapshotGames: number | null;
  queuePosition: number | null;
  moves: { uci: string; san: string; games: number }[];
  elapsedMs: number;
  httpStatus: number | null;
};

type PlayerSnapshot = {
  queuePosition: number;
  white: number;
  draws: number;
  black: number;
  moves: { uci: string; san: string; white: number; draws: number; black: number }[];
};

function playerSnapshot(line: string): PlayerSnapshot {
  const value = JSON.parse(line);
  if (!value || typeof value !== 'object' ||
      ![value.white, value.draws, value.black, value.queuePosition].every(
        n => Number.isInteger(n) && n >= 0) ||
      !Array.isArray(value.moves)) throw new Error('Malformed Player Explorer snapshot');
  return value as PlayerSnapshot;
}

/** Prefer discovery hits, then frequent positions for each color; never more than four. */
export function selectPlayerProbes(candidate: StrongPlayer, seeds: OpeningSeed[], limit = 4): OpeningSeed[] {
  const preferred = seeds.filter(seed => candidate.seedRoutes.includes(seed.route))
    .sort((a, b) => b.visits - a.visits);
  const balanced = (['white', 'black'] as Side[]).map(side =>
    seeds.filter(seed => seed.side === side).sort((a, b) => b.visits - a.visits)[0])
    .filter((seed): seed is OpeningSeed => Boolean(seed));
  const remaining = [...seeds].sort((a, b) => b.visits - a.visits);
  const chosen: OpeningSeed[] = [];
  for (const seed of [...preferred.slice(0, 2), ...balanced, ...preferred.slice(2), ...remaining]) {
    if (chosen.some(item => item.side === seed.side && item.key === seed.key)) continue;
    chosen.push(seed);
    if (chosen.length >= limit) break;
  }
  return chosen;
}

export async function probePlayerBranch(
  player: string, seed: OpeningSeed, months: number, log: Log, signal: AbortSignal,
  authorizedRequest: typeof lichessSession.authorizedRequest = lichessSession.authorizedRequest,
  timeoutMs = 2200,
): Promise<PlayerBranchProbe> {
  const started = performance.now();
  const timeout = AbortSignal.timeout(timeoutMs);
  const requestSignal = AbortSignal.any([signal, timeout]);
  const url = new URL('https://explorer.lichess.org/player');
  url.searchParams.set('player', player);
  url.searchParams.set('color', seed.side);
  url.searchParams.set('variant', 'standard');
  url.searchParams.set('fen', toPlayableFen(seed.key));
  url.searchParams.set('speeds', SPEEDS.join(','));
  url.searchParams.set('modes', 'rated');
  url.searchParams.set('since', new Date(Date.now() - months * 30.44 * 86400000).toISOString().slice(0, 7));
  url.searchParams.set('moves', '12');
  url.searchParams.set('recentGames', '0');
  log('player-explorer', 'probe started', {
    player, side: seed.side, route: seed.route, timeoutMs, since: url.searchParams.get('since'),
  });

  let snapshot: PlayerSnapshot | null = null;
  let complete = false;
  let http: number | null = null;
  let bytes = 0;
  const decodeLine = (line: string) => {
    if (line.trim()) snapshot = playerSnapshot(line);
  };
  try {
    const response = await authorizedRequest(url, {
      headers: { Accept: 'application/x-ndjson' }, signal: requestSignal,
    }, { signal: requestSignal, urgency: 'background' });
    http = response.status;
    if (!response.ok) throw httpError('Player Explorer', response.status);
    if (!response.body) {
      const body = await response.text();
      bytes = new TextEncoder().encode(body).byteLength;
      if (bytes > 128_000) throw new Error('Player Explorer snapshot exceeds 128 KB');
      for (const line of body.split(/\\r?\\n/)) decodeLine(line);
      complete = true;
    } else {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) {
            buffer += decoder.decode();
            decodeLine(buffer);
            complete = true;
            break;
          }
          bytes += value.byteLength;
          if (bytes > 128_000) throw new Error('Player Explorer stream exceeds 128 KB');
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) decodeLine(line);
        }
      } finally {
        if (!complete) await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    }
  } catch (error) {
    if (signal.aborted) throw error;
    if ([401, 429].includes(httpStatus(error) ?? -1)) throw error;
    if (!timeout.aborted) {
      log('error', 'player explorer probe unavailable', {
        player, side: seed.side, route: seed.route, status: httpStatus(error),
        reason: error instanceof Error ? error.message : String(error),
      });
      return { side: seed.side, key: seed.key, route: seed.route, status: 'unavailable',
        snapshotGames: null, queuePosition: null, moves: [],
        elapsedMs: Math.round(performance.now() - started), httpStatus: http };
    }
  }
  // A nonzero indexing queue is not a complete database observation, even if
  // the stream closes. Zero before EOF may also be preliminary.
  const status = complete && snapshot?.queuePosition === 0 ? 'complete' :
    snapshot ? 'partial' : 'timeout';
  const evidence: PlayerBranchProbe = {
    side: seed.side, key: seed.key, route: seed.route, status,
    snapshotGames: snapshot ? snapshot.white + snapshot.draws + snapshot.black : null,
    queuePosition: snapshot?.queuePosition ?? null,
    moves: snapshot?.moves.slice(0, 12).filter(m => typeof m.uci === 'string' &&
      typeof m.san === 'string' &&
      [m.white, m.draws, m.black].every(n => Number.isInteger(n) && n >= 0))
      .map(m => ({ uci: m.uci, san: m.san, games: m.white + m.draws + m.black })) ?? [],
    elapsedMs: Math.round(performance.now() - started), httpStatus: http,
  };
  log('player-explorer', 'probe completed', {
    player, side: seed.side, route: seed.route, status,
    snapshotGames: evidence.snapshotGames, queuePosition: evidence.queuePosition,
    elapsedMs: evidence.elapsedMs, bytes,
  });
  return evidence;
}

/** Single bounded verification entry point; no game-history exports. */
export async function verifyCandidatePositions(
  candidate: StrongPlayer, seeds: OpeningSeed[], months: number, log: Log, signal: AbortSignal,
  authorizedRequest: typeof lichessSession.authorizedRequest = lichessSession.authorizedRequest,
  timeoutMs = 2200,
): Promise<PlayerBranchProbe[]> {
  const results: PlayerBranchProbe[] = [];
  const selected = selectPlayerProbes(candidate, seeds);
  for (const [index, seed] of selected.entries()) {
    if (signal.aborted) break;
    log('verification', 'candidate position query', {
      player: candidate.name, index: index + 1, total: selected.length,
      side: seed.side, route: seed.route,
    });
    results.push(await probePlayerBranch(candidate.name, seed, months, log, signal,
      authorizedRequest, timeoutMs));
  }
  log('verification', 'candidate verification completed', {
    player: candidate.name, requested: selected.length,
    complete: results.filter(p => p.status === 'complete').length,
    incomplete: results.filter(p => p.status !== 'complete').length,
    observed: results.filter(p => p.status === 'complete' &&
      (p.snapshotGames ?? 0) >= 3).length,
  });
  return results;
}
