import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { CACHE_SCHEMA_VERSIONS, NODES_STORE } from '../src/cache-schema.ts';

globalThis.indexedDB = fakeIndexedDB;

const { clearGraph } = await import('../src/db.ts');
const { createLichessEval } = await import('../src/lichess-eval.ts');
const { createPositionRepository } = await import('../src/position-repository.ts');
const { createLichessEvalStatusPresenter } = await import('../src/lichess-eval-presentation.ts');

const NO_EVAL = '8/8/8/8/8/8/8/K6k w - -';
const FAILED_EVAL = '8/8/8/8/8/8/8/K5k1 w - -';
const SHALLOW_EVAL = '8/8/8/8/8/8/8/K4k2 w - -';

function emptyRepository() {
  return createPositionRepository({
    read: async () => null,
    write: async () => {},
    version: () => 0,
    log: () => {},
  });
}

test('cloud eval 404 is successful absence and is cached', async () => {
  await clearGraph();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return { ok: false, status: 404 };
  };
  const lichessEval = createLichessEval();

  assert.equal(await lichessEval.get(NO_EVAL), null);
  assert.equal(await lichessEval.get(NO_EVAL), null);
  assert.equal(calls, 1);
  assert.equal(lichessEval.status.issue, null);
});

test('cloud eval request failure returns no data and reports an operational issue', async () => {
  await clearGraph();
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  const lichessEval = createLichessEval();
  const seen = [];
  lichessEval.subscribe((status) => seen.push(status));

  assert.equal(await lichessEval.get(FAILED_EVAL), null);
  assert.equal(lichessEval.status.activity, 'idle');
  assert.equal(lichessEval.status.issue?.kind, 'service');
  assert.equal(lichessEval.status.issue?.status, 503);
  assert.ok(seen.some((status) => status.activity === 'requesting'));
});

test('a later successful request replaces an earlier operational issue', async () => {
  let calls = 0;
  const value = { depth: 22, pvs: [{ cp: 18, moves: 'a1a2' }] };
  const lichessEval = createLichessEval({
    repository: emptyRepository(),
    gateway: {
      request: async () => {
        calls += 1;
        if (calls === 1) return { ok: false, status: 503 };
        return { ok: true, status: 200, json: async () => value };
      },
    },
  });

  assert.equal(await lichessEval.get(FAILED_EVAL), null);
  assert.equal(lichessEval.status.issue?.kind, 'service');

  assert.equal(await lichessEval.get(NO_EVAL), value);
  assert.equal(lichessEval.status.pending, 0);
  assert.equal(lichessEval.status.issue, null);
});

test('invalid cloud eval JSON is a source-data issue rather than a network issue', async () => {
  const lichessEval = createLichessEval({
    repository: emptyRepository(),
    gateway: {
      request: async () => ({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError('bad json'); },
      }),
    },
  });

  assert.equal(await lichessEval.get(FAILED_EVAL), null);
  assert.equal(lichessEval.status.issue?.kind, 'invalid-data');
});

test('malformed cached cloud eval is diagnosed and replaced from source', async () => {
  const fresh = { depth: 22, pvs: [{ cp: 18, moves: 'a1a2' }] };
  let stored = {
    cloudEval: { depth: 'broken', pvs: [] },
    cloudEvalFetchedAt: 1_000,
  };
  const issues = [];
  const repository = createPositionRepository({
    read: async () => stored,
    write: async (record) => { stored = record; },
    version: () => 0,
    log: (...args) => issues.push(args),
  });
  const lichessEval = createLichessEval({
    repository,
    gateway: {
      request: async () => ({ ok: true, status: 200, json: async () => fresh }),
    },
    now: () => 2_000,
  });

  assert.strictEqual(await lichessEval.get(FAILED_EVAL), fresh);
  assert.strictEqual(stored.cloudEval, fresh);
  const [, detail] = issues.find(([event, value]) => (
    event === 'Position cache operation failed'
    && value?.operation === 'read/validate'
    && value?.facet === 'cloud-eval'
  )) ?? [];
  assert.equal(detail?.schemaVersion, CACHE_SCHEMA_VERSIONS[NODES_STORE]);
  assert.match(detail?.error ?? '', /Cached Lichess cloud eval data is invalid/);
});


test('usable cloud eval reports cache-write failure on its operational channel', async () => {
  const value = { depth: 22, pvs: [{ cp: 18, moves: 'a1a2' }] };
  const lichessEval = createLichessEval({
    repository: createPositionRepository({
      read: async () => null,
      write: async () => { throw new Error('quota exceeded'); },
      version: () => 0,
      log: () => {},
    }),
    gateway: {
      request: async () => ({ ok: true, status: 200, json: async () => value }),
    },
    now: () => 5_000,
  });

  assert.strictEqual(await lichessEval.get(FAILED_EVAL), value);
  assert.equal(lichessEval.status.activity, 'idle');
  assert.equal(lichessEval.status.issue?.kind, 'storage');
});

test('stale cloud eval keeps its deeper positive result across a shallower refresh', async () => {
  const deep = { depth: 40, pvs: [{ cp: 18, moves: 'a1a2' }] };
  const shallow = { depth: 20, pvs: [{ cp: 20, moves: 'a1a2' }] };
  const improved = { depth: 44, pvs: [{ cp: 16, moves: 'a1a2' }] };
  const ttl = (await import('../src/config.ts')).LICHESS_EVAL_TTL_MS;
  let now = ttl + 100;
  let calls = 0;
  let stored = {
    cloudEval: deep,
    cloudEvalFetchedAt: 1,
    cloudEvalCheckedAt: 1,
  };
  const repository = createPositionRepository({
    read: async () => stored,
    write: async (record) => { stored = record; },
    version: () => 0,
    log: () => {},
  });
  const lichessEval = createLichessEval({
    repository,
    now: () => now,
    gateway: {
      request: async () => ({
        status: 200,
        ok: true,
        json: async () => (++calls === 1 ? shallow : improved),
      }),
    },
  });

  function completedRefresh() {
    let began = false;
    let unsubscribe;
    const done = new Promise((resolve) => {
      unsubscribe = lichessEval.subscribe((status) => {
        if (status.activity === 'requesting') began = true;
        if (began && status.activity === 'idle') resolve();
      });
    });
    return done.finally(() => unsubscribe());
  }

  const firstRefresh = completedRefresh();
  assert.strictEqual(await lichessEval.get(FAILED_EVAL), deep);
  await firstRefresh;
  assert.strictEqual(await lichessEval.available(FAILED_EVAL), deep);
  assert.strictEqual(stored.cloudEval, deep);
  assert.equal(stored.cloudEvalFetchedAt, 1);
  assert.equal(stored.cloudEvalCheckedAt, now);

  assert.strictEqual(await lichessEval.get(FAILED_EVAL), deep);
  assert.equal(calls, 1);

  now += ttl + 1;
  const secondRefresh = completedRefresh();
  assert.strictEqual(await lichessEval.get(FAILED_EVAL), deep);
  await secondRefresh;
  assert.strictEqual(await lichessEval.available(FAILED_EVAL), improved);
  assert.strictEqual(stored.cloudEval, improved);
  assert.equal(calls, 2);
});

test('status presentation failure cannot interrupt cloud eval acquisition', async () => {
  const value = { depth: 22, pvs: [{ cp: 24, moves: 'a1a2' }] };
  const lichessEval = createLichessEval({
    repository: emptyRepository(),
    gateway: {
      request: async () => ({ ok: true, status: 200, json: async () => value }),
    },
  });
  const logged = [];
  const presenter = createLichessEvalStatusPresenter({
    render: () => { throw new Error('renderer broke'); },
    log: (message, detail) => logged.push([message, detail]),
  });
  const stop = lichessEval.subscribe(presenter.update);

  assert.equal(await lichessEval.get(FAILED_EVAL), value);
  assert.equal(lichessEval.status.activity, 'idle');
  assert.equal(lichessEval.status.pending, 0);
  assert.equal(lichessEval.status.issue, null);
  assert.ok(logged.length >= 2);
  stop();
});

test('insufficient cloud eval is hidden from callers', async () => {
  await clearGraph();
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ depth: 12, pvs: [{ cp: 10, moves: 'a1a2' }] }),
  });
  const lichessEval = createLichessEval();

  assert.equal(await lichessEval.get(SHALLOW_EVAL), null);
  assert.equal(await lichessEval.available(SHALLOW_EVAL), null);
  assert.equal(lichessEval.status.issue?.kind, 'insufficient-data');
});
