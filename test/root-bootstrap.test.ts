import assert from 'node:assert/strict';
import test from 'node:test';
import { Chess } from 'chess.js';
import { canonicalPosition } from '../src/graph.ts';
import { createExplorerRefinementFailureClassifier } from '../src/explorer-refinement.ts';
import { obsoleteWork } from '../src/obsolete-work.ts';
import {
  discoverRootPredecessors,
  discoverSampledPredecessors,
  sampleGameIds,
} from '../src/root-bootstrap.ts';

function positionAfter(moves) {
  const chess = new Chess();
  for (const move of moves) chess.move(move);
  return canonicalPosition(chess.fen());
}

test('sample game ids preserve top then recent order and deduplicate', () => {
  assert.deepEqual(sampleGameIds({
    topGames: [{ id: 'abcdefgh' }, { id: 'ijklmnop' }],
    recentGames: [{ id: 'abcdefgh' }, { id: 'qrstuvwx' }],
  }), ['abcdefgh', 'ijklmnop', 'qrstuvwx']);
});

test('sampled games nominate the observed move immediately before the exact Nodus', async () => {
  const target = positionAfter(['e4', 'c5', 'Nf3']);
  let request = null;
  const nominations = await discoverSampledPredecessors(target, ['abcdefgh', 'ijklmnop'], {
    request: async (input, init) => {
      request = { input, init };
      return {
        ok: true,
        status: 200,
        text: async () => [
          JSON.stringify({ id: 'abcdefgh', moves: 'e4 c5 Nf3 d6' }),
          JSON.stringify({ id: 'ijklmnop', moves: 'e4 c5 Nf3 Nc6' }),
        ].join('\n'),
      };
    },
  });

  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.body, 'abcdefgh,ijklmnop');
  assert.equal(nominations.length, 1);
  assert.equal(nominations[0].source, positionAfter(['e4', 'c5']));
  assert.equal(nominations[0].uci, 'g1f3');
});

test('sampled game that never reaches the canonical Nodus nominates nothing', async () => {
  const target = positionAfter(['d4', 'd5']);
  const nominations = await discoverSampledPredecessors(target, ['abcdefgh'], {
    request: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 'abcdefgh', moves: 'e4 e5' }),
    }),
  });
  assert.deepEqual(nominations, []);
});


test('sampled-game replay honors an exported initial FEN', async () => {
  const initial = '8/8/8/8/8/4k3/4P3/4K3 w - - 0 1';
  const chess = new Chess(initial);
  chess.move('Kf1');
  const target = canonicalPosition(chess.fen());

  const nominations = await discoverSampledPredecessors(target, ['abcdefgh'], {
    request: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        id: 'abcdefgh',
        initialFen: initial,
        moves: 'Kf1',
      }),
    }),
  });

  assert.equal(nominations.length, 1);
  assert.equal(nominations[0].source, canonicalPosition(initial));
  assert.equal(nominations[0].uci, 'e1f1');
});

test('Root bootstrap verifies each sampled source through ordinary Explorer refinement', async () => {
  const signal = new AbortController().signal;
  const priority = () => 'foreground';
  const calls = [];
  const outcome = await discoverRootPredecessors('Nodus', { signal, priority }, {
    load: async (center, work) => {
      calls.push(['load', center, work]);
      return { topGames: [{ id: 'abcdefgh' }, { id: 'abcdefgh' }], recentGames: [{ id: 'ijklmnop' }] };
    },
    discover: async (center, ids, work) => {
      calls.push(['discover', center, ids, work]);
      return [
        { source: 'source1', uci: 'e2e4', gameId: 'abcdefgh' },
        { source: 'source2', uci: 'd2d4', gameId: 'ijklmnop' },
      ];
    },
    refine: async (source, work) => {
      calls.push(['refine', source, work]);
      return { refinement: source === 'source1' ? 'unavailable' : 'satisfied' };
    },
  });
  assert.deepEqual(outcome, { refinement: 'unavailable' });
  assert.deepEqual(calls.map(([kind, position]) => [kind, position]), [
    ['load', 'Nodus'], ['discover', 'Nodus'], ['refine', 'source1'], ['refine', 'source2'],
  ]);
  assert.deepEqual(calls[1][2], ['abcdefgh', 'ijklmnop']);
  for (const call of calls) {
    const work = call[0] === 'discover' ? call[3] : call[2];
    assert.equal(work.signal, signal);
    assert.equal(work.priority, priority);
  }
});

test('Root bootstrap without representative games does no export or reconciliation', async () => {
  const signal = new AbortController().signal;
  const outcome = await discoverRootPredecessors('Nodus', { signal, priority: 'foreground' }, {
    load: async () => ({ topGames: [], recentGames: [] }),
    discover: async () => { throw new Error('unexpected export'); },
    refine: async () => { throw new Error('unexpected reconciliation'); },
  });
  assert.deepEqual(outcome, { refinement: 'satisfied' });
});

test('Root bootstrap forwards a retry gate and stops refining further sources', async () => {
  const signal = new AbortController().signal;
  const gate = Promise.resolve();
  const retryable = { refinement: 'retryable', retry: gate };
  const refined = [];
  const outcome = await discoverRootPredecessors('Nodus', { signal, priority: 'foreground' }, {
    load: async () => ({ topGames: [{ id: 'abcdefgh' }] }),
    discover: async () => [
      { source: 'source1', uci: 'e2e4', gameId: 'abcdefgh' },
      { source: 'source2', uci: 'd2d4', gameId: 'abcdefgh' },
    ],
    refine: async (source) => { refined.push(source); return retryable; },
  });
  assert.equal(outcome, retryable);
  assert.deepEqual(refined, ['source1']);
});

test('Root bootstrap stops before reconciliation if its view becomes obsolete', async () => {
  const controller = new AbortController();
  const outcome = await discoverRootPredecessors('Nodus', { signal: controller.signal, priority: 'foreground' }, {
    load: async () => ({ topGames: [{ id: 'abcdefgh' }] }),
    discover: async () => {
      controller.abort();
      return [{ source: 'source1', uci: 'e2e4', gameId: 'abcdefgh' }];
    },
    refine: async () => { throw new Error('obsolete work must not reconcile'); },
  });
  assert.deepEqual(outcome, { refinement: 'unavailable' });
});

test('Root bootstrap propagates export and reconciliation failures without inventing source absence', async () => {
  const signal = new AbortController().signal;
  const work = { signal, priority: 'foreground' };
  const load = async () => ({ topGames: [{ id: 'abcdefgh' }] });
  await assert.rejects(
    discoverRootPredecessors('Nodus', work, {
      load,
      discover: async () => { throw new Error('export failed'); },
    }),
    /export failed/,
  );
  await assert.rejects(
    discoverRootPredecessors('Nodus', work, {
      load,
      discover: async () => [{ source: 'source1', uci: 'e2e4', gameId: 'abcdefgh' }],
      refine: async () => { throw new Error('graph persistence failed'); },
    }),
    /graph persistence failed/,
  );
});

test('Root bootstrap waits for the Explorer-owned retry gate when its center Reading is rate-limited', async () => {
  const signal = new AbortController().signal;
  let wake;
  const gate = new Promise((resolve) => { wake = resolve; });
  let loads = 0;
  let exports = 0;
  const classifyLoadFailure = createExplorerRefinementFailureClassifier({
    cooldownUntil: () => 5_000,
    now: () => 1_000,
    sleep: (delay) => {
      assert.equal(delay, 4_000);
      return gate;
    },
  });
  const work = { signal, priority: 'foreground' };
  const dependencies = {
    load: async () => {
      loads++;
      if (loads === 1) throw Object.assign(new Error('Too many requests'), { status: 429 });
      return { topGames: [], recentGames: [] };
    },
    classifyLoadFailure,
    discover: async () => { exports++; return []; },
  };

  const first = await discoverRootPredecessors('Nodus', work, dependencies);
  assert.equal(first.refinement, 'retryable');
  assert.strictEqual(first.retry, gate);
  assert.equal(loads, 1);
  assert.equal(exports, 0);
  wake();
  await first.retry;
  assert.deepEqual(await discoverRootPredecessors('Nodus', work, dependencies), { refinement: 'satisfied' });
  assert.equal(loads, 2);
  assert.equal(exports, 0);
});

test('Root bootstrap classifies exhausted center acquisition as unavailable', async () => {
  const outcome = await discoverRootPredecessors('Nodus', {
    signal: new AbortController().signal,
    priority: 'foreground',
  }, {
    load: async () => { throw Object.assign(new Error('Too many requests'), { status: 429 }); },
    classifyLoadFailure: createExplorerRefinementFailureClassifier({
      cooldownUntil: () => 1_000,
      now: () => 1_000,
    }),
    discover: async () => { throw new Error('export must not start'); },
  });
  assert.deepEqual(outcome, { refinement: 'unavailable' });
});

test('Root bootstrap propagates cancellation during center Explorer acquisition', async () => {
  const aborted = obsoleteWork('old view');
  await assert.rejects(discoverRootPredecessors('Nodus', {
    signal: new AbortController().signal,
    priority: 'foreground',
  }, {
    load: async () => { throw aborted; },
    discover: async () => { throw new Error('export must not start'); },
  }), (error) => error === aborted);
});
