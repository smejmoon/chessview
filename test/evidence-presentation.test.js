import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evidenceRequestFailed,
  engineUnavailableLabel,
  humanFailureIndicator,
} from '../src/evidence-presentation.js';

const failed = { requestFailed: true, status: 503, message: 'unavailable' };

test('presentation state distinguishes request failure from missing evidence', () => {
  assert.equal(evidenceRequestFailed(failed), true);
  assert.equal(evidenceRequestFailed(null), false);
  assert.equal(engineUnavailableLabel([failed]), 'eval request failed');
  assert.equal(engineUnavailableLabel([null]), 'eval unavailable');
});

test('human evidence exposes a distinct request-failure indicator', () => {
  assert.deepEqual(humanFailureIndicator(failed, 'Masters'), {
    text: '!',
    title: 'Masters evidence request failed',
  });
  assert.equal(humanFailureIndicator(null, 'Masters'), null);
});
