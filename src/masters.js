import { MASTERS_TTL_MS } from './config.ts';
import { canonicalPosition, toPlayableFen, totalGames } from './graph.js';
import { debugLog } from './debug.js';
import { lichessSession } from './lichess-session.js';
import { isObsoleteWork } from './obsolete-work.js';
import { positionRepository } from './position-repository.js';

export { MASTERS_TTL_MS } from './config.ts';

const MASTERS_ENDPOINT = 'https://explorer.lichess.org/masters';
const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** @typedef {'foreground' | 'background'} LoadPriority */
/** @typedef {LoadPriority | (() => LoadPriority)} Priority */

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function invalidDataError() {
  const error = new Error('Lichess masters explorer returned invalid data');
  error.kind = 'invalid-data';
  return error;
}

function validCount(value) {
  return Number.isInteger(value) && value >= 0;
}

function asRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function validMove(value, sourceGames) {
  const move = asRecord(value);
  if (!move) return false;
  if (typeof move.uci !== 'string' || !UCI_MOVE.test(move.uci)) return false;
  if (![move.white, move.draws, move.black].every(validCount)) return false;
  return move.white + move.draws + move.black <= sourceGames;
}

function parseMastersReading(value) {
  const reading = asRecord(value);
  if (!reading) throw invalidDataError();
  if (![reading.white, reading.draws, reading.black].every(validCount)) throw invalidDataError();
  if (!Array.isArray(reading.moves)) throw invalidDataError();
  const sourceGames = totalGames(reading);
  if (!reading.moves.every((move) => validMove(move, sourceGames))) throw invalidDataError();
  return reading;
}

function cachedMastersReading(record) {
  if (record?.mastersExplorer == null) return null;
  try {
    return parseMastersReading(record.mastersExplorer);
  } catch {
    return null;
  }
}

export function createMastersProvider({
  repository = positionRepository,
  request = (url, options) => lichessSession.authorizedRequest(url, options),
  now = () => Date.now(),
  log = debugLog,
} = {}) {
  function report(message, detail, level = 'info') {
    Reflect.apply(log, undefined, [message, detail, level]);
  }

  function admit(key, value, { fetchedAt = 0, persisted = true } = {}) {
    if (!value) return value;
    repository.admitFacet(key, 'masters', value, { fetchedAt, persisted });
    return value;
  }

  function markPersisted(key, value, fetchedAt) {
    const admitted = repository.currentFacet(key, 'masters');
    if (!admitted || admitted.value !== value || admitted.fetchedAt !== fetchedAt) return;
    repository.admitFacet(key, 'masters', value, { fetchedAt, persisted: true });
  }

  function current(positionKey) {
    return repository.currentFacet(canonicalPosition(positionKey), 'masters')?.value ?? null;
  }

  async function readCached(positionKey) {
    const key = canonicalPosition(positionKey);
    return cachedMastersReading(await repository.get(key));
  }

  async function available(positionKey) {
    return current(positionKey) ?? await readCached(positionKey);
  }

  function staleOrAbsent(error, cachedValue, cachedFetchedAt, signal, key) {
    if (isObsoleteWork(error, signal)) throw error;
    report('Masters refresh failed', {
      position: key,
      error: error?.message ?? String(error),
      fallback: cachedValue ? 'cached' : null,
    }, 'warn');
    return admit(key, cachedValue, { fetchedAt: cachedFetchedAt, persisted: true });
  }

  async function persistMastersReading(key, value, fetchedAt) {
    try {
      await repository.merge(key, { mastersExplorer: value, mastersFetchedAt: fetchedAt });
      return true;
    } catch (error) {
      report('Masters Reading persistence failed', {
        position: key,
        error: error?.message ?? String(error),
      }, 'error');
      return false;
    }
  }

  /**
   * @param {string} positionKey
   * @param {{ signal?: AbortSignal, priority?: Priority }} [options]
   */
  function load(positionKey, { signal, priority = 'foreground' } = {}) {
    const key = canonicalPosition(positionKey);
    return repository.load(key, 'masters', async ({ signal: requestSignal, priority: requestPriority }) => {
      const cached = await repository.get(key);
      const cachedValue = cachedMastersReading(cached);
      const cachedFetchedAt = cached?.mastersFetchedAt ?? 0;
      if (cachedValue && cachedFetchedAt && now() - cachedFetchedAt < MASTERS_TTL_MS) {
        return admit(key, cachedValue, { fetchedAt: cachedFetchedAt, persisted: true });
      }

      const live = repository.currentFacet(key, 'masters');
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
        if (!response.ok) throw httpError(response.status, `Lichess masters explorer returned ${response.status}`);
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
