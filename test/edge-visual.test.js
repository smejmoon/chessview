import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EDGE_MAX_WIDTH,
  EDGE_MIN_WIDTH,
  edgeStrokeWidth,
} from '../src/edge-visual.js';

test('connector width is proportional to visible relationship game count', () => {
  assert.equal(edgeStrokeWidth(0, 1000), EDGE_MIN_WIDTH);
  assert.equal(edgeStrokeWidth(1000, 1000), EDGE_MAX_WIDTH);
  assert.equal(edgeStrokeWidth(500, 1000), EDGE_MAX_WIDTH * 0.5);
  assert.equal(edgeStrokeWidth(250, 1000), EDGE_MAX_WIDTH * 0.25);
  assert.ok(edgeStrokeWidth(700, 1000) > edgeStrokeWidth(300, 1000));
});

test('connector width keeps a visible floor and clamps invalid counts', () => {
  assert.equal(edgeStrokeWidth(undefined, 1000), EDGE_MIN_WIDTH);
  assert.equal(edgeStrokeWidth(-1, 1000), EDGE_MIN_WIDTH);
  assert.equal(edgeStrokeWidth(100, undefined), EDGE_MIN_WIDTH);
  assert.equal(edgeStrokeWidth(2000, 1000), EDGE_MAX_WIDTH);
});
