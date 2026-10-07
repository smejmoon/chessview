import { getNode, nodeStoreVersion, putNode } from './position-store.ts';
import { canonicalPosition, toPlayableFen } from './graph.ts';
import { obsoleteWork } from './obsolete-work.ts';

function priorityValue(priority: any) {
  const value = typeof priority === 'function' ? priority() : priority;
  return value === 'background' ? 'background' : 'foreground';
}

export function createPositionRepository({
  read = getNode,
  write = putNode,
  version = nodeStoreVersion,
} = {}) {
  const records = new Map<string, any>();
  const reads = new Map<string, Promise<any>>();
  const mutations = new Map<string, Promise<any>>();
  const loads = new Map<string, any>();
  const facets = new Map<string, any>();
  let observedVersion = version();

  function facetId(position: any, facet: string) {
    return `${facet}\u0000${canonicalPosition(position)}`;
  }

  function syncVersion() {
    const current = version();
    if (current === observedVersion) return;
    observedVersion = current;
    records.clear();
    reads.clear();
  }

  async function get(position: any) {
    syncVersion();
    const key = canonicalPosition(position);
    if (records.has(key)) return records.get(key);
    if (reads.has(key)) return reads.get(key);

    const pending = Promise.resolve(read(key))
      .then((value: any) => {
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

  function mutate(key: string, operation: () => any) {
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

  async function persist(key: string, value: any) {
    await write(value);
    observedVersion = version();
    records.set(key, value);
    return value;
  }

  function put(record: any) {
    syncVersion();
    const key = canonicalPosition(record?.key ?? record?.fen);
    return mutate(key, () => persist(key, {
      ...record,
      key,
      fen: record?.fen ?? toPlayableFen(key),
    }));
  }

  function merge(position: any, fields: Record<string, any> = {}) {
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

  function ensure(position: any, fields: Record<string, any> = {}) {
    syncVersion();
    const key = canonicalPosition(position);
    return mutate(key, async () => {
      const current = await get(key);
      if (current) return current;
      return persist(key, { key, fen: toPlayableFen(key), ...fields });
    });
  }

  function currentFacet(position: any, facet: string) {
    return facets.get(facetId(position, facet)) ?? null;
  }

  function admitFacet(position: any, facet: string, value: any, metadata: Record<string, any> = {}) {
    const admitted = Object.freeze({ value, ...metadata });
    facets.set(facetId(position, facet), admitted);
    return admitted;
  }

  function invalidateFacet(facet: string, positions?: readonly any[]) {
    if (positions) {
      for (const position of positions) facets.delete(facetId(position, facet));
      return;
    }
    const prefix = `${facet}\u0000`;
    for (const id of facets.keys()) {
      if (id.startsWith(prefix)) facets.delete(id);
    }
  }

  function effectivePriority(load: any) {
    for (const subscriber of load.subscribers) {
      if (priorityValue(subscriber.priority) === 'foreground') return 'foreground';
    }
    return 'background';
  }

  function subscribe(load: any, signal: AbortSignal | undefined, releaseLast: () => void, priority: any) {
    if (signal?.aborted) return Promise.reject(obsoleteWork('Position load participation became obsolete', signal.reason));
    const subscriber = { priority };
    load.subscribers.add(subscriber);

    return new Promise<any>((resolve, reject) => {
      const release = () => {
        if (!load.subscribers.delete(subscriber)) return;
        if (!load.settled && load.subscribers.size === 0) releaseLast();
      };
      const onAbort = () => {
        signal?.removeEventListener('abort', onAbort);
        release();
        reject(obsoleteWork('Position load participation became obsolete', signal?.reason));
      };
      signal?.addEventListener('abort', onAbort, { once: true });

      load.promise.then(
        (value: any) => {
          signal?.removeEventListener('abort', onAbort);
          release();
          resolve(value);
        },
        (error: unknown) => {
          signal?.removeEventListener('abort', onAbort);
          release();
          reject(error);
        },
      );
    });
  }

  function load(position: any, facet: string, producer: (context: any) => any, { signal, priority = 'foreground' }: { signal?: AbortSignal; priority?: 'foreground' | 'background' | (() => 'foreground' | 'background') } = {}) {
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

  return Object.freeze({
    get,
    put,
    merge,
    ensure,
    currentFacet,
    admitFacet,
    invalidateFacet,
    load,
  });
}

export const positionRepository = createPositionRepository();
