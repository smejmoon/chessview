import test from 'node:test';
import assert from 'node:assert/strict';
import { CONSTELLATION_LOOKAHEAD_LIMIT } from '../src/config.ts';
import { nominateConstellationLookahead } from '../src/constellation-lookahead.js';

test('Constellation lookahead default limit comes from typed configuration', () => {
  const nodes = Array.from(
    { length: CONSTELLATION_LOOKAHEAD_LIMIT + 2 },
    (_, index) => ({ key: `P${index}` }),
  );

  const nominations = nominateConstellationLookahead({
    center: 'CENTER',
    structure: { composition: { nodes } },
  });

  assert.equal(nominations.length, CONSTELLATION_LOOKAHEAD_LIMIT);
  assert.deepEqual(
    nominations,
    nodes.slice(0, CONSTELLATION_LOOKAHEAD_LIMIT).map((node) => node.key),
  );
});
