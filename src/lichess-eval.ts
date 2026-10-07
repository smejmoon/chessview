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

type LichessEvalIssueKind =
  | 'network'
  | 'service'
  | 'rate-limited'
  | 'refresh-failed'
  | 'invalid-data'
  | 'insufficient-data'
  | 'storage';

type LichessEvalIssue = Readonly<{
  kind: LichessEvalIssueKind;
  position: string;
  status: number | null;
  fallback: 'cached' | null;
  message: string;
}>;

type LichessEvalStatus = Readonly<{
  activity: 'idle' | 'requesting';
  pending: number;
  issue: LichessEvalIssue | null;
}>;

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

function evalIssue(
  kind: LichessEvalIssueKind,
  position: string,
  {
    status = null,
    fallback = null,
    message,
  }: {
    status?: number | null;
    fallback?: 'cached' | null;
    message: string;
  },
): LichessEvalIssue {
  return Object.freeze({ kind, position, status, fallback, message });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createLichessEval({
  repository = positionRepository,
  gateway = lichessGateway,
  now = () => Date.now(),
} = {}) {
  const listeners = new Set<(status: LichessEvalStatus) => void>();
  let pending = 0;
  let issue: LichessEvalIssue | null = null;
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

  function finishRequest(nextIssue: LichessEvalIssue | null = null) {
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
    } catch {
      return evalIssue('storage', key, {
        message: 'Could not persist Lichess cloud evaluation',
      });
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
        finishRequest(evalIssue(fallback ? 'refresh-failed' : 'network', key, {
          fallback,
          message: errorMessage(error),
        }));
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
        const fallback = cachedValue ? 'cached' : null;
        if (cachedValue) admit(key, cachedValue, { fetchedAt: cachedFetchedAt, persisted: true });
        finishRequest(evalIssue(
          fallback ? 'refresh-failed' : response.status === 429 ? 'rate-limited' : 'service',
          key,
          {
            status: response.status,
            fallback,
            message: `Lichess cloud eval returned ${response.status}`,
          },
        ));
        return cachedValue;
      }

      let value;
      try {
        value = await response.json();
      } catch {
        if (cachedValue) admit(key, cachedValue, { fetchedAt: cachedFetchedAt, persisted: true });
        finishRequest(evalIssue('invalid-data', key, {
          fallback: cachedValue ? 'cached' : null,
          message: 'Lichess cloud eval response could not be parsed',
        }));
        return cachedValue;
      }

      if (!validPayload(value)) {
        if (cachedValue) admit(key, cachedValue, { fetchedAt: cachedFetchedAt, persisted: true });
        finishRequest(evalIssue('invalid-data', key, {
          fallback: cachedValue ? 'cached' : null,
          message: 'Lichess cloud eval returned invalid data',
        }));
        return cachedValue;
      }

      if (!isUsableLichessEval(value)) {
        if (!cachedValue) {
          repository.invalidateFacet('cloud-eval', [key]);
          await persist(key, { cloudEval: value, cloudEvalFetchedAt: now() });
        } else {
          admit(key, cachedValue, { fetchedAt: cachedFetchedAt, persisted: true });
        }
        finishRequest(evalIssue('insufficient-data', key, {
          fallback: cachedValue ? 'cached' : null,
          message: `Lichess cloud eval depth ${value.depth} is below ${LICHESS_EVAL_MIN_DEPTH}`,
        }));
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
