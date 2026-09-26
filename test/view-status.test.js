import assert from 'node:assert/strict';
import test from 'node:test';
import { createViewStatusPresenter } from '../src/view-status.js';

function fakeTimers() {
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeoutFn(fn, delay) {
      const id = nextId++;
      timers.set(id, { fn, delay });
      return id;
    },
    clearTimeoutFn(id) {
      timers.delete(id);
    },
    run(delay) {
      for (const [id, timer] of [...timers]) {
        if (timer.delay !== delay) continue;
        timers.delete(id);
        timer.fn();
      }
    },
  };
}

const view = (status) => ({ structure: { status } });

test('Updating is delayed and Ready fades to a persistent check', () => {
  const timers = fakeTimers();
  const presenter = createViewStatusPresenter({ ...timers });
  presenter.update(view('loading'));
  assert.equal(presenter.presentation, 'hidden');

  timers.run(180);
  assert.equal(presenter.presentation, 'updating');

  presenter.update(view('ready'));
  assert.equal(presenter.presentation, 'ready');

  timers.run(1_200);
  assert.equal(presenter.presentation, 'check');
});

test('fast structural settlement skips Updating but still acknowledges Ready', () => {
  const timers = fakeTimers();
  const presenter = createViewStatusPresenter({ ...timers });
  presenter.update(view('loading'));
  presenter.update(view('ready'));
  assert.equal(presenter.presentation, 'ready');

  timers.run(180);
  assert.equal(presenter.presentation, 'ready');
});

test('critical structure failure presents unavailable and cannot fade to success', () => {
  const timers = fakeTimers();
  const presenter = createViewStatusPresenter({ ...timers });
  presenter.update(view('loading'));
  timers.run(180);
  assert.equal(presenter.presentation, 'updating');

  presenter.update(view('failed'));
  assert.equal(presenter.presentation, 'failed');
  timers.run(1_200);
  assert.equal(presenter.presentation, 'failed');
});

test('supplementary view publications do not reset a settled structural acknowledgement', () => {
  const timers = fakeTimers();
  const presenter = createViewStatusPresenter({ ...timers });
  presenter.update(view('ready'));
  timers.run(1_200);
  assert.equal(presenter.presentation, 'check');

  presenter.update({ structure: { status: 'ready' }, evidence: { status: 'ready' } });
  assert.equal(presenter.presentation, 'check');
});

test('a later loading transition clears the previous check before delayed Updating', () => {
  const timers = fakeTimers();
  const presenter = createViewStatusPresenter({ ...timers });
  presenter.update(view('ready'));
  timers.run(1_200);
  assert.equal(presenter.presentation, 'check');

  presenter.update(view('loading'));
  assert.equal(presenter.presentation, 'hidden');
  timers.run(180);
  assert.equal(presenter.presentation, 'updating');
});
