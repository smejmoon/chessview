export function createRequestGate({
  fetchImpl = (...args) => fetch(...args),
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  cooldownMs = 60_000,
  minIntervalMs = 250,
} = {}) {
  let tail = Promise.resolve();
  let cooldownUntil = 0;
  let lastRequestAt = 0;

  async function waitForWindow() {
    const current = now();
    const nextAllowedAt = Math.max(cooldownUntil, lastRequestAt + minIntervalMs);
    if (nextAllowedAt > current) await sleep(nextAllowedAt - current);
  }

  function run(input, init) {
    const execute = async () => {
      await waitForWindow();
      lastRequestAt = now();
      const response = await fetchImpl(input, init);
      if (response?.status === 429) {
        cooldownUntil = Math.max(cooldownUntil, now() + cooldownMs);
      }
      return response;
    };

    const promise = tail.then(execute, execute);
    tail = promise.then(() => undefined, () => undefined);
    return promise;
  }

  return {
    run,
    get cooldownUntil() { return cooldownUntil; },
  };
}
