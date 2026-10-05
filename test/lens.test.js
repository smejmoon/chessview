import assert from 'node:assert/strict';
import test from 'node:test';
import { createLens } from '../src/lens.js';

function fixture() {
  let orientation = 'black';
  let guide = true;
  let debug = false;
  const writes = [];
  const map = { getBoundingClientRect: () => ({ width: 960, height: 620 }) };
  const app = {
    ownerDocument: { defaultView: { innerWidth: 1400, innerHeight: 900 } },
    querySelector(selector) { return selector === '#map' ? map : null; },
  };
  const preferences = {
    getOrientation: () => orientation,
    setOrientation(value) { orientation = value; writes.push(['orientation', value]); return value; },
    getGuide: () => guide,
    setGuide(value) { guide = value; writes.push(['guide', value]); return value; },
  };
  const debugState = {
    enabled: () => debug,
    setEnabled(value) { debug = Boolean(value); writes.push(['debug', debug]); return debug; },
  };
  return { lens: createLens({ app, preferences, debug: debugState }), writes };
}

test('Lens owns live presentation preferences and persists their changes', () => {
  const { lens, writes } = fixture();

  assert.equal(lens.orientation(), 'black');
  assert.equal(lens.flipOrientation(), 'white');
  assert.equal(lens.orientation(), 'white');
  assert.equal(lens.guideEnabled(), true);
  assert.equal(lens.toggleGuide(), false);
  assert.equal(lens.debugEnabled(), false);
  assert.equal(lens.toggleDebug(), true);

  assert.deepEqual(writes, [
    ['orientation', 'white'],
    ['guide', false],
    ['debug', true],
  ]);
});

test('Lens derives presentation geometry and composition constraints from the rendered map and mode', () => {
  const { lens } = fixture();

  const lines = lens.geometry('lines');
  const roots = lens.geometry('roots');
  assert.equal(lines.width, 960);
  assert.equal(lines.height, 620);
  assert.equal(lines.rootCapacity, 0);
  assert.ok(roots.rootCapacity > 0);
  assert.deepEqual(lens.constraints('lines'), {
    lineCapacity: lines.lineCapacity,
    rootCapacity: 0,
  });
  assert.deepEqual(lens.constraints('roots'), {
    lineCapacity: roots.lineCapacity,
    rootCapacity: roots.rootCapacity,
  });
});
