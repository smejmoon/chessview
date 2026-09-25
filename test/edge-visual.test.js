import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LINE_EDGE_MAX_WIDTH,
  LINE_EDGE_MIN_WIDTH,
  lineStrokeWidth,
} from '../src/edge-visual.js';

test('Line connector width grows monotonically with first-move share', () => {
  assert.equal(lineStrokeWidth(0), LINE_EDGE_MIN_WIDTH);
  assert.equal(lineStrokeWidth(1), LINE_EDGE_MAX_WIDTH);
  assert.equal(lineStrokeWidth(0.25), 2.75);
  assert.ok(lineStrokeWidth(0.45) > lineStrokeWidth(0.15));
});

test('Line connector width clamps missing and out-of-range shares', () => {
  assert.equal(lineStrokeWidth(undefined), LINE_EDGE_MIN_WIDTH);
  assert.equal(lineStrokeWidth(-1), LINE_EDGE_MIN_WIDTH);
  assert.equal(lineStrokeWidth(2), LINE_EDGE_MAX_WIDTH);
});
