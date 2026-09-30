import test from 'node:test';
import assert from 'node:assert/strict';

import { railWorthy } from '../src/rail-selection.js';

test('Rail keeps manual and sufficiently sampled plausible moves', () => {
  assert.equal(railWorthy({ edge: { manual: true } }), true);
  assert.equal(railWorthy({
    edge: { uci: 'a1a2' },
    frequency: { games: 1000, share: 0.01 },
    engineQuality: { lossCp: 20, quality: 'strong' },
  }), true);
});

test('Rail suppresses known bad evidence unless the move is at least five percent popular', () => {
  assert.equal(railWorthy({
    edge: { uci: 'a1a2' },
    frequency: { games: 1000, share: 0.04 },
    engineQuality: { lossCp: 120, quality: 'bad' },
  }), false);
  assert.equal(railWorthy({
    edge: { uci: 'a1a2' },
    frequency: { games: 1000, share: 0.05 },
    engineQuality: { lossCp: 120, quality: 'bad' },
  }), true);
  assert.equal(railWorthy({
    edge: { uci: 'a1a2' },
    frequency: { games: 1000, share: 0.04 },
    humanResult: { quality: 'unfavorable' },
  }), false);
});

test('unknown quality is not negative evidence but automatic Rail still requires sample or popularity', () => {
  assert.equal(railWorthy({
    edge: { uci: 'a1a2' },
    frequency: { games: 1000, share: 0.01 },
  }), true);
  assert.equal(railWorthy({
    edge: { uci: 'a1a2' },
    frequency: { games: 20, share: 0.01 },
  }), false);
});
