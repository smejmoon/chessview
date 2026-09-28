import test from 'node:test';
import assert from 'node:assert/strict';
import { pagesTarget } from '../scripts/pages-target.js';
import { resetPagesPlan } from '../scripts/pages-reset-plan.js';

test('reset plan keeps main first and rebuilds each live non-gh-pages branch once', () => {
  const plan = resetPagesPlan(['momo', 'gh-pages', 'main', 'koko', 'momo']);

  assert.deepEqual(plan, [
    { branch: 'main', ...pagesTarget('main') },
    { branch: 'koko', ...pagesTarget('koko') },
    { branch: 'momo', ...pagesTarget('momo') },
  ]);
});

test('reset plan uses the canonical preview target for branch names that need normalization', () => {
  assert.deepEqual(resetPagesPlan(['main', 'feature/a']), [
    { branch: 'main', ...pagesTarget('main') },
    { branch: 'feature/a', ...pagesTarget('feature/a') },
  ]);
});

test('reset plan requires the production branch', () => {
  assert.throws(() => resetPagesPlan(['koko']), /main branch is required/);
});
