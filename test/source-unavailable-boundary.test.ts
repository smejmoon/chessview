import assert from 'node:assert/strict';
import test from 'node:test';
import { createKnowledgeAcquisition } from '../src/knowledge-acquisition.ts';
import { canonicalPosition, START_FEN } from '../src/graph.ts';
import { obsoleteWork } from '../src/obsolete-work.ts';
import { sourceUnavailable } from '../src/source-unavailable.ts';

const CENTER = canonicalPosition(START_FEN);

test('Knowledge Acquisition maps only semantic source unavailability to refinement unavailability', async () => {
  const acquisition = createKnowledgeAcquisition({
    loadExplorer: async () => {
      throw sourceUnavailable('Explorer unavailable', new Error('offline'));
    },
  });

  assert.deepEqual(await acquisition.refineExplorerReading(CENTER), { refinement: 'unavailable' });
});

test('Knowledge Acquisition preserves non-source failures and cancellation', async () => {
  const graphFailure = new Error('unexpected provider contract failure');
  const failing = createKnowledgeAcquisition({
    loadExplorer: async () => { throw graphFailure; },
  });
  await assert.rejects(failing.refineExplorerReading(CENTER), (error) => error === graphFailure);

  const obsolete = obsoleteWork('old view');
  const cancelled = createKnowledgeAcquisition({
    loadExplorer: async () => { throw obsolete; },
  });
  await assert.rejects(cancelled.refineExplorerReading(CENTER), (error) => error === obsolete);
});
