import { getNode, nodeStoreVersion, putNode } from './position-store.ts';
import { canonicalPosition, toPlayableFen } from './graph.ts';
import { obsoleteWork, throwIfObsolete } from './obsolete-work.ts';

// An independent category of observations attached to a canonical position.
export type SourceChannel = string;

type LoadUrgency = 'foreground' | 'background';
type LoadPriority = LoadUrgency | (() => LoadUrgency);

type SharedSourceChannelLoad = {
  controller: AbortController;
  promise: Promise<any> | null;
  settled: boolean;
  subscribers: Set<{ priority: LoadPriority }>;
};

function priorityValue(priority: LoadPriority) {
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
  const activeSourceChannelLoads = new Map<string, SharedSourceChannelLoad>();
  // Includes detached producers until their completion (including persistence).
  const unsettledSourceLoads = new Set<SharedSourceChannelLoad>();
  const sourceChannels = new Map<string, any>();
  let observedVersion = version();
  let quiescing = false;
  let quiescence: Promise<void> | null = null;

  function sourceChannelId(position: any, sourceChannel: SourceChannel) {
    return `${sourceChannel}\u0000${canonicalPosition(position)}`;
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
    if (quiescing) return Promise.reject(obsoleteWork('Position writes stopped for cache maintenance'));
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

  function currentSourceChannel(position: any, sourceChannel: SourceChannel) {
    return sourceChannels.get(sourceChannelId(position, sourceChannel)) ?? null;
  }

  function admitSourceChannel(position: any, sourceChannel: SourceChannel, value: any, metadata: Record<string, any> = {}) {
    const admitted = Object.freeze({ value, ...metadata });
    sourceChannels.set(sourceChannelId(position, sourceChannel), admitted);
    return admitted;
  }

  function invalidateSourceChannel(sourceChannel: SourceChannel, positions?: readonly any[]) {
    if (positions) {
      for (const position of positions) sourceChannels.delete(sourceChannelId(position, sourceChannel));
      return;
    }
    const prefix = `${sourceChannel}\u0000`;
    for (const id of sourceChannels.keys()) {
      if (id.startsWith(prefix)) sourceChannels.delete(id);
    }
  }

  function effectivePriority(load: SharedSourceChannelLoad) {
    for (const subscriber of load.subscribers) {
      if (priorityValue(subscriber.priority) === 'foreground') return 'foreground';
    }
    return 'background';
  }

  function subscribe(load: SharedSourceChannelLoad, signal: AbortSignal | undefined, releaseLast: () => void, priority: LoadPriority) {
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

      load.promise!.then(
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

  function load(position: any, sourceChannel: SourceChannel, producer: (context: any) => any, { signal, priority = 'foreground' }: { signal?: AbortSignal; priority?: LoadPriority } = {}) {
    if (quiescing) return Promise.reject(obsoleteWork('Position loads stopped for cache maintenance'));
    if (signal?.aborted) {
      return Promise.reject(obsoleteWork('Position load participation became obsolete', signal.reason));
    }
    syncVersion();
    const key = canonicalPosition(position);
    const id = `${sourceChannel}\u0000${key}`;
    let shared = activeSourceChannelLoads.get(id);

    if (!shared) {
      const controller = new AbortController();
      const created: SharedSourceChannelLoad = {
        controller,
        promise: null,
        settled: false,
        subscribers: new Set(),
      };
      shared = created;
      const work = Promise.resolve().then(() => {
        throwIfObsolete(controller.signal, 'Shared position load became obsolete before starting');
        return producer(Object.freeze({
          key,
          signal: controller.signal,
          priority: () => effectivePriority(created),
        }));
      });
      unsettledSourceLoads.add(created);
      created.promise = work.finally(() => {
        created.settled = true;
        unsettledSourceLoads.delete(created);
        if (activeSourceChannelLoads.get(id) === created) activeSourceChannelLoads.delete(id);
      });
      created.promise.catch(() => {});
      activeSourceChannelLoads.set(id, shared);
    }

    return subscribe(shared, signal, () => {
      if (activeSourceChannelLoads.get(id) !== shared) return;
      activeSourceChannelLoads.delete(id);
      shared.controller.abort();
    }, priority);
  }

  // One-way shutdown for rare cache maintenance followed by a page reload.
  // Cancellation alone is insufficient: a detached producer may still be
  // finishing a response or persisting a value.
  function quiesceForMaintenance(): Promise<void> {
    if (quiescence) return quiescence;
    quiescing = true;
    for (const load of unsettledSourceLoads) load.controller.abort();
    quiescence = (async () => {
      await Promise.allSettled([...unsettledSourceLoads].map((load) => load.promise!));
      await Promise.allSettled([...mutations.values()]);
    })();
    return quiescence;
  }

  return Object.freeze({
    get,
    put,
    merge,
    ensure,
    quiesceForMaintenance,
    currentSourceChannel,
    admitSourceChannel,
    invalidateSourceChannel,
    load,
  });
}

export const positionRepository = createPositionRepository();
