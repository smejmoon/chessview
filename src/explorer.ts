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
import { isObsoleteWork } from './obsolete-work.js';
import { positionRepository } from './position-repository.js';

const ENDPOINT = 'https://explorer.lichess.org/lichess';
const REQUEST_PARAMETERS = Object.freeze({
  variant: 'standard',
  moves: '30',
  topGames: '4',
  recentGames: '8',
});
const REQUEST_PROFILE = JSON.stringify(REQUEST_PARAMETERS);
const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

type LoadPriority = 'foreground' | 'background';
type Priority = LoadPriority | (() => LoadPriority);
type LoadOptions = Readonly<{
  signal?: AbortSignal;
  priority?: Priority;
}>;

type ParsedExplorerMove = ExplorerMove & Readonly<{
  white: number;
  draws: number;
  black: number;
}>;

type ExplorerGame = Readonly<{ id: string; [field: string]: unknown }>;
type ParsedExplorerReading = ExplorerReading & Readonly<{
  white: number;
  draws: number;
  black: number;
  moves: readonly ParsedExplorerMove[];
  topGames?: readonly ExplorerGame[];
  recentGames?: readonly ExplorerGame[];
}>;

type PositionRecord = Readonly<{
  explorer?: unknown;
  explorerFetchedAt?: number;
  explorerRequestProfile?: unknown;
  [field: string]: unknown;
}>;

type ProducerContext = Readonly<{
  signal: AbortSignal;
  priority: () => LoadPriority;
}>;

type ExplorerFacet = Readonly<{
  value: ParsedExplorerReading;
  fetchedAt: number;
  persisted: boolean;
}>;

type ExplorerRepository = Readonly<{
  get(position: string): Promise<PositionRecord | null>;
  merge(position: string, fields: Readonly<Record<string, unknown>>): Promise<unknown>;
  currentFacet(position: string, facet: string): ExplorerFacet | null;
  admitFacet(
    position: string,
    facet: string,
    value: ParsedExplorerReading,
    metadata: Readonly<{ fetchedAt: number; persisted: boolean }>,
  ): ExplorerFacet;
  invalidateFacet(facet: string, positions?: readonly string[]): void;
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

export type ExplorerProviderOptions = Readonly<{
  repository?: ExplorerRepository;
  request?: ExplorerRequest;
  now?: () => number;
  log?: Log;
}>;

function explorerUrl(key: string): URL {
  const url = new URL(ENDPOINT);
  for (const [name, value] of Object.entries(REQUEST_PARAMETERS)) url.searchParams.set(name, value);
  url.searchParams.set('fen', toPlayableFen(key));
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

function validExplorerGames(value: unknown): boolean {
  if (value == null) return true;
  return Array.isArray(value) && value.every((game) => {
    const item = asRecord(game);
    return Boolean(item && typeof item.id === 'string' && /^[A-Za-z0-9]{8}$/.test(item.id));
  });
}

function parseExplorerReading(value: unknown): ParsedExplorerReading {
  const reading = asRecord(value);
  if (!reading) throw invalidDataError();
  if (![reading.white, reading.draws, reading.black].every(validCount)) throw invalidDataError();
  if (!Array.isArray(reading.moves)) throw invalidDataError();
  if (!validExplorerGames(reading.topGames) || !validExplorerGames(reading.recentGames)) throw invalidDataError();

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
  now = () => Date.now(),
  log = debugLog,
}: ExplorerProviderOptions = {}) {
  function report(message: string, detail?: unknown, level: DebugLevel = 'info'): void {
    Reflect.apply(log, undefined, [message, detail, level]);
  }

  function admit(
    canonical: string,
    reading: ParsedExplorerReading,
    fetchedAt: number,
    persisted = true,
  ): ParsedExplorerReading {
    const existing = repository.currentFacet(canonical, 'explorer');
    if (existing?.fetchedAt === fetchedAt && existing.value === reading && existing.persisted === persisted) {
      return existing.value;
    }
    return repository.admitFacet(canonical, 'explorer', reading, { fetchedAt, persisted }).value;
  }

  function markPersisted(canonical: string, reading: ParsedExplorerReading, fetchedAt: number): void {
    const admitted = repository.currentFacet(canonical, 'explorer');
    if (!admitted || admitted.value !== reading || admitted.fetchedAt !== fetchedAt) return;
    repository.admitFacet(canonical, 'explorer', reading, { fetchedAt, persisted: true });
  }

  function invalidate(keys?: readonly string[]): void {
    repository.invalidateFacet('explorer', keys);
  }

  async function readCached(key: string): Promise<ParsedExplorerReading | null> {
    const canonical = canonicalPosition(key);
    return cachedExplorerReading(await repository.get(canonical));
  }

  function current(key: string): ParsedExplorerReading | null {
    return repository.currentFacet(canonicalPosition(key), 'explorer')?.value ?? null;
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
    fetchedAt: number,
  ): Promise<boolean> {
    try {
      await repository.merge(canonical, {
        explorer,
        explorerFetchedAt: fetchedAt,
        explorerRequestProfile: REQUEST_PROFILE,
        games: totalGames(explorer),
      });
      report('Explorer Reading stored', { position: canonical, games: totalGames(explorer) });
      return true;
    } catch (error: unknown) {
      const details = errorLike(error);
      report('Explorer Reading persistence failed', {
        position: canonical,
        error: details.message ?? String(error),
        games: totalGames(explorer),
      }, 'error');
      return false;
    }
  }

  function ensure(
    key: string,
    { signal, priority = 'foreground' }: LoadOptions = {},
  ): Promise<ParsedExplorerReading> {
    const canonical = canonicalPosition(key);
    return repository.load(
      canonical,
      'explorer',
      async ({ signal: requestSignal, priority: requestPriority }): Promise<ParsedExplorerReading> => {
        const cached = await repository.get(canonical);
        const cachedExplorer = cachedExplorerReading(cached);
        const cachedFetchedAt = cached?.explorerFetchedAt ?? 0;
        const freshCached = Boolean(
          cachedExplorer
          && cached?.explorerRequestProfile === REQUEST_PROFILE
          && now() - cachedFetchedAt < EXPLORER_TTL_MS,
        );
        if (freshCached && cachedExplorer) {
          report('Explorer Reading cache hit', {
            position: canonical,
            games: totalGames(cachedExplorer),
          });
          return admit(canonical, cachedExplorer, cachedFetchedAt);
        }

        const admitted = repository.currentFacet(canonical, 'explorer');
        if (
          admitted
          && !admitted.persisted
          && now() - admitted.fetchedAt < EXPLORER_TTL_MS
        ) {
          report('Explorer Reading live hit', {
            position: canonical,
            games: totalGames(admitted.value),
          });
          return admitted.value;
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
              report('explorer rate limited', { position: canonical }, 'warn');
              throw httpError(429, 'Lichess explorer is rate-limited. Requests are paused for one minute.');
            }
            throw httpError(response.status, `Lichess explorer returned ${response.status}`);
          }

          explorer = parseExplorerReading(await response.json());
        } catch (error: unknown) {
          return recoverRefresh(error, canonical, cachedExplorer, cachedFetchedAt, requestSignal);
        }

        const fetchedAt = now();
        const usable = admit(canonical, explorer, fetchedAt, false);
        if (await persist(canonical, usable, fetchedAt)) {
          markPersisted(canonical, usable, fetchedAt);
        }
        return usable;
      },
      { signal, priority },
    );
  }

  return Object.freeze({ ensure, current, readCached, invalidate });
}

export const explorerProvider = createExplorerProvider();
export const loadExplorerReading = explorerProvider.ensure;
export const currentExplorerReading = explorerProvider.current;
export const readCachedExplorerReading = explorerProvider.readCached;
