import assert from 'node:assert/strict';
import test from 'node:test';
import { isObsoleteWork, obsoleteWork } from '../src/obsolete-work.ts';
import { canonicalPosition, START_FEN } from '../src/graph.ts';
import { discoverSampledPredecessors } from '../src/sampled-predecessors.ts';
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

test('Root discovery converts malformed successful game export to unavailable-for-this-run', async () => {
  const reading = {
    white: 1,
    draws: 0,
    black: 0,
    moves: [],
    topGames: [{ id: 'abcdefgh' }],
  };
  const outcome = await discoverRootPredecessors(canonicalPosition(START_FEN), work(), {
    loadExplorer: async () => reading,
    discoverPredecessors: (center, ids, demand) => discoverSampledPredecessors(center, ids, {
      ...demand,
      request: async () => ({
        ok: true,
        status: 200,
        text: async () => '{"id":"abcdefgh","moves":',
      }),
    }),
    log: () => {},
  });
  assert.deepEqual(outcome, { refinement: 'unavailable' });
});

test('Root discovery preserves own-signal cancellation before reconciling sampled nominations', async () => {
  const controller = new AbortController();
  const reading = {
    white: 1,
    draws: 0,
    black: 0,
    moves: [],
    topGames: [{ id: 'abcdefgh' }],
  };
  let refinements = 0;
  const result = discoverRootPredecessors('position', {
    signal: controller.signal,
    urgency: () => 'foreground' as const,
  }, {
    loadExplorer: async () => reading,
    discoverPredecessors: async () => {
      controller.abort();
      return [{ source: 'predecessor', uci: 'e2e4', gameId: 'abcdefgh' }];
    },
    refineExplorer: async () => {
      refinements += 1;
      return { refinement: 'satisfied' as const };
    },
    log: () => {},
  });
  await assert.rejects(result, (error) => isObsoleteWork(error));
  assert.equal(refinements, 0);
});
