import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';

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

const { clearGraph } = await import('../src/db.js');
const { START_FEN, canonicalPosition } = await import('../src/graph.js');
const { loadExplorer } = await import('../src/explorer.js');
const { loadCloudEval, loadMasters } = await import('../src/eval.js');

const center = canonicalPosition(START_FEN);

test('real Lichess-backed clients share the production gateway', async () => {
  await clearGraph();
  localStorage.setItem('chessview.lichess.accessToken', 'token123');

  let active = 0;
  let maxActive = 0;
  let releaseFirst;
  let firstStarted;
  const firstStartedPromise = new Promise((resolve) => { firstStarted = resolve; });
  const firstHold = new Promise((resolve) => { releaseFirst = resolve; });
  const seen = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    seen.push(url);
    active += 1;
    maxActive = Math.max(maxActive, active);
    if (active === 1) {
      firstStarted();
      await firstHold;
    }
    active -= 1;

    if (url.includes('/api/cloud-eval')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ depth: 22, pvs: [{ cp: 12, moves: 'e2e4' }] }),
      };
    }
    if (url.includes('/masters')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ white: 0, draws: 0, black: 0, moves: [] }),
      };
    }
    if (url.includes('explorer.lichess.org/lichess')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ white: 60, draws: 20, black: 20, moves: [] }),
      };
    }
    throw new Error(`unexpected request ${url}`);
  };

  const requests = [
    loadExplorer(center, { force: true }),
    loadMasters(center),
    loadCloudEval(center),
  ];

  await firstStartedPromise;
  await new Promise((resolve) => setImmediate(resolve));
  const observedMaxActive = maxActive;
  releaseFirst();
  await Promise.all(requests);

  assert.equal(observedMaxActive, 1);
  assert.equal(maxActive, 1);
  assert.equal(seen.length, 3);
  assert.ok(seen.some((url) => url.includes('explorer.lichess.org/lichess')));
  assert.ok(seen.some((url) => url.includes('/masters')));
  assert.ok(seen.some((url) => url.includes('/api/cloud-eval')));
});
