import assert from 'node:assert/strict';
import test from 'node:test';
import { createNodusPresenter } from '../src/nodus-presenter.ts';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function flush(turns = 8) {
  for (let index = 0; index < turns; index += 1) await Promise.resolve();
}

function statusFixture() {
  const calls = [];
  let presentation = 'hidden';
  return {
    calls,
    start() { calls.push('start'); presentation = 'hidden'; },
    update() { calls.push('update'); },
    fail() { calls.push('fail'); presentation = 'failed'; },
    paint() { calls.push('paint'); },
    dispose() { calls.push('dispose'); },
    get presentation() { return presentation; },
  };
}

test('presenter converts a renderer failure into a degraded fallback without changing the view', async () => {
  const statusPresenter = statusFixture();
  const calls = [];
  const renderer = {
    render(view, actions, presentation) {
      calls.push(['render', view, actions, presentation]);
      throw new Error('board construction failed');
    },
    renderFailure(view, actions, error, presentation) {
      calls.push(['fallback', view, actions, error.message, presentation]);
    },
    dispose() { calls.push(['dispose']); },
  };
  const view = Object.freeze({ center: 'A', mode: 'roots', structure: Object.freeze({ status: 'ready' }) });
  const actions = Object.freeze({ redraw() {} });
  const presenter = createNodusPresenter({ renderer, statusPresenter });

  assert.equal(await presenter.start(view, actions), false);
  assert.deepEqual(statusPresenter.calls.slice(0, 2), ['start', 'fail']);
  assert.equal(calls[0][0], 'render');
  assert.equal(calls[1][0], 'fallback');
  assert.equal(calls[1][1], view);
  assert.equal(calls[1][4], 'failed');
  assert.equal(view.structure.status, 'ready');
});

test('presenter distinguishes lifecycle start from later updates', async () => {
  const statusPresenter = statusFixture();
  const renderer = {
    render() {},
    renderFailure() {},
  };
  const presenter = createNodusPresenter({ renderer, statusPresenter });
  const view = { center: 'A', mode: 'lines', structure: { status: 'loading' } };

  assert.equal(await presenter.start(view, {}), true);
  assert.equal(await presenter.update(view, {}), true);
  assert.deepEqual(statusPresenter.calls.filter((call) => call === 'start' || call === 'update'), ['start', 'update']);
});

test('fallback failure is not swallowed after normal rendering has failed', async () => {
  const statusPresenter = statusFixture();
  const renderer = {
    render() { throw new Error('render failed'); },
    renderFailure() { throw new Error('fallback failed'); },
  };
  const presenter = createNodusPresenter({ renderer, statusPresenter });

  await assert.rejects(
    presenter.update({ center: 'A', structure: { status: 'ready' } }, {}),
    /fallback failed/,
  );
});


test('stale passive Evidence cannot decorate a replacement Nodus', async () => {
  const first = deferred();
  const signals = [];
  const decorated = [];
  const renderer = {
    render() {},
    renderFailure() {},
    decorateEvidence(view, _actions, evidence) {
      decorated.push([view.center, evidence.position.evaluation]);
    },
  };
  const prepareEvidence = ({ center, signal }) => {
    signals.push([center, signal]);
    if (center === 'A') return first.promise;
    return Promise.resolve({ position: { evaluation: center }, moves: new Map() });
  };
  const presenter = createNodusPresenter({
    renderer,
    statusPresenter: statusFixture(),
    prepareEvidence,
  });

  await presenter.start({ center: 'A', mode: 'lines', structure: { status: 'loading' } }, {});
  await presenter.update({ center: 'B', mode: 'lines', structure: { status: 'loading' } }, {});
  await flush();

  assert.equal(signals[0][1].aborted, true);
  assert.deepEqual(decorated, [['B', 'B']]);

  first.resolve({ position: { evaluation: 'A' }, moves: new Map() });
  await flush();
  assert.deepEqual(decorated, [['B', 'B']]);
});

test('passive Evidence failure degrades annotations without failing the Nodus presentation', async () => {
  const failures = [];
  const statusPresenter = statusFixture();
  const renderer = {
    render() {},
    renderFailure() { throw new Error('whole-view fallback should not run'); },
    decorateEvidence() {},
    renderEvidenceFailure(error) { failures.push(error.message); },
  };
  const presenter = createNodusPresenter({
    renderer,
    statusPresenter,
    prepareEvidence: async () => { throw new Error('evidence unavailable'); },
  });

  assert.equal(await presenter.update({ center: 'A', mode: 'lines', structure: { status: 'ready' } }, {}), true);
  await flush();

  assert.deepEqual(failures, ['evidence unavailable']);
  assert.equal(statusPresenter.calls.includes('fail'), false);
});
