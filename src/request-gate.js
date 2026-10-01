function abortError() {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

function priorityValue(priority) {
  const value = typeof priority === 'function' ? priority() : priority;
  return value === 'background' ? 'background' : 'foreground';
}

export function createRequestGate({
  fetchImpl = (...args) => fetch(...args),
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  cooldownMs = 60_000,
  minIntervalMs = 250,
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

  function pruneAborted() {
    let index = 0;
    while (index < queue.length) {
      const item = queue[index];
      if (!item.init.signal?.aborted) {
        index += 1;
        continue;
      }
      queue.splice(index, 1);
      item.reject(abortError());
    }
  }

  function selectForDispatch() {
    const foreground = queue.findIndex((item) => priorityValue(item.priority) === 'foreground');
    return foreground >= 0 ? foreground : 0;
  }

  async function execute(item) {
    const { priority: _priority, ...requestInit } = item.init;
    throwIfAborted(requestInit.signal);
    lastRequestAt = now();
    const response = await fetchImpl(item.input, requestInit);
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
        pruneAborted();
        if (!queue.length) break;

        await waitForWindow();

        pruneAborted();
        if (!queue.length) continue;

        const [item] = queue.splice(selectForDispatch(), 1);
        try {
          item.resolve(await execute(item));
        } catch (error) {
          item.reject(error);
        }
      }
    } finally {
      draining = false;
    }
  }

  function run(input, init = {}) {
    return new Promise((resolve, reject) => {
      queue.push({ input, init, priority: init.priority, resolve, reject });
      void drain();
    });
  }

  return {
    run,
    get cooldownUntil() { return cooldownUntil; },
  };
}
