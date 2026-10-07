import test from 'node:test';
import assert from 'node:assert/strict';

import { MASTERS_TTL_MS, createMastersProvider } from '../src/masters.ts';
import { obsoleteWork } from '../src/obsolete-work.ts';
import { START_FEN, canonicalPosition } from '../src/graph.ts';

const CENTER = canonicalPosition(START_FEN);

function reading(uci = 'e2e4') {
  return {
    white: 10,
    draws: 5,
    black: 5,
    moves: [{ uci, white: 6, draws: 2, black: 2 }],
  };
}

function repositoryStub({ record = null, merge = async () => {} } = {}) {
  const facets = new Map();
  const id = (position, facet) => `${facet}\u0000${position}`;
  return {
    get: async () => record,
    merge,
    currentFacet(position, facet) { return facets.get(id(position, facet)) ?? null; },
    admitFacet(position, facet, value, metadata = {}) {
      const admitted = Object.freeze({ value, ...metadata });
      facets.set(id(position, facet), admitted);
      return admitted;
    },
    invalidateFacet(facet, positions) {
      if (positions) {
        for (const position of positions) facets.delete(id(position, facet));
        return;
      }
      const prefix = `${facet}\u0000`;
      for (const key of facets.keys()) if (key.startsWith(prefix)) facets.delete(key);
    },
    load: async (_position, _facet, producer) => producer({
      signal: new AbortController().signal,
      priority: () => 'foreground',
    }),
  };
}

function response(value) {
  return { ok: true, status: 200, json: async () => value };
}

test('fresh cached Masters Reading is returned without a source request', async () => {
  const value = reading();
  let requests = 0;
  const provider = createMastersProvider({
    repository: repositoryStub({
      record: { mastersExplorer: value, mastersFetchedAt: 1_000 },
    }),
    request: async () => { requests += 1; return response(reading('d2d4')); },
    now: () => 1_000 + MASTERS_TTL_MS - 1,
    log: () => {},
  });

  assert.strictEqual(await provider.load(CENTER), value);
  assert.equal(requests, 0);
});

test('malformed cached Masters data is ignored and replaced by valid fresh source data', async () => {
  const fresh = reading('d2d4');
  let persisted = null;
  const provider = createMastersProvider({
    repository: repositoryStub({
      record: {
        mastersExplorer: { white: -1, draws: 0, black: 0, moves: [] },
        mastersFetchedAt: 1_000,
      },
      merge: async (_key, fields) => { persisted = fields; },
    }),
    request: async () => response(fresh),
    now: () => 2_000,
    log: () => {},
  });

  assert.strictEqual(await provider.load(CENTER), fresh);
  assert.strictEqual(persisted.mastersExplorer, fresh);
  assert.equal(persisted.mastersFetchedAt, 2_000);
});

test('malformed fresh Masters data falls back to a usable stale cached Reading', async () => {
  const stale = reading();
  const logs = [];
  const provider = createMastersProvider({
    repository: repositoryStub({
      record: { mastersExplorer: stale, mastersFetchedAt: 1_000 },
    }),
    request: async () => response({ white: 10, draws: 5, black: 5, moves: [{ uci: 'bad', white: 1, draws: 0, black: 0 }] }),
    now: () => 1_000 + MASTERS_TTL_MS + 1,
    log: (...args) => logs.push(args),
  });

  assert.strictEqual(await provider.load(CENTER), stale);
  assert.ok(logs.some(([message, detail, level]) => (
    message === 'Masters refresh failed'
    && detail?.fallback === 'cached'
    && level === 'warn'
  )));
});

test('valid fresh Masters Reading remains usable and is reused when persistence fails', async () => {
  const fresh = reading();
  const logs = [];
  let requests = 0;
  const provider = createMastersProvider({
    repository: repositoryStub({
      merge: async () => { throw new Error('storage unavailable'); },
    }),
    request: async () => {
      requests += 1;
      return response(fresh);
    },
    now: () => 3_000,
    log: (...args) => logs.push(args),
  });

  assert.strictEqual(await provider.load(CENTER), fresh);
  assert.strictEqual(provider.current(CENTER), fresh);
  assert.strictEqual(await provider.load(CENTER), fresh);
  assert.equal(requests, 1);
  assert.ok(logs.some(([message, _detail, level]) => (
    message === 'Masters Reading persistence failed' && level === 'error'
  )));
});

test('semantic ObsoleteWork propagates through Masters without stale fallback', async () => {
  const stale = reading();
  const obsolete = obsoleteWork('superseded');
  const logs = [];
  const provider = createMastersProvider({
    repository: repositoryStub({
      record: { mastersExplorer: stale, mastersFetchedAt: 1_000 },
    }),
    request: async () => { throw obsolete; },
    now: () => 1_000 + MASTERS_TTL_MS + 1,
    log: (...args) => logs.push(args),
  });

  await assert.rejects(provider.load(CENTER), (error) => error === obsolete);
  assert.equal(logs.some(([message]) => message === 'Masters refresh failed'), false);
});

test('genuine Masters source failure returns absence without a failure sentinel', async () => {
  const logs = [];
  const provider = createMastersProvider({
    repository: repositoryStub(),
    request: async () => { throw new Error('offline'); },
    now: () => 4_000,
    log: (...args) => logs.push(args),
  });

  const value = await provider.load(CENTER);
  assert.equal(value, null);
  assert.ok(logs.some(([message, detail, level]) => (
    message === 'Masters refresh failed'
    && detail?.fallback === null
    && detail?.error === 'offline'
    && level === 'warn'
  )));
});
