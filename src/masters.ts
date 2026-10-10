import { MASTERS_TTL_MS } from './config.ts';
import { canonicalPosition, toPlayableFen, totalGames } from './graph.ts';
import { debugLog } from './debug.ts';
import { lichessSession } from './lichess-session.ts';
import type { LichessRequestPriority } from './lichess-gateway.ts';
import { positionRepository } from './position-repository.ts';

export { MASTERS_TTL_MS } from './config.ts';

const MASTERS_ENDPOINT = 'https://explorer.lichess.org/masters';
const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

function invalidDataError(): Error {
  return new Error('Lichess masters explorer returned invalid data');
}

function validCount(value: any) {
  return Number.isInteger(value) && value >= 0;
}

function asRecord(value: any) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function validMove(value: any, sourceGames: number) {
  const move = asRecord(value);
  if (!move) return false;
  if (typeof move.uci !== 'string' || !UCI_MOVE.test(move.uci)) return false;
  if (![move.white, move.draws, move.black].every(validCount)) return false;
  return move.white + move.draws + move.black <= sourceGames;
}

function parseMastersReading(value: any) {
  const reading = asRecord(value);
  if (!reading) throw invalidDataError();
  if (![reading.white, reading.draws, reading.black].every(validCount)) throw invalidDataError();
  if (!Array.isArray(reading.moves)) throw invalidDataError();
  const sourceGames = totalGames(reading);
  if (!reading.moves.every((move: any) => validMove(move, sourceGames))) throw invalidDataError();
  return reading;
}

function cachedMastersReading(record: any) {
  if (record?.mastersExplorer == null) return null;
  return {
    value: parseMastersReading(record.mastersExplorer),
    fetchedAt: record.mastersFetchedAt ?? 0,
  };
}

export function createMastersProvider({
  repository = positionRepository,
  request = (url: URL, options: any) => lichessSession.authorizedRequest(url, options),
  now = () => Date.now(),
  log = debugLog,
} = {}) {
  function report(message: string, detail: unknown, level: any = 'info') {
    Reflect.apply(log, undefined, [message, detail, level]);
  }

  function current(positionKey: string) {
    return repository.currentFacet(canonicalPosition(positionKey), 'masters')?.value ?? null;
  }

  async function readCached(positionKey: string) {
    return (await repository.peek(positionKey, 'masters', cachedMastersReading))?.value ?? null;
  }

  async function available(positionKey: string) {
    return current(positionKey) ?? await readCached(positionKey);
  }

  function load(
    positionKey: string,
    { signal, priority = 'foreground' }: { signal?: AbortSignal; priority?: LichessRequestPriority } = {},
  ) {
    const key = canonicalPosition(positionKey);
    return repository.observe(key, 'masters', {
      decode: cachedMastersReading,
      refreshAfterMs: MASTERS_TTL_MS,
      now,
      fallbackOnError: 'null',
      acquire: async ({ signal: requestSignal, priority: requestPriority }: any) => {
        const url = new URL(MASTERS_ENDPOINT);
        url.searchParams.set('fen', toPlayableFen(key));
        url.searchParams.set('moves', '30');
        url.searchParams.set('topGames', '0');

        const response = await request(url, {
          signal: requestSignal,
          priority: requestPriority,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`Lichess masters explorer returned ${response.status}`);
        return { value: parseMastersReading(await response.json()) };
      },
      fields: (result: any, { fetchedAt }: any) => ({
        mastersExplorer: result.value,
        mastersFetchedAt: fetchedAt,
      }),
      onError: (error: unknown, { cached, obsolete }: any) => {
        if (obsolete) return;
        report('Masters refresh failed', {
          position: key,
          error: error instanceof Error ? error.message : String(error),
          fallback: cached?.value ? 'cached' : null,
        }, 'warn');
      },
      onStorageError: (error: unknown) => {
        report('Masters Reading persistence failed', {
          position: key,
          error: error instanceof Error ? error.message : String(error),
        }, 'error');
      },
    }, { signal, priority });
  }

  return Object.freeze({ load, current, readCached, available });
}

export const mastersProvider = createMastersProvider();
export const loadMasters = mastersProvider.load;
export const currentMastersReading = mastersProvider.current;
export const readCachedMastersReading = mastersProvider.readCached;
export const availableMastersReading = mastersProvider.available;
