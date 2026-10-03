import { LICHESS_REQUEST_MIN_INTERVAL_MS } from './config.ts';
import { obsoleteFromAbort, obsoleteWork, throwIfObsolete } from './obsolete-work.js';

function priorityValue(priority) {
  const value = typeof priority === 'function' ? priority() : priority;
  return value === 'background' ? 'background' : 'foreground';
}

export function createLichessGateway({
  fetchImpl = (...args) => fetch(...args),
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  cooldownMs = 60_000,
  minIntervalMs = LICHESS_REQUEST_MIN_INTERVAL_MS,
} = {}) {
  const queue = [];
  let draining = false;
  let cooldownUntil = 0;
  let lastRequestAt = 0;

  async function waitForWindow() {
    const current = now();
    const nextAllowedAt = Math.max(cooldownUntil, lastRequestAt + minIntervalMs);
    if (nextAllowedAt > current) await sleep(nextAllowedAt - current);
  }

  function removeQueued(job) {
    if (!job.queued) return false;
    const index = queue.indexOf(job);
    if (index < 0) return false;
    queue.splice(index, 1);
    job.queued = false;
    return true;
  }

  function forgetQueuedAbort(job) {
    if (job.onAbort) job.signal?.removeEventListener('abort', job.onAbort);
  }

  function takeNext() {
    if (!queue.length) return null;
    const foreground = queue.findIndex((job) => priorityValue(job.priority) === 'foreground');
    const index = foreground >= 0 ? foreground : 0;
    const [job] = queue.splice(index, 1);
    job.queued = false;
    forgetQueuedAbort(job);
    return job;
  }

  async function dispatch(job) {
    throwIfObsolete(job.signal, 'Lichess request became obsolete before dispatch');
    lastRequestAt = now();

    let response;
    try {
      response = await fetchImpl(job.input, job.requestInit);
    } catch (error) {
      throw obsoleteFromAbort(error, job.signal, 'Lichess request became obsolete') ?? error;
    }

    if (response?.status === 429) {
      cooldownUntil = Math.max(cooldownUntil, now() + cooldownMs);
    }
    return response;
  }

  async function drain() {
    if (draining) return;
    draining = true;
    try {
      while (queue.length) {
        await waitForWindow();
        const job = takeNext();
        if (!job) continue;
        try {
          job.resolve(await dispatch(job));
        } catch (error) {
          job.reject(error);
        }
      }
    } finally {
      draining = false;
    }
  }

  function request(input, init = {}) {
    const { priority = 'foreground', ...requestInit } = init;
    const signal = requestInit.signal;

    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(obsoleteWork('Queued Lichess request became obsolete', signal.reason));
        return;
      }

      const job = {
        input,
        requestInit,
        signal,
        priority,
        resolve,
        reject,
        queued: true,
        onAbort: null,
      };
      job.onAbort = () => {
        if (!removeQueued(job)) return;
        forgetQueuedAbort(job);
        reject(obsoleteWork('Queued Lichess request became obsolete', signal?.reason));
      };
      signal?.addEventListener('abort', job.onAbort, { once: true });
      queue.push(job);
      void drain();
    });
  }

  return {
    request,
    get cooldownUntil() { return cooldownUntil; },
  };
}

export const lichessGateway = createLichessGateway();
