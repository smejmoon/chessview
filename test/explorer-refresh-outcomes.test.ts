import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { EXPLORER_TTL_MS } from '../src/config.ts';
import { canonicalPosition, START_FEN } from '../src/graph.ts';

globalThis.indexedDB = fakeIndexedDB;

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.window = { location: { href: 'https://example.test/chessview/', search: '' } };
globalThis.history = { state: null, replaceState() {} };

const { clearGraph } = await import('../src/db.ts');
const { clearDebugLog, getDebugEntries } = await import('../src/debug.ts');
const { loadExplorerReading, createExplorerProvider } = await import('../src/explorer.ts');
const { isSourceUnavailable } = await import('../src/source-unavailable.ts');
const { createPositionRepository } = await import('../src/position-repository.ts');

const center = canonicalPosition(START_FEN);

function abortError() {
  const error = new Error('request cancelled by test');
  error.name = 'AbortError';
  return error;
}

function matchingEvents(event) {
  return getDebugEntries().filter((entry) => entry.event === event);
}

test('aborted Explorer refresh propagates cancellation without failure diagnostics or stale fallback', async () => {
  await clearGraph();
  localStorage.setItem('chessview.lichess.accessToken', 'test-token');
  clearDebugLog();

  let releaseStarted;
  const started = new Promise((resolve) => { releaseStarted = resolve; });
  globalThis.fetch = async (_input, init = {}) => {
    releaseStarted();
    return new Promise((_resolve, reject) => {
      if (init.signal?.aborted) {
        reject(abortError());
        return;
      }
      init.signal?.addEventListener('abort', () => reject(abortError()), { once: true });
    });
  };

  const controller = new AbortController();
  const pending = loadExplorerReading(center, { signal: controller.signal });
  await started;
  controller.abort();

  await assert.rejects(pending, (error) => error?.name === 'AbortError');
  assert.equal(matchingEvents('explorer refresh failed').length, 0);
  assert.equal(matchingEvents('Explorer refresh failed; using stale Reading').length, 0);
});

test('failed Explorer refresh returns compatible stale data before reporting the failure', async () => {
  const stale = {
    white: 50, draws: 20, black: 30,
    moves: [{ uci: 'e2e4', white: 25, draws: 10, black: 15 }],
  };
  const stored = {
    explorer: stale,
    explorerFetchedAt: 1,
    explorerRequestProfile: JSON.stringify({ variant: 'standard', moves: '30', topGames: '4', recentGames: '8' }),
  };
  let startRequest;
  const started = new Promise((resolve) => { startRequest = resolve; });
  let completeFailure;
  const failed = new Promise((resolve) => { completeFailure = resolve; });
  const logs = [];
  const repository = createPositionRepository({
    read: async () => stored,
    write: async () => {},
    version: () => 0,
    log: () => {},
  });
  const provider = createExplorerProvider({
    repository,
    now: () => EXPLORER_TTL_MS + 100,
    request: async () => {
      startRequest();
      throw new Error('offline');
    },
    log: (message, detail, level) => {
      logs.push({ message, detail, level });
      if (message === 'Explorer refresh failed; using stale Reading') completeFailure();
    },
  });

  assert.strictEqual(await provider.ensure(center), stale);
  await started;
  await failed;
  const fallback = logs.filter(({ message }) => message === 'Explorer refresh failed; using stale Reading');
  assert.equal(fallback.length, 1);
  assert.equal(fallback[0].level, 'warn');
  assert.equal(fallback[0].detail.error, 'offline');
});

test('failed Explorer refresh without usable stale data reports once and rejects', async () => {
  const logs = [];
  const repository = createPositionRepository({
    read: async () => null,
    write: async () => {},
    version: () => 0,
    log: () => {},
  });
  const provider = createExplorerProvider({
    repository,
    request: async () => { throw new Error('offline without cache'); },
    log: (message, detail, level) => logs.push({ message, detail, level }),
  });

  await assert.rejects(provider.ensure(center), (error) => (
    isSourceUnavailable(error) && error.cause?.message === 'offline without cache'
  ));
  const failures = logs.filter(({ message }) => message === 'explorer refresh failed');
  assert.equal(failures.length, 1);
  assert.equal(failures[0].level, 'error');
  assert.equal(failures[0].detail.error, 'offline without cache');
});


test('Explorer provider translates exhausted HTTP 429 into source unavailability after fallback', async () => {
  const repository = createPositionRepository({
    read: async () => null,
    write: async () => {},
    version: () => 0,
    log: () => {},
  });
  const provider = createExplorerProvider({
    repository,
    request: async () => ({
      ok: false,
      status: 429,
      text: async () => 'slow down',
      json: async () => ({}),
    }),
    log: () => {},
  });

  await assert.rejects(provider.ensure(center), (error) => (
    isSourceUnavailable(error) && error.cause?.status === 429
  ));
});
