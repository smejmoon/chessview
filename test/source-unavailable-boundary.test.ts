import assert from 'node:assert/strict';
import test from 'node:test';
import { createKnowledgeAcquisition } from '../src/knowledge-acquisition.ts';
import { obsoleteWork } from '../src/obsolete-work.ts';
import { sourceUnavailable } from '../src/source-unavailable.ts';

test('Knowledge Acquisition maps only semantic source unavailability to refinement unavailability', async () => {
  const acquisition = createKnowledgeAcquisition({
    loadExplorer: async () => {
      throw sourceUnavailable('Explorer unavailable', new Error('offline'));
    },
  });

  assert.deepEqual(await acquisition.refineExplorerReading('position'), { refinement: 'unavailable' });
});

test('Knowledge Acquisition preserves non-source failures and cancellation', async () => {
  const graphFailure = new Error('unexpected provider contract failure');
  const failing = createKnowledgeAcquisition({
    loadExplorer: async () => { throw graphFailure; },
  });
  await assert.rejects(failing.refineExplorerReading('position'), (error) => error === graphFailure);

  const obsolete = obsoleteWork('old view');
  const cancelled = createKnowledgeAcquisition({
    loadExplorer: async () => { throw obsolete; },
  });
  await assert.rejects(cancelled.refineExplorerReading('position'), (error) => error === obsolete);
});
