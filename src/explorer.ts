import type { WorkDemand, ProducerWork } from './work-demand.ts';
import { EXPLORER_TTL_MS } from './config.ts';
import {
  canonicalPosition,
  toPlayableFen,
  totalGames,
  type ExplorerMove,
  type ExplorerReading,
} from './graph.ts';
import { debugLog } from './debug.ts';
import { lichessSession } from './lichess-session.ts';
import { isObsoleteWork } from './obsolete-work.ts';
import { sourceUnavailable } from './source-unavailable.ts';
import { positionRepository } from './position-repository.ts';

const ENDPOINT = 'https://explorer.lichess.org/lichess';
const REQUEST_PARAMETERS = Object.freeze({
  variant: 'standard',
  moves: '30',
  topGames: '4',
  recentGames: '8',
});
const REQUEST_PROFILE = JSON.stringify(REQUEST_PARAMETERS);
const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

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

type ExplorerRepository = typeof positionRepository;

type ExplorerResponse = Readonly<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

type ExplorerRequest = (url: URL, init: RequestInit, work: ProducerWork) => Promise<ExplorerResponse>;

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

function cachedExplorerReading(record: PositionRecord | null | undefined) {
  if (!record?.explorer || record.explorerRequestProfile !== REQUEST_PROFILE) return null;
  return {
    value: parseExplorerReading(record.explorer),
    fetchedAt: record.explorerFetchedAt ?? 0,
  };
}

export function createExplorerProvider({
  repository = positionRepository as unknown as ExplorerRepository,
  request = (url, init, work) => lichessSession.authorizedRequest(url, init, work) as Promise<ExplorerResponse>,
  now = () => Date.now(),
  log = debugLog,
}: ExplorerProviderOptions = {}) {
  function report(message: string, detail?: unknown, level: DebugLevel = 'info'): void {
    Reflect.apply(log, undefined, [message, detail, level]);
  }

  function invalidate(keys?: readonly string[]): void {
    repository.invalidateFacet('explorer', keys);
  }

  async function readCached(key: string): Promise<ParsedExplorerReading | null> {
    return (await repository.peek(key, 'explorer', cachedExplorerReading, REQUEST_PROFILE))?.value ?? null;
  }

  function current(key: string): ParsedExplorerReading | null {
    return repository.currentFacet(canonicalPosition(key), 'explorer')?.value ?? null;
  }

  async function ensure(
    key: string,
    { signal, urgency = 'foreground' }: WorkDemand = {},
  ): Promise<ParsedExplorerReading> {
    const canonical = canonicalPosition(key);
    try {
      return await repository.observe(canonical, 'explorer', {
      decode: cachedExplorerReading,
      profile: REQUEST_PROFILE,
      refreshAfterMs: EXPLORER_TTL_MS,
      now,
      acquire: async (work: ProducerWork) => {
        const url = explorerUrl(canonical);
        report('explorer request queued', { position: canonical, url: url.toString(), authenticated: true });
        const response = await request(url, { headers: { Accept: 'application/json' } }, work);

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
        return { value: parseExplorerReading(await response.json()) };
      },
      fields: (result: any, { fetchedAt }: any) => ({
        explorer: result.value,
        explorerFetchedAt: fetchedAt,
        explorerRequestProfile: REQUEST_PROFILE,
        games: totalGames(result.value),
      }),
      onError: (error: unknown, { cached, obsolete }: any) => {
        if (obsolete) return;
        report(cached ? 'Explorer refresh failed; using stale Reading' : 'explorer refresh failed', {
          position: canonical,
          error: error instanceof Error ? error.message : String(error),
          ...(cached ? { games: totalGames(cached.value) } : {}),
        }, cached ? 'warn' : 'error');
      },
      onStorageError: (error: unknown) => {
        report('Explorer Reading persistence failed', {
          position: canonical,
          error: error instanceof Error ? error.message : String(error),
        }, 'error');
      },
      onComplete: (result: any, { storageError }: any) => {
        if (!storageError) report('Explorer Reading stored', {
          position: canonical,
          games: totalGames(result.value),
        });
      },
      }, { signal, urgency });
    } catch (error: unknown) {
      if (isObsoleteWork(error)) throw error;
      throw sourceUnavailable('Lichess Explorer Reading unavailable', error);
    }
  }

  return Object.freeze({ ensure, current, readCached, invalidate });
}

export const explorerProvider = createExplorerProvider();
export const loadExplorerReading = explorerProvider.ensure;
export const currentExplorerReading = explorerProvider.current;
export const readCachedExplorerReading = explorerProvider.readCached;
