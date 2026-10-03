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

type ExplorerResponse = Readonly<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

type ExplorerRequest = (
  url: URL,
  options: Readonly<{
    signal: AbortSignal;
    priority: () => LoadPriority;
    headers: Readonly<Record<string, string>>;
  }>,
) => Promise<ExplorerResponse>;

type ErrorLike = Readonly<{
  name?: string;
  message?: string;
}>;

type DebugLevel = 'info' | 'warn' | 'error';
type Log = (message: string, detail?: unknown, level?: DebugLevel) => void;

export type ExplorerObservation = Readonly<{
  position: string;
  reading: ParsedExplorerReading;
}>;

export type ExplorerObservationListener = (observation: ExplorerObservation) => void;

export type ExplorerProviderOptions = Readonly<{
  repository?: ExplorerRepository;
  request?: ExplorerRequest;
  cooldownUntil?: () => number;
  now?: () => number;
  log?: Log;
}>;

type AdmittedExplorer = Readonly<{
  reading: ParsedExplorerReading;
  fetchedAt: number;
}>;

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

function errorLike(error: unknown): ErrorLike {
  return error && typeof error === 'object' ? error as ErrorLike : {};
}

export function createExplorerProvider({
  repository = positionRepository as unknown as ExplorerRepository,
  request = (url, options) => lichessSession.authorizedRequest(url, options) as Promise<ExplorerResponse>,
  cooldownUntil = () => lichessGateway.cooldownUntil,
  now = () => Date.now(),
  log = debugLog,
}: ExplorerProviderOptions = {}) {
  const latest = new Map<string, AdmittedExplorer>();
  const listeners = new Set<ExplorerObservationListener>();

  function report(message: string, detail?: unknown, level: DebugLevel = 'info'): void {
    Reflect.apply(log, undefined, [message, detail, level]);
  }

  function notify(position: string, reading: ParsedExplorerReading): void {
    const observation = Object.freeze({ position, reading });
    for (const listener of [...listeners]) {
      try {
        listener(observation);
      } catch (error: unknown) {
        report('Explorer observation listener failed', {
          position,
          error: errorLike(error).message ?? String(error),
        }, 'error');
      }
    }
  }

  function admit(
    canonical: string,
    reading: ParsedExplorerReading,
    fetchedAt: number,
    { fresh = false }: Readonly<{ fresh?: boolean }> = {},
  ): ParsedExplorerReading {
    const existing = latest.get(canonical);
    if (!fresh && existing?.fetchedAt === fetchedAt) return existing.reading;
    latest.set(canonical, Object.freeze({ reading, fetchedAt }));
    notify(canonical, reading);
    return reading;
  }

  async function readCached(key: string): Promise<ParsedExplorerReading | null> {
    const canonical = canonicalPosition(key);
    return cachedExplorerReading(await repository.get(canonical));
  }

  function current(key: string): ParsedExplorerReading | null {
    return latest.get(canonicalPosition(key))?.reading ?? null;
  }

  function subscribe(listener: ExplorerObservationListener): () => void {
    if (typeof listener !== 'function') throw new TypeError('Explorer observation listener must be a function');
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }

  function recoverRefresh(
    error: unknown,
    canonical: string,
    cachedExplorer: ParsedExplorerReading | null,
    cachedFetchedAt: number,
    signal: AbortSignal,
  ): ParsedExplorerReading {
    const details = errorLike(error);
    if (isObsoleteWork(error, signal)) throw error;
    if (cachedExplorer) {
      report('Explorer refresh failed; using stale Reading', {
        position: canonical,
        error: details.message ?? String(error),
        games: totalGames(cachedExplorer),
      }, 'warn');
      return admit(canonical, cachedExplorer, cachedFetchedAt);
    }
    report('explorer refresh failed', {
      position: canonical,
      error: details.message ?? String(error),
    }, 'error');
    throw error;
  }

  async function persist(
    canonical: string,
    explorer: ParsedExplorerReading,
    cached: PositionRecord | null,
    fetchedAt: number,
  ): Promise<void> {
    try {
      await repository.merge(canonical, {
        fen: cached?.fen ?? toPlayableFen(canonical),
        opening: explorer.opening ?? cached?.opening ?? null,
        explorer,
        explorerFetchedAt: fetchedAt,
        games: totalGames(explorer),
      });
      report('Explorer Reading stored', { position: canonical, games: totalGames(explorer) });
    } catch (error: unknown) {
      const details = errorLike(error);
      report('Explorer Reading persistence failed', {
        position: canonical,
        error: details.message ?? String(error),
        games: totalGames(explorer),
      }, 'error');
    }
  }

  function ensure(
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
        const cachedFetchedAt = cached?.explorerFetchedAt ?? 0;
        const freshCached = Boolean(
          cachedExplorer
          && now() - cachedFetchedAt < EXPLORER_TTL_MS,
        );
        if (!force && freshCached && cachedExplorer) {
          report('Explorer Reading cache hit', {
            position: canonical,
            games: totalGames(cachedExplorer),
          });
          return admit(canonical, cachedExplorer, cachedFetchedAt);
        }

        const admitted = latest.get(canonical);
        if (!force && admitted && now() - admitted.fetchedAt < EXPLORER_TTL_MS) {
          report('Explorer Reading live hit', {
            position: canonical,
            games: totalGames(admitted.reading),
          });
          return admitted.reading;
        }

        let explorer: ParsedExplorerReading;
        try {
          const url = explorerUrl(canonical);
          report('explorer request queued', { position: canonical, url: url.toString(), authenticated: true });

          const response = await request(url, {
            signal: requestSignal,
            priority: requestPriority,
            headers: { Accept: 'application/json' },
          });

          report('explorer response', { position: canonical, status: response.status, ok: response.ok });
          if (!response.ok) {
            let body = '';
            try { body = (await response.text()).slice(0, 500); } catch {}
            report('explorer HTTP error', { position: canonical, status: response.status, body }, 'error');
            if (response.status === 401) {
              throw httpError(401, 'Lichess authorization expired. Reload to sign in again.');
            }
            if (response.status === 429) {
              const retryAfterMs = Math.max(0, cooldownUntil() - now());
              report('explorer cooldown started', { retryAfterMs }, 'warn');
              throw httpError(429, 'Lichess explorer is rate-limited. Requests are paused for one minute.');
            }
            throw httpError(response.status, `Lichess explorer returned ${response.status}`);
          }

          explorer = parseExplorerReading(await response.json());
        } catch (error: unknown) {
          return recoverRefresh(error, canonical, cachedExplorer, cachedFetchedAt, requestSignal);
        }

        const fetchedAt = now();
        const usable = admit(canonical, explorer, fetchedAt, { fresh: true });
        await persist(canonical, usable, cached, fetchedAt);
        return usable;
      },
      { signal, priority },
    );
  }

  return Object.freeze({ ensure, current, subscribe, readCached });
}

export const explorerProvider = createExplorerProvider();
export const loadExplorerReading = explorerProvider.ensure;
export const currentExplorerReading = explorerProvider.current;
export const subscribeExplorerReadings = explorerProvider.subscribe;
export const readCachedExplorerReading = explorerProvider.readCached;
