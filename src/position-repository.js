import { getNode, nodeStoreVersion, putNode } from './position-store.js';
import { canonicalPosition, toPlayableFen } from './graph.js';

function abortError() {
  const error = new Error('Position load participation became obsolete');
  error.name = 'AbortError';
  return error;
}

function priorityValue(priority) {
  const value = typeof priority === 'function' ? priority() : priority;
  return value === 'background' ? 'background' : 'foreground';
}

export function createPositionRepository({
  read = getNode,
  write = putNode,
  version = nodeStoreVersion,
} = {}) {
  const records = new Map();
  const reads = new Map();
  const mutations = new Map();
  const loads = new Map();
  let observedVersion = version();

  function syncVersion() {
    const current = version();
    if (current === observedVersion) return;
    observedVersion = current;
    records.clear();
    reads.clear();
  }

  async function get(position) {
    syncVersion();
    const key = canonicalPosition(position);
    if (records.has(key)) return records.get(key);
    if (reads.has(key)) return reads.get(key);

    const pending = Promise.resolve(read(key))
      .then((value) => {
        if (!value) return null;
        const record = {
          ...value,
          key,
          fen: value.fen ?? toPlayableFen(key),
        };
        records.set(key, record);
        return record;
      })
      .finally(() => {
        if (reads.get(key) === pending) reads.delete(key);
      });
    reads.set(key, pending);
    return pending;
  }

  function mutate(key, operation) {
    const previous = mutations.get(key) ?? Promise.resolve();
    const pending = previous
      .catch(() => undefined)
      .then(operation)
      .finally(() => {
        if (mutations.get(key) === pending) mutations.delete(key);
      });
    mutations.set(key, pending);
    return pending;
  }

  async function persist(key, value) {
    await write(value);
    observedVersion = version();
    records.set(key, value);
    return value;
  }

  function put(record) {
    syncVersion();
    const key = canonicalPosition(record?.key ?? record?.fen);
    return mutate(key, () => persist(key, {
      ...record,
      key,
      fen: record?.fen ?? toPlayableFen(key),
    }));
  }

  function merge(position, fields = {}) {
    syncVersion();
    const key = canonicalPosition(position);
    return mutate(key, async () => {
      const current = await get(key);
      return persist(key, {
        ...(current ?? {}),
        key,
        fen: current?.fen ?? fields.fen ?? toPlayableFen(key),
        ...fields,
      });
    });
  }

  function ensure(position, fields = {}) {
    syncVersion();
    const key = canonicalPosition(position);
    return mutate(key, async () => {
      const current = await get(key);
      if (current) return current;
      return persist(key, { key, fen: toPlayableFen(key), ...fields });
    });
  }

  function effectivePriority(load) {
    for (const subscriber of load.subscribers) {
      if (priorityValue(subscriber.priority) === 'foreground') return 'foreground';
    }
    return 'background';
  }

  function subscribe(load, signal, releaseLast, priority) {
    if (signal?.aborted) return Promise.reject(abortError());
    const subscriber = { priority };
    load.subscribers.add(subscriber);

    return new Promise((resolve, reject) => {
      const release = () => {
        if (!load.subscribers.delete(subscriber)) return;
        if (!load.settled && load.subscribers.size === 0) releaseLast();
      };
      const onAbort = () => {
        signal?.removeEventListener('abort', onAbort);
        release();
        reject(abortError());
      };
      signal?.addEventListener('abort', onAbort, { once: true });

      load.promise.then(
        (value) => {
          signal?.removeEventListener('abort', onAbort);
          release();
          resolve(value);
        },
        (error) => {
          signal?.removeEventListener('abort', onAbort);
          release();
          reject(error);
        },
      );
    });
  }

  function load(position, facet, producer, { signal, priority = 'foreground' } = {}) {
    syncVersion();
    const key = canonicalPosition(position);
    const id = `${facet}\u0000${key}`;
    let shared = loads.get(id);

    if (!shared) {
      const controller = new AbortController();
      shared = {
        controller,
        promise: null,
        settled: false,
        subscribers: new Set(),
      };
      const work = Promise.resolve().then(() => producer(Object.freeze({
        key,
        signal: controller.signal,
        priority: () => effectivePriority(shared),
      })));
      shared.promise = work.finally(() => {
        shared.settled = true;
        if (loads.get(id) === shared) loads.delete(id);
      });
      shared.promise.catch(() => {});
      loads.set(id, shared);
    }

    return subscribe(shared, signal, () => {
      if (loads.get(id) !== shared) return;
      loads.delete(id);
      shared.controller.abort();
    }, priority);
  }

  return Object.freeze({ get, put, merge, ensure, load });
}

export const positionRepository = createPositionRepository();
