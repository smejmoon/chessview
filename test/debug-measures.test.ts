import assert from 'node:assert/strict';
import test from 'node:test';
import { debugMeasureGroups, debugMeasuresHtml } from '../src/debug-measures.ts';

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

test('Debug readout has visible explanations and accessible group/value semantics, not Weather announcements', () => {
  const html = debugMeasuresHtml(view());
  assert.equal((html.match(/class="debug-measure-group"/g) ?? []).length, 3);
  assert.equal((html.match(/class="debug-measure"/g) ?? []).length, 12);
  assert.match(html, /id="debug-measures" role="region" tabindex="0"/);
  assert.match(html, /aria-labelledby="debug-measure-group-0"/);
  assert.match(html, /<h3 id="debug-measure-group-1">FrontierWork<\/h3>/);
  assert.match(html, /Incorporation pending<\/dt><dd>1<\/dd>/);
  assert.match(html, /not that chess evidence is absent/);
  assert.doesNotMatch(html, /aria-live|role="status"|id="view-status"/);
});

test('Debug escapes unexpected lifecycle values and keeps missing counters neutral', () => {
  const html = debugMeasuresHtml({ weather: { structure: '<img src=x>' } });
  assert.match(html, /&lt;img src=x&gt;/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /Reading frontier<\/dt><dd>0<\/dd>/);
});
