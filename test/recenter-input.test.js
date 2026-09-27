import test from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN } from '../src/graph.js';
import {
  bindRecenterTarget,
  createBoardMoveRecenterHandler,
  promotionChoices,
} from '../src/recenter-input.js';

function fakeElement() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) { listeners.set(type, listener); },
    emit(type) { return listeners.get(type)?.(); },
  };
}

test('target click maps presentation intent to recenter target', async () => {
  const calls = [];
  const element = fakeElement();
  bindRecenterTarget(element, {
    recenter(request) { calls.push(request); return true; },
  }, 'target-position');

  await element.emit('click');
  assert.deepEqual(calls, [{ target: 'target-position' }]);
});

test('ordinary board move maps to recenter move without invented promotion', async () => {
  const calls = [];
  const handler = createBoardMoveRecenterHandler({
    source: START_FEN,
    actions: {
      recenter(request) { calls.push(request); return true; },
    },
  });

  assert.equal(await handler('e2', 'e4'), true);
  assert.deepEqual(calls, [{ move: { from: 'e2', to: 'e4' } }]);
});

test('promotion move requires and preserves the selected promotion piece', async () => {
  const source = 'k7/4P3/8/8/8/8/8/7K w - - 0 1';
  const calls = [];
  const seenChoices = [];
  const handler = createBoardMoveRecenterHandler({
    source,
    actions: {
      recenter(request) { calls.push(request); return true; },
    },
    choosePromotion(choices, context) {
      seenChoices.push([choices, context]);
      return 'n';
    },
  });

  assert.deepEqual(promotionChoices(source, 'e7', 'e8'), ['q', 'r', 'b', 'n']);
  assert.equal(await handler('e7', 'e8'), true);
  assert.deepEqual(seenChoices, [[['q', 'r', 'b', 'n'], { from: 'e7', to: 'e8' }]]);
  assert.deepEqual(calls, [{ move: { from: 'e7', to: 'e8', promotion: 'n' } }]);
});

test('cancelled promotion redraws the current view without recentering', async () => {
  const calls = [];
  const source = 'k7/4P3/8/8/8/8/8/7K w - - 0 1';
  const handler = createBoardMoveRecenterHandler({
    source,
    actions: {
      recenter(request) { calls.push(['recenter', request]); return true; },
      redraw() { calls.push(['redraw']); return true; },
    },
    choosePromotion() { return null; },
  });

  assert.equal(await handler('e7', 'e8'), false);
  assert.deepEqual(calls, [['redraw']]);
});
