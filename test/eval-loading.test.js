import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';

globalThis.indexedDB = fakeIndexedDB;

const { clearGraph } = await import('../src/db.js');
const { createLichessEval } = await import('../src/lichess-eval.js');
const { createLichessEvalStatusPresenter } = await import('../src/lichess-eval-presentation.js');

const NO_EVAL = '8/8/8/8/8/8/8/K6k w - -';
const FAILED_EVAL = '8/8/8/8/8/8/8/K5k1 w - -';
const SHALLOW_EVAL = '8/8/8/8/8/8/8/K4k2 w - -';

function repositoryStub({ record = null, merge = async () => {} } = {}) {
  return {
    get: async () => record,
    merge,
    load: async (_position, _facet, producer) => producer({ signal: new AbortController().signal }),
  };
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
    repository: repositoryStub(),
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
    repository: repositoryStub(),
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

test('usable cloud eval survives local cache-write failure and reports storage issue', async () => {
  const value = { depth: 22, pvs: [{ cp: 18, moves: 'a1a2' }] };
  const lichessEval = createLichessEval({
    repository: repositoryStub({
      merge: async () => { throw new Error('quota exceeded'); },
    }),
    gateway: {
      request: async () => ({ ok: true, status: 200, json: async () => value }),
    },
  });

  assert.equal(await lichessEval.get(FAILED_EVAL), value);
  assert.equal(lichessEval.status.activity, 'idle');
  assert.equal(lichessEval.status.issue?.kind, 'storage');
});

test('status presentation failure cannot interrupt cloud eval acquisition', async () => {
  const value = { depth: 22, pvs: [{ cp: 24, moves: 'a1a2' }] };
  const lichessEval = createLichessEval({
    repository: repositoryStub(),
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
