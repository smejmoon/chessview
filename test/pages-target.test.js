import test from 'node:test';
import assert from 'node:assert/strict';
import { pagesTarget, previewSlug } from '../scripts/pages-target.js';

test('main keeps the production Pages target', () => {
  assert.deepEqual(pagesTarget('main'), {
    base: '/chessview/',
    target: '.',
  });
});

test('distinct branches that used to collide get distinct preview slugs', () => {
  const slashBranch = previewSlug('a/b');
  const safeBranch = previewSlug('a-b-c14cddc0');

  assert.notEqual(slashBranch, safeBranch);
  assert.match(slashBranch, /^a-b-[0-9a-f]{16}$/);
  assert.match(safeBranch, /^a-b-c14cddc0-[0-9a-f]{16}$/);
});

test('every non-main branch includes a hash of the full branch name', () => {
  const slug = previewSlug('pages-previews');
  assert.match(slug, /^pages-previews-[0-9a-f]{16}$/);
});

test('long valid refs stay within a bounded preview path component', () => {
  const branch = `${'a'.repeat(200)}/${'b'.repeat(200)}`;
  const slug = previewSlug(branch);
  const { base, target } = pagesTarget(branch);

  assert.equal(slug.includes('/'), false);
  assert.ok(slug.length <= 81);
  assert.equal(target, `previews/${slug}`);
  assert.equal(base, `/chessview/previews/${slug}/`);
});
