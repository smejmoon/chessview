import { EXPLORER_TTL_MS } from './config.ts';
import {
  canonicalPosition,
  toPlayableFen,
  totalGames,
  type ExplorerMove,
  type ExplorerReading,
} from './graph.ts';
import { debugLog } from './debug.js';
import { lichessSession } from './lichess-session.js';
import { lichessGateway } from './lichess-gateway.js';
import { isObsoleteWork } from './obsolete-work.js';
import { positionRepository } from './position-repository.js';

const ENDPOINT = 'https://explorer.lichess.org/lichess';
const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

type LoadPriority = 'foreground' | 'background';
type Priority = LoadPriority | (() => LoadPriority);
type LoadOptions = Readonly<{
  force?: boolean;
  signal?: AbortSignal;
  priority?: Priority;
}>;

type ParsedExplorerMove = ExplorerMove & Readonly<{
  white: number;
  draws: number;
  black: number;
}>;

type ParsedExplorerReading = ExplorerReading & Readonly<{
  white: number;
  draws: number;
  black: number;
  moves: readonly ParsedExplorerMove[];
}>;

type PositionRecord = Readonly<{
  fen?: string;
  opening?: unknown;
  explorer?: unknown;
  explorerFetchedAt?: number;
  [field: string]: unknown;
}>;

type ProducerContext = Readonly<{
  signal: AbortSignal;
  priority: () => LoadPriority;
}>;

type ExplorerRepository = Readonly<{
  get(position: string): Promise<PositionRecord | null>;
  merge(position: string, fields: Readonly<Record<string, unknown>>): Promise<unknown>;
  load<T>(
    position: string,
    facet: string,
    producer: (context: ProducerContext) => Promise<T>,
    options?: Readonly<{ signal?: AbortSignal; priority?: Priority }>,
  ): Promise<T>;
}>;

type ErrorLike = Readonly<{
  name?: string;
  message?: string;
}>;

const repository = positionRepository as unknown as ExplorerRepository;

function explorerUrl(key: string): URL {
  const url = new URL(ENDPOINT);
  url.searchParams.set('variant', 'standard');
  url.searchParams.set('fen', toPlayableFen(key));
  url.searchParams.set('moves', '30');
  url.searchParams.set('topGames', '0');
  url.searchParams.set('recentGames', '0');
  return url;
}

function httpError(status: number, message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

function invalidDataError(): Error & { kind: 'invalid-data' } {
  return Object.assign(new Error('Lichess explorer returned invalid data'), { kind: 'invalid-data' as const });
}

function validCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function validExplorerMove(value: unknown, sourceGames: number): value is ParsedExplorerMove {
  const move = asRecord(value);
  if (!move) return false;
  if (typeof move.uci !== 'string' || !UCI_MOVE.test(move.uci)) return false;
  if (![move.white, move.draws, move.black].every(validCount)) return false;
  return (move.white as number) + (move.draws as number) + (move.black as number) <= sourceGames;
}

function parseExplorerReading(value: unknown): ParsedExplorerReading {
  const reading = asRecord(value);
  if (!reading) throw invalidDataError();
  if (![reading.white, reading.draws, reading.black].every(validCount)) throw invalidDataError();
  if (!Array.isArray(reading.moves)) throw invalidDataError();

  const sourceGames = totalGames(reading);
  if (!reading.moves.every((move) => validExplorerMove(move, sourceGames))) throw invalidDataError();
  return reading as ParsedExplorerReading;
}

function cachedExplorerReading(record: PositionRecord | null | undefined): ParsedExplorerReading | null {
  if (!record?.explorer) return null;
  try {
    return parseExplorerReading(record.explorer);
  } catch {
    return null;
  }
}

export async function readCachedExplorerReading(key: string): Promise<ParsedExplorerReading | null> {
  const cached = await repository.get(canonicalPosition(key));
  return cachedExplorerReading(cached);
}

function errorLike(error: unknown): ErrorLike {
  return error && typeof error === 'object' ? error as ErrorLike : {};
}

function recoverExplorerRefresh(
  error: unknown,
  canonical: string,
  cachedExplorer: ParsedExplorerReading | null,
  signal: AbortSignal,
): ParsedExplorerReading {
  const details = errorLike(error);
  if (isObsoleteWork(error, signal)) throw error;
  if (cachedExplorer) {
    debugLog('Explorer refresh failed; using stale Reading', {
      position: canonical,
      error: details.message ?? String(error),
      games: totalGames(cachedExplorer),
    }, 'warn');
    return cachedExplorer;
  }
  debugLog('explorer refresh failed', {
    position: canonical,
    error: details.message ?? String(error),
  }, 'error');
  throw error;
}

async function persistExplorerReading(
  canonical: string,
  explorer: ParsedExplorerReading,
  cached: PositionRecord | null,
): Promise<void> {
  try {
    await repository.merge(canonical, {
      fen: cached?.fen ?? toPlayableFen(canonical),
      opening: explorer.opening ?? cached?.opening ?? null,
      explorer,
      explorerFetchedAt: Date.now(),
      games: totalGames(explorer),
    });
    debugLog('Explorer Reading stored', { position: canonical, games: totalGames(explorer) });
  } catch (error: unknown) {
    const details = errorLike(error);
    debugLog('Explorer Reading persistence failed', {
      position: canonical,
      error: details.message ?? String(error),
      games: totalGames(explorer),
    }, 'error');
  }
}

export function loadExplorerReading(
  key: string,
  { force = false, signal, priority = 'foreground' }: LoadOptions = {},
): Promise<ParsedExplorerReading> {
  const canonical = canonicalPosition(key);
  const facet = force ? 'explorer:force' : 'explorer';
  return repository.load(
    canonical,
    facet,
    async ({ signal: requestSignal, priority: requestPriority }): Promise<ParsedExplorerReading> => {
      const cached = await repository.get(canonical);
      const cachedExplorer = cachedExplorerReading(cached);
      const fresh = Boolean(
        cachedExplorer
        && Date.now() - (cached?.explorerFetchedAt ?? 0) < EXPLORER_TTL_MS,
      );
      if (!force && fresh && cachedExplorer) {
        debugLog('Explorer Reading cache hit', {
          position: canonical,
          games: totalGames(cachedExplorer),
        });
        return cachedExplorer;
      }

      let explorer: ParsedExplorerReading;
      try {
        const url = explorerUrl(canonical);
        debugLog('explorer request queued', { position: canonical, url: url.toString(), authenticated: true });

        const response = await lichessSession.authorizedRequest(url, {
          signal: requestSignal,
          priority: requestPriority,
          headers: { Accept: 'application/json' },
        });

        debugLog('explorer response', { position: canonical, status: response.status, ok: response.ok });
        if (!response.ok) {
          let body = '';
          try { body = (await response.text()).slice(0, 500); } catch {}
          debugLog('explorer HTTP error', { position: canonical, status: response.status, body }, 'error');
          if (response.status === 401) {
            throw httpError(401, 'Lichess authorization expired. Reload to sign in again.');
          }
          if (response.status === 429) {
            const retryAfterMs = Math.max(0, lichessGateway.cooldownUntil - Date.now());
            debugLog('explorer cooldown started', { retryAfterMs }, 'warn');
            throw httpError(429, 'Lichess explorer is rate-limited. Requests are paused for one minute.');
          }
          throw httpError(response.status, `Lichess explorer returned ${response.status}`);
        }

        explorer = parseExplorerReading(await response.json());
      } catch (error: unknown) {
        return recoverExplorerRefresh(error, canonical, cachedExplorer, requestSignal);
      }

      await persistExplorerReading(canonical, explorer, cached);
      return explorer;
    },
    { signal, priority },
  );
}
