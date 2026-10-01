import test from 'node:test';
import assert from 'node:assert/strict';

import { isNotableLine } from '../src/rail-selection.js';

test('Notable Line requires source evidence and keeps sufficiently sampled plausible moves', () => {
  assert.equal(isNotableLine({ edge: { manual: true } }), false);
  assert.equal(isNotableLine({
    edge: { uci: 'a1a2' },
    frequency: { games: 1000, share: 0.01 },
    engineQuality: { lossCp: 20, quality: 'strong' },
  }), true);
});

test('Notable Line keeps common moves despite known bad evidence', () => {
  assert.equal(isNotableLine({
    edge: { uci: 'a1a2' },
    frequency: { games: 1000, share: 0.04 },
    engineQuality: { lossCp: 120, quality: 'bad' },
  }), false);
  assert.equal(isNotableLine({
    edge: { uci: 'a1a2' },
    frequency: { games: 1000, share: 0.05 },
    engineQuality: { lossCp: 120, quality: 'bad' },
  }), true);
  assert.equal(isNotableLine({
    edge: { uci: 'a1a2' },
    frequency: { games: 1000, share: 0.04 },
    humanResult: { quality: 'unfavorable' },
  }), false);
});

test('Notable Line treats unknown quality as non-negative but still requires sample or prevalence', () => {
  assert.equal(isNotableLine({
    edge: { uci: 'a1a2' },
    frequency: { games: 1000, share: 0.01 },
  }), true);
  assert.equal(isNotableLine({
    edge: { uci: 'a1a2' },
    frequency: { games: 20, share: 0.01 },
  }), false);
});
