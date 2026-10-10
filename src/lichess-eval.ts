import {
  LICHESS_EVAL_MIN_DEPTH,
  LICHESS_EVAL_TTL_MS,
} from './config.ts';
import { canonicalPosition, toPlayableFen } from './graph.ts';
import { lichessGateway } from './lichess-gateway.ts';
import type { LichessRequestPriority } from './lichess-gateway.ts';
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

  function decodeCached(record: any) {
    if (!record?.cloudEvalFetchedAt) return null;
    const value = record.cloudEval;
    if (value !== null && !validPayload(value)) return null;
    return {
      value: isUsableLichessEval(value) ? value : null,
      fetchedAt: record.cloudEvalFetchedAt,
      checkedAt: record.cloudEvalCheckedAt ?? record.cloudEvalFetchedAt,
    };
  }

  async function available(position: string) {
    return (await repository.peek(position, 'cloud-eval', decodeCached))?.value ?? null;
  }

  function get(
    position: string,
    { signal, priority = 'foreground' }: { signal?: AbortSignal; priority?: LichessRequestPriority } = {},
  ) {
    const key = canonicalPosition(position);
    return repository.observe(key, 'cloud-eval', {
      decode: decodeCached,
      refreshAfterMs: LICHESS_EVAL_TTL_MS,
      now,
      fallbackOnError: 'null',
      acquire: async ({ signal: requestSignal, priority: requestPriority, cached }: any) => {
        const url = new URL(ENDPOINT);
        url.searchParams.set('fen', toPlayableFen(key));
        url.searchParams.set('variant', 'standard');
        url.searchParams.set('multiPv', '5');
        beginRequest();

        const response = await gateway.request(url, {
          signal: requestSignal,
          priority: requestPriority,
          headers: { Accept: 'application/json' },
        });
        const checkedAt = now();
        if (response.status === 404) {
          // Source absence is newer information, not a retraction of an old
          // usable positive evaluation. Retain the value but date the check.
          return {
            value: cached?.value ?? null,
            fetchedAt: cached?.value ? cached.fetchedAt : checkedAt,
            checkedAt,
            raw: cached?.value ?? null,
            issue: null,
          };
        }
        if (!response.ok) {
          throw Object.assign(new Error(`Lichess cloud eval returned ${response.status}`), {
            kind: response.status === 429 ? 'rate-limited' : 'service',
            status: response.status,
          });
        }

        let value: any;
        try {
          value = await response.json();
        } catch {
          throw Object.assign(new Error('Lichess cloud eval response could not be parsed'), { kind: 'invalid-data' });
        }
        if (!validPayload(value)) {
          throw Object.assign(new Error('Lichess cloud eval returned invalid data'), { kind: 'invalid-data' });
        }
        if (!isUsableLichessEval(value)) {
          return {
            value: cached?.value ?? null,
            fetchedAt: cached?.value ? cached.fetchedAt : checkedAt,
            checkedAt,
            raw: cached?.value ?? value,
            issue: evalIssue('insufficient-data', key, {
              fallback: cached?.value ? 'cached' : null,
              message: `Lichess cloud eval depth ${value.depth} is below ${LICHESS_EVAL_MIN_DEPTH}`,
            }),
          };
        }
        return { value, raw: value, fetchedAt: checkedAt, checkedAt, issue: null };
      },
      fields: (result: any, { fetchedAt, checkedAt }: any) => ({
        cloudEval: result.raw,
        cloudEvalFetchedAt: fetchedAt,
        cloudEvalCheckedAt: checkedAt,
      }),
      onError: (error: unknown, { cached, obsolete }: any) => {
        if (obsolete) {
          finishRequest();
          return;
        }
        const typed = error as { kind?: LichessEvalIssueKind; status?: number };
        const fallback = cached?.value ? 'cached' : null;
        const kind = fallback && typed.kind !== 'invalid-data'
          ? 'refresh-failed'
          : typed.kind ?? 'network';
        finishRequest(evalIssue(kind, key, {
          status: typed.status ?? null,
          fallback,
          message: errorMessage(error),
        }));
      },
      onComplete: (result: any, { storageError }: any) => {
        finishRequest(storageError
          ? evalIssue('storage', key, { message: 'Could not persist Lichess cloud evaluation' })
          : result.issue);
      },
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
