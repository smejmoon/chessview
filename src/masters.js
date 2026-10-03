import { MASTERS_TTL_MS } from './config.ts';
import { canonicalPosition, toPlayableFen, totalGames } from './graph.js';
import { debugLog } from './debug.js';
import { lichessSession } from './lichess-session.js';
import { isObsoleteWork } from './obsolete-work.js';
import { positionRepository } from './position-repository.js';

export { MASTERS_TTL_MS } from './config.ts';

const MASTERS_ENDPOINT = 'https://explorer.lichess.org/masters';
const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

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

function staleOrAbsent(error, cachedValue, signal, key) {
  if (isObsoleteWork(error, signal)) throw error;
  debugLog('Masters refresh failed', {
    position: key,
    error: error?.message ?? String(error),
    fallback: cachedValue ? 'cached' : null,
  }, 'warn');
  return cachedValue;
}

async function persistMastersReading(key, value) {
  try {
    await positionRepository.merge(key, { mastersExplorer: value, mastersFetchedAt: Date.now() });
  } catch (error) {
    debugLog('Masters Reading persistence failed', {
      position: key,
      error: error?.message ?? String(error),
    }, 'error');
  }
}

export function loadMasters(positionKey, { signal, priority = 'foreground' } = {}) {
  const key = canonicalPosition(positionKey);
  return positionRepository.load(key, 'masters', async ({ signal: requestSignal, priority: requestPriority }) => {
    const cached = await positionRepository.get(key);
    const cachedValue = cachedMastersReading(cached);
    if (cachedValue && cached?.mastersFetchedAt && Date.now() - cached.mastersFetchedAt < MASTERS_TTL_MS) {
      return cachedValue;
    }

    const url = new URL(MASTERS_ENDPOINT);
    url.searchParams.set('fen', toPlayableFen(key));
    url.searchParams.set('moves', '30');
    url.searchParams.set('topGames', '0');

    let value;
    try {
      const response = await lichessSession.authorizedRequest(url, {
        signal: requestSignal,
        priority: requestPriority,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw httpError(response.status, `Lichess masters explorer returned ${response.status}`);
      value = parseMastersReading(await response.json());
    } catch (error) {
      return staleOrAbsent(error, cachedValue, requestSignal, key);
    }

    await persistMastersReading(key, value);
    return value;
  }, { signal, priority });
}
