import assert from 'node:assert/strict';
import test from 'node:test';
import { createRootTranspositionEnricher } from '../src/root-enrichment.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function flush(turns = 4) {
  for (let index = 0; index < turns; index += 1) await Promise.resolve();
}

test('same-target callers detach independently from one shared Root enrichment producer', async () => {
  const expansion = deferred();
  let pathLoads = 0;
  let expansions = 0;
  const enricher = createRootTranspositionEnricher({
    loadReferencePath: async (target) => {
      pathLoads += 1;
      return [{ source: 'start', target, uci: 'e2e4' }];
    },
    expand: async () => {
      expansions += 1;
      return expansion.promise;
    },
  });
  const obsolete = new AbortController();
  const current = new AbortController();

  const first = enricher.ensure('target', { signal: obsolete.signal });
  await flush();
  const second = enricher.ensure('target', { signal: current.signal });
  obsolete.abort();

  await assert.rejects(first, { name: 'AbortError' });
  assert.equal(pathLoads, 1);
  assert.equal(expansions, 1);

  expansion.resolve({ addedEdges: 3 });
  assert.deepEqual(await second, { addedEdges: 3 });
  assert.equal(pathLoads, 1);
  assert.equal(expansions, 1);
});

test('an abandoned caller does not cancel durable enrichment and later callers reuse completion', async () => {
  const expansion = deferred();
  let expansions = 0;
  const enricher = createRootTranspositionEnricher({
    loadReferencePath: async (target) => [{ source: 'start', target, uci: 'd2d4' }],
    expand: async () => {
      expansions += 1;
      return expansion.promise;
    },
  });
  const obsolete = new AbortController();
  const first = enricher.ensure('target', { signal: obsolete.signal });
  await flush();
  obsolete.abort();
  await assert.rejects(first, { name: 'AbortError' });

  expansion.resolve({ addedEdges: 1 });
  await flush();
  assert.equal(await enricher.ensure('target'), null);
  assert.equal(expansions, 1);
});

test('producer failure reaches a live caller and does not poison a later retry', async () => {
  let attempt = 0;
  const enricher = createRootTranspositionEnricher({
    loadReferencePath: async (target) => [{ source: 'start', target, uci: 'c2c4' }],
    expand: async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('expand failed');
      return { addedEdges: 2 };
    },
  });

  await assert.rejects(enricher.ensure('target'), /expand failed/);
  assert.deepEqual(await enricher.ensure('target'), { addedEdges: 2 });
  assert.equal(attempt, 2);
});
