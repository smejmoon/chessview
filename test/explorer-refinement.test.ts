import assert from 'node:assert/strict';
import test from 'node:test';
import { createExplorerRefinementFailureClassifier } from '../src/explorer-refinement.ts';
import { canonicalPosition, START_FEN } from '../src/graph.ts';
import { createKnowledgeAcquisition } from '../src/knowledge-acquisition.ts';
import { obsoleteWork } from '../src/obsolete-work.ts';

const center = canonicalPosition(START_FEN);

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

test('Explorer 429 ends this attempt without a retry gate', () => {
  const classify = createExplorerRefinementFailureClassifier();
  assert.deepEqual(classify(Object.assign(new Error('rate limited'), { status: 429 })), { refinement: 'unavailable' });
  assert.deepEqual(classify(new Error('network failed')), { refinement: 'unavailable' });
  assert.equal(classify(obsoleteWork('old view')), null);
});

test('Knowledge Acquisition turns only Explorer load failure into a semantic unavailable outcome', async () => {
  const sourceFailure = new Error('source exhausted');
  let reconciliations = 0;
  const acquisition = createKnowledgeAcquisition({
    loadExplorer: async () => { throw sourceFailure; },
    classifyExplorerFailure: (error) => {
      assert.equal(error, sourceFailure);
      return { refinement: 'unavailable' };
    },
    graph: {
      outgoing: async () => {
        reconciliations += 1;
        return [];
      },
      ensureEdge: async (edge) => edge,
    },
    repository: { merge: async () => {} },
  });

  assert.deepEqual(await acquisition.refineExplorerReading(center), { refinement: 'unavailable' });
  assert.equal(reconciliations, 0);
});

test('Knowledge Acquisition preserves a semantic retry gate from Explorer source policy', async () => {
  const retry = deferred();
  const acquisition = createKnowledgeAcquisition({
    loadExplorer: async () => { throw new Error('rate limited'); },
    classifyExplorerFailure: () => ({ refinement: 'retryable', retry: retry.promise }),
    repository: { merge: async () => {} },
  });

  const outcome = await acquisition.refineExplorerReading(center);
  assert.equal(outcome.refinement, 'retryable');
  assert.equal(outcome.retry, retry.promise);
});

test('graph reconciliation failure after a usable Reading is not reclassified as source unavailability', async () => {
  const reconciliationFailure = new Error('graph persistence failed');
  let classifications = 0;
  const acquisition = createKnowledgeAcquisition({
    loadExplorer: async () => ({
      white: 10,
      draws: 0,
      black: 0,
      moves: [],
    }),
    classifyExplorerFailure: () => {
      classifications += 1;
      return { refinement: 'unavailable' };
    },
    graph: {
      outgoing: async () => { throw reconciliationFailure; },
      ensureEdge: async (edge) => edge,
    },
    repository: { merge: async () => {} },
  });

  await assert.rejects(acquisition.refineExplorerReading(center), reconciliationFailure);
  assert.equal(classifications, 0);
});
