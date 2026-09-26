import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';

globalThis.indexedDB = fakeIndexedDB;

const { clearGraph } = await import('../src/db.js');
const { isEvidenceRequestFailure, loadCloudEval } = await import('../src/eval.js');

const NO_EVAL = '8/8/8/8/8/8/8/K6k w - -';
const FAILED_EVAL = '8/8/8/8/8/8/8/K5k1 w - -';

test('cloud eval 404 is successful absence and is cached', async () => {
  await clearGraph();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return { ok: false, status: 404 };
  };

  assert.equal(await loadCloudEval(NO_EVAL), null);
  assert.equal(await loadCloudEval(NO_EVAL), null);
  assert.equal(calls, 1);
});

test('cloud eval request failure is explicit rather than absent evidence', async () => {
  await clearGraph();
  globalThis.fetch = async () => ({ ok: false, status: 503 });

  const result = await loadCloudEval(FAILED_EVAL);
  assert.equal(isEvidenceRequestFailure(result), true);
  assert.equal(result.status, 503);
  assert.match(result.message, /cloud eval returned 503/);
});
