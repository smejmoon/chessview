import assert from 'node:assert/strict';
import test from 'node:test';
import { debugTopbarHtml, debugTopbarValuesHtml, debugMeasureGroups } from '../src/debug-measures.ts';

function view() {
  return {
    settling: true,
    structure: { status: 'ready' },
    weather: {
      structure: 'ready',
      frontier: 3,
      structural: {
        working: 1, satisfied: 2, incorporationPending: 1, unavailable: 1,
        failed: 4, unplanned: 5, detached: 6,
      },
      supplementary: { active: 2, total: 5 },
    },
  };
}

test('Debug presents the published Current View measures in three independent groups', () => {
  const groups = debugMeasureGroups(view());
  assert.deepEqual(groups.map((group) => group.name), [
    'ConstellationState', 'FrontierWork', 'EnrichmentFlow',
  ]);
  assert.deepEqual(groups.map((group) => group.measures.map((m) => [m.name, m.value])), [
    [['Map', 'ready'], ['Settling', 'yes'], ['Reading frontier', '3']],
    [
      ['Working', '1'], ['Satisfied', '2'], ['Incorporation pending', '1'],
      ['Unavailable', '1'], ['Failed', '4'], ['Unplanned', '5'], ['Detached', '6'],
    ],
    [['Active', '2'], ['Total', '5']],
  ]);
  assert.notEqual(groups[1].measures[1].value, groups[1].measures[2].value);
});

test('topbar Debug displays 9 icon/count pairs with detailed titles', () => {
  const html = debugTopbarHtml(view(), true);
  assert.match(html, /id="topbar-debug-observations"/);
  assert.match(html, /Map<\/span><strong>ready<\/strong>/);
  assert.match(html, /Settling<\/span><strong>yes<\/strong>/);
  assert.match(html, /Frontier<\/span><strong>3<\/strong>/);
  assert.equal((html.match(/class="topbar-debug-metric"/g) ?? []).length, 9);
  assert.equal((html.match(/class="topbar-debug-group"/g) ?? []).length, 2);
  assert.match(html, /aria-label="Structural work"/);
  assert.match(html, /aria-label="Supplementary work"/);
  assert.match(html, /data-debug-metric="Structural:Incorporation pending"/);
  assert.match(html, /title="Structural — Incorporation pending: 1\./);
  assert.match(html, /title="Structural — Unavailable: 1\. Source acquisition could not complete/);
  assert.match(html, /title="Supplementary — Total: 5\./);
  assert.match(html, /tabindex="0" title="Structural/);
  assert.doesNotMatch(html, /ConstellationState|FrontierWork|EnrichmentFlow|aria-live|role="status"/);
  assert.match(debugTopbarHtml(view(), false), /tabindex="0" hidden>/);
});

test('topbar counts escape unexpected lifecycle values and default absent values to zero', () => {
  const html = debugTopbarValuesHtml({ weather: { structure: '<img src=x>' } });
  assert.match(html, /&lt;img src=x&gt;/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /Frontier<\/span><strong>0<\/strong>/);
  assert.equal((html.match(/class="topbar-debug-metric"/g) ?? []).length, 9);
  assert.match(html, /aria-label="Supplementary — Active: 0\./);
});
