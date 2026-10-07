import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createLichessEvalStatusPresenter,
  lichessEvalStatusSpec,
} from '../src/lichess-eval-presentation.ts';

test('LichessEval status presentation is quiet when idle and visible while requesting', () => {
  assert.deepEqual(lichessEvalStatusSpec({ activity: 'idle', pending: 0, issue: null }), {
    text: 'Lichess · rated standard',
    title: 'Lichess rated-standard data source.',
    className: 'network-status',
  });

  assert.deepEqual(lichessEvalStatusSpec({ activity: 'requesting', pending: 3, issue: null }), {
    text: 'Lichess · loading engine data…',
    title: 'Requesting Lichess engine data for 3 positions.',
    className: 'network-status is-loading',
  });
});

test('LichessEval status presentation keeps provider issues separate from chess evidence', () => {
  assert.deepEqual(lichessEvalStatusSpec({
    activity: 'idle',
    pending: 0,
    issue: { kind: 'refresh-failed', fallback: 'cached' },
  }), {
    text: 'Lichess · cached engine data',
    title: 'Using cached engine data because the Lichess refresh failed.',
    className: 'network-status is-issue',
  });

  assert.deepEqual(lichessEvalStatusSpec({
    activity: 'requesting',
    pending: 1,
    issue: { kind: 'rate-limited' },
  }), {
    text: 'Lichess · rate limited',
    title: 'Lichess temporarily rate-limited engine requests. 1 engine request still in progress.',
    className: 'network-status is-issue is-loading',
  });

  assert.deepEqual(lichessEvalStatusSpec({
    activity: 'idle',
    pending: 0,
    issue: { kind: 'storage' },
  }), {
    text: 'Lichess · cache issue',
    title: 'Engine data was received, but Chessview could not update its local cache.',
    className: 'network-status is-issue',
  });
});

test('LichessEval status presenter contains renderer failures', () => {
  const logged = [];
  const presenter = createLichessEvalStatusPresenter({
    render: () => { throw new Error('renderer broke'); },
    log: (message, detail) => logged.push([message, detail]),
  });

  assert.equal(presenter.update({ activity: 'requesting', pending: 1, issue: null }), false);
  assert.equal(logged.length, 1);
  assert.equal(logged[0][0], 'LichessEval status presentation failed');
  assert.equal(logged[0][1].error, 'renderer broke');
});
