import test from 'node:test';
import assert from 'node:assert/strict';

import { MASTERS_TTL_MS, createMastersProvider } from '../src/masters.ts';
import { obsoleteWork } from '../src/obsolete-work.ts';
import { START_FEN, canonicalPosition } from '../src/graph.ts';
import { createPositionRepository } from '../src/position-repository.ts';

const CENTER = canonicalPosition(START_FEN);

function reading(uci = 'e2e4') {
  return {
    white: 10,
    draws: 5,
    black: 5,
    moves: [{ uci, white: 6, draws: 2, black: 2 }],
  };
}

function repositoryWith(record = null, onWrite = async () => {}) {
  return createPositionRepository({
    read: async () => record,
    write: onWrite,
    version: () => 0,
    log: () => {},
  });
}

function response(value) {
  return { ok: true, status: 200, json: async () => value };
}

test('malformed cached Masters data is ignored and replaced by valid fresh source data', async () => {
  const fresh = reading('d2d4');
  let persisted = null;
  const provider = createMastersProvider({
    repository: repositoryWith({
      mastersExplorer: { white: -1, draws: 0, black: 0, moves: [] },
      mastersFetchedAt: 1_000,
    }, async (value) => { persisted = value; }),
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
    repository: repositoryWith({ mastersExplorer: stale, mastersFetchedAt: 1_000 }),
    request: async () => response({ white: 10, draws: 5, black: 5, moves: [{ uci: 'bad', white: 1, draws: 0, black: 0 }] }),
    now: () => 1_000 + MASTERS_TTL_MS + 1,
    log: (...args) => logs.push(args),
  });

  assert.strictEqual(await provider.load(CENTER), stale);
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(logs.some(([message, detail, level]) => (
    message === 'Masters refresh failed'
    && detail?.fallback === 'cached'
    && level === 'warn'
  )));
});

test('obsolete background Masters refresh leaves an immediately returned cached Reading intact', async () => {
  const stale = reading();
  const obsolete = obsoleteWork('superseded');
  const logs = [];
  const controller = new AbortController();
  const provider = createMastersProvider({
    repository: repositoryWith({ mastersExplorer: stale, mastersFetchedAt: 1_000 }),
    request: async (_url, _init, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(obsolete), { once: true });
    }),
    now: () => 1_000 + MASTERS_TTL_MS + 1,
    log: (...args) => logs.push(args),
  });

  assert.strictEqual(await provider.load(CENTER, { signal: controller.signal }), stale);
  controller.abort();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(logs.some(([message]) => message === 'Masters refresh failed'), false);
});

test('genuine Masters source failure returns absence without a failure sentinel', async () => {
  const logs = [];
  const provider = createMastersProvider({
    repository: repositoryWith(),
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
