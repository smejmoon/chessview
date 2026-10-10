import { MASTERS_TTL_MS } from './config.ts';
import { canonicalPosition, toPlayableFen, totalGames } from './graph.ts';
import { debugLog } from './debug.ts';
import { lichessSession } from './lichess-session.ts';
import type { LichessRequestPriority } from './lichess-gateway.ts';
import { isObsoleteWork } from './obsolete-work.ts';
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
  try {
    return parseMastersReading(record.mastersExplorer);
  } catch {
    return null;
  }
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

  function admit(key: string, value: any, { fetchedAt = 0, persisted = true }: any = {}) {
    if (!value) return value;
    repository.admitSourceChannel(key, 'masters', value, { fetchedAt, persisted });
    return value;
  }

  function markPersisted(key: string, value: any, fetchedAt: number) {
    const admitted = repository.currentSourceChannel(key, 'masters');
    if (!admitted || admitted.value !== value || admitted.fetchedAt !== fetchedAt) return;
    repository.admitSourceChannel(key, 'masters', value, { fetchedAt, persisted: true });
  }

  function current(positionKey: string) {
    return repository.currentSourceChannel(canonicalPosition(positionKey), 'masters')?.value ?? null;
  }

  async function readCached(positionKey: string) {
    const key = canonicalPosition(positionKey);
    return cachedMastersReading(await repository.get(key));
  }

  async function available(positionKey: string) {
    return current(positionKey) ?? await readCached(positionKey);
  }

  function staleOrAbsent(error: unknown, cachedValue: any, cachedFetchedAt: number, signal: AbortSignal, key: string) {
    if (isObsoleteWork(error, signal)) throw error;
    report('Masters refresh failed', {
      position: key,
      error: error instanceof Error ? error.message : String(error),
      fallback: cachedValue ? 'cached' : null,
    }, 'warn');
    return admit(key, cachedValue, { fetchedAt: cachedFetchedAt, persisted: true });
  }

  async function persistMastersReading(key: string, value: any, fetchedAt: number) {
    try {
      await repository.merge(key, { mastersExplorer: value, mastersFetchedAt: fetchedAt });
      return true;
    } catch (error) {
      report('Masters Reading persistence failed', {
        position: key,
        error: error instanceof Error ? error.message : String(error),
      }, 'error');
      return false;
    }
  }

  function load(
    positionKey: string,
    { signal, priority = 'foreground' }: { signal?: AbortSignal; priority?: LichessRequestPriority } = {},
  ) {
    const key = canonicalPosition(positionKey);
    return repository.load(key, 'masters', async ({ signal: requestSignal, priority: requestPriority }: any) => {
      const cached = await repository.get(key);
      const cachedValue = cachedMastersReading(cached);
      const cachedFetchedAt = cached?.mastersFetchedAt ?? 0;
      if (cachedValue && cachedFetchedAt && now() - cachedFetchedAt < MASTERS_TTL_MS) {
        return admit(key, cachedValue, { fetchedAt: cachedFetchedAt, persisted: true });
      }

      const live = repository.currentSourceChannel(key, 'masters');
      if (live && !live.persisted && now() - live.fetchedAt < MASTERS_TTL_MS) return live.value;

      const url = new URL(MASTERS_ENDPOINT);
      url.searchParams.set('fen', toPlayableFen(key));
      url.searchParams.set('moves', '30');
      url.searchParams.set('topGames', '0');

      let value;
      try {
        const response = await request(url, {
          signal: requestSignal,
          priority: requestPriority,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`Lichess masters explorer returned ${response.status}`);
        value = parseMastersReading(await response.json());
      } catch (error) {
        return staleOrAbsent(error, cachedValue, cachedFetchedAt, requestSignal, key);
      }

      const fetchedAt = now();
      admit(key, value, { fetchedAt, persisted: false });
      if (await persistMastersReading(key, value, fetchedAt)) markPersisted(key, value, fetchedAt);
      return value;
    }, { signal, priority });
  }

  return Object.freeze({ load, current, readCached, available });
}

export const mastersProvider = createMastersProvider();
export const loadMasters = mastersProvider.load;
export const currentMastersReading = mastersProvider.current;
export const readCachedMastersReading = mastersProvider.readCached;
export const availableMastersReading = mastersProvider.available;
