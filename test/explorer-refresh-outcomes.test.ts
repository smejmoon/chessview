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

const { clearGraph, putNode } = await import('../src/db.ts');
const { clearDebugLog, getDebugEntries } = await import('../src/debug.ts');
const { loadExplorerReading } = await import('../src/explorer.ts');

const center = canonicalPosition(START_FEN);

function abortError() {
  const error = new Error('request cancelled by test');
  error.name = 'AbortError';
  return error;
}

function matchingEvents(event) {
  return getDebugEntries().filter((entry) => entry.event === event);
}

async function putStaleExplorer() {
  const explorer = {
    white: 50,
    draws: 20,
    black: 30,
    moves: [{ uci: 'e2e4', white: 25, draws: 10, black: 15 }],
  };
  await putNode({
    key: center,
    fen: START_FEN,
    explorer,
    explorerFetchedAt: Date.now() - EXPLORER_TTL_MS - 1,
    games: 100,
  });
  return explorer;
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

test('failed Explorer refresh with usable stale data emits only the stale-fallback warning', async () => {
  await clearGraph();
  localStorage.setItem('chessview.lichess.accessToken', 'test-token');
  const stale = await putStaleExplorer();
  clearDebugLog();
  globalThis.fetch = async () => { throw new Error('offline'); };

  assert.deepEqual(await loadExplorerReading(center), stale);

  assert.equal(matchingEvents('explorer refresh failed').length, 0);
  const fallback = matchingEvents('Explorer refresh failed; using stale Reading');
  assert.equal(fallback.length, 1);
  assert.equal(fallback[0].level, 'warn');
  assert.equal(fallback[0].detail.error, 'offline');
});

test('failed Explorer refresh without usable stale data emits one error and propagates the failure', async () => {
  await clearGraph();
  localStorage.setItem('chessview.lichess.accessToken', 'test-token');
  clearDebugLog();
  globalThis.fetch = async () => { throw new Error('offline without cache'); };

  await assert.rejects(
    loadExplorerReading(center),
    /offline without cache/,
  );

  const failures = matchingEvents('explorer refresh failed');
  assert.equal(failures.length, 1);
  assert.equal(failures[0].level, 'error');
  assert.equal(failures[0].detail.error, 'offline without cache');
  assert.equal(matchingEvents('Explorer refresh failed; using stale Reading').length, 0);
});
