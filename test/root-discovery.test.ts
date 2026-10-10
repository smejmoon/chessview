import assert from 'node:assert/strict';
import test from 'node:test';
import { obsoleteWork } from '../src/obsolete-work.ts';
import { sourceUnavailable } from '../src/source-unavailable.ts';
import { discoverRootPredecessors } from '../src/root-discovery.ts';

function work() {
  const controller = new AbortController();
  return Object.freeze({
    signal: controller.signal,
    urgency: () => 'foreground' as const,
  });
}

test('Root discovery maps provider-classified Explorer unavailability to unavailable-for-this-run', async () => {
  let exported = false;
  const outcome = await discoverRootPredecessors('position', work(), {
    loadExplorer: async () => {
      throw sourceUnavailable('Explorer unavailable', Object.assign(new Error('rate limited'), { status: 429 }));
    },
    discoverPredecessors: async () => {
      exported = true;
      return [];
    },
    log: () => {},
  });

  assert.deepEqual(outcome, { refinement: 'unavailable' });
  assert.equal(exported, false);
});

test('Root discovery preserves obsolete Explorer cancellation instead of reporting unavailability', async () => {
  const obsolete = obsoleteWork('old view');
  await assert.rejects(
    discoverRootPredecessors('position', work(), {
      loadExplorer: async () => { throw obsolete; },
      log: () => {},
    }),
    (error) => error === obsolete,
  );
});


test('Root discovery maps sampled-game source unavailability to unavailable-for-this-run', async () => {
  const reading = {
    white: 1,
    draws: 0,
    black: 0,
    moves: [],
    topGames: [{ id: 'abcdefgh' }],
  };
  const outcome = await discoverRootPredecessors('position', work(), {
    loadExplorer: async () => reading,
    discoverPredecessors: async () => {
      throw sourceUnavailable('sample export unavailable', Object.assign(new Error('rate limited'), { status: 429 }));
    },
    log: () => {},
  });

  assert.deepEqual(outcome, { refinement: 'unavailable' });
});
