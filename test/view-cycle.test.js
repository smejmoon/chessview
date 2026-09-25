import test from 'node:test';
import assert from 'node:assert/strict';
import { createViewCycleController } from '../src/view-cycle.js';

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

test('view cycle settles only after the latest token for every visible contributor', () => {
  const timers = fakeTimers();
  const cycle = createViewCycleController({ ...timers });
  const id = cycle.start(['render', 'evidence', 'structure']);
  const render = cycle.begin(id, 'render');
  const evidence1 = cycle.begin(id, 'evidence');
  const structure = cycle.begin(id, 'structure');

  cycle.settle(id, 'render', render);
  cycle.settle(id, 'structure', structure);

  const evidence2 = cycle.begin(id, 'evidence');
  assert.equal(cycle.settle(id, 'evidence', evidence1), false);
  assert.deepEqual(cycle.snapshot().pending, ['evidence']);

  assert.equal(cycle.settle(id, 'evidence', evidence2), true);
  assert.equal(cycle.presentation, 'ready');
});

test('completion from an obsolete generation cannot settle the current view', () => {
  const timers = fakeTimers();
  const cycle = createViewCycleController({ ...timers });
  const oldId = cycle.start(['render']);
  const oldRender = cycle.begin(oldId, 'render');

  const currentId = cycle.start(['render']);
  const currentRender = cycle.begin(currentId, 'render');

  assert.equal(cycle.settle(oldId, 'render', oldRender), false);
  assert.deepEqual(cycle.snapshot().pending, ['render']);
  assert.equal(cycle.settle(currentId, 'render', currentRender), true);
});

test('updating is delayed and Ready fades to a persistent check', () => {
  const timers = fakeTimers();
  const presentations = [];
  const cycle = createViewCycleController({
    ...timers,
    updatingDelayMs: 180,
    readyHoldMs: 1_200,
    onPresentation: ({ presentation }) => presentations.push(presentation),
  });

  const id = cycle.start(['render']);
  const render = cycle.begin(id, 'render');
  assert.equal(cycle.presentation, 'hidden');

  timers.run(180);
  assert.equal(cycle.presentation, 'updating');

  cycle.settle(id, 'render', render);
  assert.equal(cycle.presentation, 'ready');

  timers.run(1_200);
  assert.equal(cycle.presentation, 'check');
  assert.deepEqual(presentations, ['updating', 'ready', 'check']);
});

test('fast cached work skips Updating while still acknowledging Ready', () => {
  const timers = fakeTimers();
  const cycle = createViewCycleController({ ...timers });
  const id = cycle.start(['render']);
  const render = cycle.begin(id, 'render');

  cycle.settle(id, 'render', render);
  assert.equal(cycle.presentation, 'ready');

  timers.run(180);
  assert.equal(cycle.presentation, 'ready');
});

test('later visible work can reopen the same navigation cycle', () => {
  const timers = fakeTimers();
  const cycle = createViewCycleController({ ...timers });
  const id = cycle.start(['render']);
  const firstRender = cycle.begin(id, 'render');
  cycle.settle(id, 'render', firstRender);
  timers.run(1_200);
  assert.equal(cycle.presentation, 'check');

  const nextRender = cycle.begin(id, 'render');
  assert.equal(cycle.presentation, 'check');
  timers.run(180);
  assert.equal(cycle.presentation, 'updating');

  cycle.settle(id, 'render', nextRender);
  assert.equal(cycle.presentation, 'ready');
});
