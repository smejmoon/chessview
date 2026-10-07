import assert from 'node:assert/strict';
import test from 'node:test';
import { createNodusPresenter } from '../src/nodus-presenter.ts';

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
