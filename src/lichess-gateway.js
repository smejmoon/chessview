import { LICHESS_REQUEST_MIN_INTERVAL_MS } from './config.ts';
import { debugLog } from './debug.js';
import { obsoleteFromAbort, obsoleteWork, throwIfObsolete } from './obsolete-work.js';

function priorityValue(priority) {
  const value = typeof priority === 'function' ? priority() : priority;
  return value === 'background' ? 'background' : 'foreground';
}

function requestEndpoint(input) {
  const value = typeof Request !== 'undefined' && input instanceof Request
    ? input.url
    : input instanceof URL
      ? input.toString()
      : String(input);
  try {
    if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) return value.slice(0, 120);
    const url = new URL(value);
    return `${url.host}${url.pathname}`;
  } catch {
    return value.slice(0, 120);
  }
}

function requestMethod(input, init) {
  if (init?.method) return String(init.method).toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method || 'GET';
  return 'GET';
}

function errorDetail(error) {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { message: String(error) };
}

export function createLichessGateway({
  fetchImpl = (...args) => fetch(...args),
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  cooldownMs = 60_000,
  minIntervalMs = LICHESS_REQUEST_MIN_INTERVAL_MS,
  log = () => {},
} = {}) {
  const queue = [];
  let draining = false;
  let cooldownUntil = 0;
  let lastRequestAt = 0;
  let nextRequestId = 0;

  function report(event, detail, level = 'info') {
    Reflect.apply(log, undefined, [event, detail, level]);
  }

  async function waitForWindow() {
    const current = now();
    const spacingUntil = lastRequestAt + minIntervalMs;
    const nextAllowedAt = Math.max(cooldownUntil, spacingUntil);
    if (nextAllowedAt <= current) return;
    const delayMs = nextAllowedAt - current;
    const cooldownRemainingMs = Math.max(0, cooldownUntil - current);
    const spacingRemainingMs = Math.max(0, spacingUntil - current);
    report('lichess gateway waiting', {
      delayMs,
      reason: cooldownRemainingMs >= spacingRemainingMs && cooldownRemainingMs > 0 ? 'cooldown' : 'spacing',
      cooldownRemainingMs,
      spacingRemainingMs,
      queueDepth: queue.length,
    });
    await sleep(delayMs);
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
    const startedAt = now();
    lastRequestAt = startedAt;
    const priority = priorityValue(job.priority);
    report('lichess gateway dispatch', {
      id: job.id,
      endpoint: job.endpoint,
      method: job.method,
      priority,
      queuedMs: Math.max(0, startedAt - job.queuedAt),
      queueDepth: queue.length,
    });

    let response;
    try {
      response = await fetchImpl(job.input, job.requestInit);
    } catch (error) {
      const translated = obsoleteFromAbort(error, job.signal, 'Lichess request became obsolete') ?? error;
      report('lichess gateway failure', {
        id: job.id,
        endpoint: job.endpoint,
        durationMs: Math.max(0, now() - startedAt),
        ...errorDetail(translated),
      }, 'error');
      throw translated;
    }

    const finishedAt = now();
    report('lichess gateway response', {
      id: job.id,
      endpoint: job.endpoint,
      status: response?.status ?? null,
      ok: response?.ok ?? null,
      durationMs: Math.max(0, finishedAt - startedAt),
      queueDepth: queue.length,
    }, response?.status >= 400 ? 'warn' : 'info');

    if (response?.status === 429) {
      cooldownUntil = Math.max(cooldownUntil, finishedAt + cooldownMs);
      report('lichess gateway cooldown', {
        id: job.id,
        endpoint: job.endpoint,
        cooldownMs,
        cooldownUntil,
        queueDepth: queue.length,
      }, 'warn');
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
    const id = ++nextRequestId;
    const endpoint = requestEndpoint(input);
    const method = requestMethod(input, requestInit);

    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        report('lichess gateway rejected obsolete request', { id, endpoint, method }, 'warn');
        reject(obsoleteWork('Queued Lichess request became obsolete', signal.reason));
        return;
      }

      const job = {
        id,
        input,
        endpoint,
        method,
        requestInit,
        signal,
        priority,
        queuedAt: now(),
        resolve,
        reject,
        queued: true,
        onAbort: null,
      };
      job.onAbort = () => {
        if (!removeQueued(job)) return;
        forgetQueuedAbort(job);
        report('lichess gateway cancelled queued request', {
          id: job.id,
          endpoint: job.endpoint,
          priority: priorityValue(job.priority),
          queueDepth: queue.length,
        });
        reject(obsoleteWork('Queued Lichess request became obsolete', signal?.reason));
      };
      signal?.addEventListener('abort', job.onAbort, { once: true });
      queue.push(job);
      report('lichess gateway queued', {
        id,
        endpoint,
        method,
        priority: priorityValue(priority),
        queueDepth: queue.length,
      });
      void drain();
    });
  }

  return {
    request,
    get cooldownUntil() { return cooldownUntil; },
  };
}

export const lichessGateway = createLichessGateway({ log: debugLog });
