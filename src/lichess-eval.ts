import {
  LICHESS_EVAL_MIN_DEPTH,
  LICHESS_EVAL_TTL_MS,
} from './config.ts';
import { canonicalPosition, toPlayableFen } from './graph.ts';
import { lichessGateway } from './lichess-gateway.ts';
import type { LichessRequestPriority } from './lichess-gateway.ts';
import { isObsoleteWork } from './obsolete-work.ts';
import { positionRepository } from './position-repository.ts';

export {
  LICHESS_EVAL_MIN_DEPTH,
  LICHESS_EVAL_TTL_MS,
} from './config.ts';

const ENDPOINT = 'https://lichess.org/api/cloud-eval';

type LichessEvalError = Error & {
  status?: number;
  kind?: string;
};
type LichessEvalStatus = Readonly<{
  activity: 'idle' | 'requesting';
  pending: number;
  issue: any;
}>;

function httpError(status: number, message: string): LichessEvalError {
  const error = new Error(message) as LichessEvalError;
  error.status = status;
  return error;
}

function typedError(kind: string, message: string, cause: unknown = null): LichessEvalError {
  const error = new Error(message) as LichessEvalError;
  error.kind = kind;
  if (cause != null) error.cause = cause;
  return error;
}

function validPayload(value: any) {
  return Boolean(value)
    && Number.isFinite(value.depth)
    && Array.isArray(value.pvs);
}

export function isUsableLichessEval(value: any) {
  if (!validPayload(value) || value.depth < LICHESS_EVAL_MIN_DEPTH) return false;
  const best = value.pvs[0];
  return Boolean(best) && (Number.isFinite(best.cp) || Number.isFinite(best.mate));
}

function issueFor(error: any, position: string, fallback: 'cached' | null = null) {
  const status = Number.isFinite(error?.status) ? error.status : null;
  let kind = error?.kind ?? 'network';
  if (kind === 'network' && status === 429) kind = 'rate-limited';
  else if (kind === 'network' && status != null) kind = 'service';
  if (fallback === 'cached' && ['network', 'service', 'rate-limited'].includes(kind)) kind = 'refresh-failed';
  return Object.freeze({
    kind,
    position,
    status,
    fallback,
    message: error?.message ?? String(error),
  });
}

export function createLichessEval({
  repository = positionRepository,
  gateway = lichessGateway,
  now = () => Date.now(),
} = {}) {
  const listeners = new Set<(status: LichessEvalStatus) => void>();
  let pending = 0;
  let issue: any = null;
  let status: LichessEvalStatus = Object.freeze({ activity: 'idle', pending: 0, issue: null });

  function publish() {
    status = Object.freeze({
      activity: pending > 0 ? 'requesting' : 'idle',
      pending,
      issue,
    });
    for (const listener of listeners) listener(status);
  }

  function beginRequest() {
    pending += 1;
    publish();
  }

  function finishRequest(nextIssue: any = null) {
    pending = Math.max(0, pending - 1);
    issue = nextIssue;
    publish();
  }

  function admit(key: string, value: any, { fetchedAt = 0, persisted = true }: any = {}) {
    if (isUsableLichessEval(value)) {
      repository.admitFacet(key, 'cloud-eval', value, { fetchedAt, persisted });
    }
    return value;
  }

  function markPersisted(key: string, value: any, fetchedAt: number) {
    const admitted = repository.currentFacet(key, 'cloud-eval');
    if (!admitted || admitted.value !== value || admitted.fetchedAt !== fetchedAt) return;
    repository.admitFacet(key, 'cloud-eval', value, { fetchedAt, persisted: true });
  }

  async function persist(key: string, fields: Record<string, any>) {
    try {
      await repository.merge(key, fields);
      return null;
    } catch (error) {
      return issueFor(typedError('storage', 'Could not persist Lichess cloud evaluation', error), key);
    }
  }

  async function available(position: string) {
    const key = canonicalPosition(position);
    const admitted = repository.currentFacet(key, 'cloud-eval')?.value ?? null;
    if (admitted) return admitted;
    const record = await repository.get(key);
    const cached = isUsableLichessEval(record?.cloudEval) ? record.cloudEval : null;
    if (cached) admit(key, cached, { fetchedAt: record?.cloudEvalFetchedAt ?? 0, persisted: true });
    return cached;
  }

  function get(
    position: string,
    { signal, priority = 'foreground' }: { signal?: AbortSignal; priority?: LichessRequestPriority } = {},
  ) {
    const key = canonicalPosition(position);
    return repository.load(key, 'cloud-eval', async ({ signal: requestSignal, priority: requestPriority }: any) => {
      const cached = await repository.get(key);
      const cachedValue = isUsableLichessEval(cached?.cloudEval) ? cached.cloudEval : null;
      const cachedFetchedAt = cached?.cloudEvalFetchedAt ?? 0;
      const fresh = cachedFetchedAt
        && now() - cachedFetchedAt < LICHESS_EVAL_TTL_MS;
      if (fresh) return admit(key, cachedValue, { fetchedAt: cachedFetchedAt, persisted: true });

      const live = repository.currentFacet(key, 'cloud-eval');
      if (live && !live.persisted && now() - live.fetchedAt < LICHESS_EVAL_TTL_MS) return live.value;

      const url = new URL(ENDPOINT);
      url.searchParams.set('fen', toPlayableFen(key));
      url.searchParams.set('variant', 'standard');
      url.searchParams.set('multiPv', '5');

      beginRequest();

      let response;
      try {
        response = await gateway.request(url, {
          signal: requestSignal,
          priority: requestPriority,
          headers: { Accept: 'application/json' },
        });
      } catch (error) {
        if (isObsoleteWork(error, requestSignal)) {
          finishRequest();
          throw error;
        }
        const fallback = cachedValue ? 'cached' : null;
        if (cachedValue) admit(key, cachedValue, { fetchedAt: cachedFetchedAt, persisted: true });
        finishRequest(issueFor(error, key, fallback));
        return cachedValue;
      }

      if (response.status === 404) {
        repository.invalidateFacet('cloud-eval', [key]);
        const fetchedAt = now();
        const storageIssue = await persist(key, { cloudEval: null, cloudEvalFetchedAt: fetchedAt });
        finishRequest(storageIssue);
        return null;
      }
      if (!response.ok) {
        const error = httpError(response.status, `Lichess cloud eval returned ${response.status}`);
        const fallback = cachedValue ? 'cached' : null;
        if (cachedValue) admit(key, cachedValue, { fetchedAt: cachedFetchedAt, persisted: true });
        finishRequest(issueFor(error, key, fallback));
        return cachedValue;
      }

      let value;
      try {
        value = await response.json();
      } catch (error) {
        const invalid = typedError('invalid-data', 'Lichess cloud eval response could not be parsed', error);
        if (cachedValue) admit(key, cachedValue, { fetchedAt: cachedFetchedAt, persisted: true });
        finishRequest(issueFor(invalid, key, cachedValue ? 'cached' : null));
        return cachedValue;
      }

      if (!validPayload(value)) {
        const error = typedError('invalid-data', 'Lichess cloud eval returned invalid data');
        if (cachedValue) admit(key, cachedValue, { fetchedAt: cachedFetchedAt, persisted: true });
        finishRequest(issueFor(error, key, cachedValue ? 'cached' : null));
        return cachedValue;
      }

      if (!isUsableLichessEval(value)) {
        if (!cachedValue) {
          repository.invalidateFacet('cloud-eval', [key]);
          await persist(key, { cloudEval: value, cloudEvalFetchedAt: now() });
        } else {
          admit(key, cachedValue, { fetchedAt: cachedFetchedAt, persisted: true });
        }
        const error = typedError(
          'insufficient-data',
          `Lichess cloud eval depth ${value.depth} is below ${LICHESS_EVAL_MIN_DEPTH}`,
        );
        finishRequest(issueFor(error, key, cachedValue ? 'cached' : null));
        return cachedValue;
      }

      const fetchedAt = now();
      admit(key, value, { fetchedAt, persisted: false });
      const storageIssue = await persist(key, { cloudEval: value, cloudEvalFetchedAt: fetchedAt });
      if (!storageIssue) markPersisted(key, value, fetchedAt);
      finishRequest(storageIssue);
      return value;
    }, { signal, priority });
  }

  function subscribe(listener: (status: LichessEvalStatus) => void) {
    if (typeof listener !== 'function') throw new TypeError('LichessEval listener must be a function');
    listeners.add(listener);
    listener(status);
    return () => listeners.delete(listener);
  }

  return Object.freeze({
    available,
    get,
    subscribe,
    get status() { return status; },
  });
}

export const lichessEval = createLichessEval();
