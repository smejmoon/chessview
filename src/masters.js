import { canonicalPosition, toPlayableFen } from './graph.js';
import { lichessGateway } from './lichess-gateway.js';
import { positionRepository } from './position-repository.js';

export const MASTERS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const MASTERS_ENDPOINT = 'https://explorer.lichess.org/masters';

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requestFailure(error) {
  return Object.freeze({
    requestFailed: true,
    status: Number.isFinite(error?.status) ? error.status : null,
    message: error?.message ?? String(error),
  });
}

export function isMastersRequestFailure(value) {
  return value?.requestFailed === true;
}

function staleOrFailure(error, cachedValue) {
  if (error?.name === 'AbortError') throw error;
  if (cachedValue != null) return cachedValue;
  return requestFailure(error);
}

export function loadMasters(positionKey, { signal, priority = 'foreground' } = {}) {
  const key = canonicalPosition(positionKey);
  return positionRepository.load(key, 'masters', async ({ signal: requestSignal, priority: requestPriority }) => {
    const cached = await positionRepository.get(key);
    if (cached?.mastersFetchedAt && Date.now() - cached.mastersFetchedAt < MASTERS_TTL_MS) {
      return cached.mastersExplorer ?? null;
    }

    const url = new URL(MASTERS_ENDPOINT);
    url.searchParams.set('fen', toPlayableFen(key));
    url.searchParams.set('moves', '30');
    url.searchParams.set('topGames', '0');

    try {
      const response = await lichessGateway.request(url, {
        signal: requestSignal,
        priority: requestPriority,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw httpError(response.status, `Lichess masters explorer returned ${response.status}`);
      const value = await response.json();
      await positionRepository.merge(key, { mastersExplorer: value, mastersFetchedAt: Date.now() });
      return value;
    } catch (error) {
      return staleOrFailure(error, cached?.mastersExplorer);
    }
  }, { signal, priority });
}
