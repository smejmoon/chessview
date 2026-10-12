// Read-only Debug presentation of the aggregate Current View snapshot.
// Current View alone owns structural readiness and participation accounting.
type DebugMeasureView = Readonly<{
  settling?: boolean;
  structure?: Readonly<{ status?: string }>;
  weather?: Readonly<{
    structure?: string;
    frontier?: number;
    structural?: Readonly<{
      working?: number;
      satisfied?: number;
      incorporationPending?: number;
      unavailable?: number;
      failed?: number;
      unplanned?: number;
      detached?: number;
    }>;
    supplementary?: Readonly<{ active?: number; total?: number }>;
  }>;
}>;

type Measure = Readonly<{ name: string; value: string }>;
type Group = Readonly<{ name: string; explanation: string; measures: readonly Measure[] }>;

function finiteCount(value?: number): string {
  return String(typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0);
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function debugMeasureGroups(view: DebugMeasureView): readonly Group[] {
  const weather = view?.weather;
  const work = weather?.structural;
  const supplementary = weather?.supplementary;
  return [
    {
      name: 'ConstellationState',
      explanation: 'Accepted map lifecycle, structural settlement, and Explorer Reading obligations admitted by the current Constellation.',
      measures: [
        { name: 'Map', value: weather?.structure ?? view?.structure?.status ?? 'idle' },
        { name: 'Settling', value: view?.settling === true ? 'yes' : 'no' },
        { name: 'Reading frontier', value: finiteCount(weather?.frontier) },
      ],
    },
    {
      name: 'FrontierWork',
      explanation: 'Current-run structural coordination. Satisfied can outlive incorporation; unavailable means source acquisition could not complete, not that chess evidence is absent. Failed, unplanned, and detached do not themselves imply ongoing progress.',
      measures: [
        { name: 'Working', value: finiteCount(work?.working) },
        { name: 'Satisfied', value: finiteCount(work?.satisfied) },
        { name: 'Incorporation pending', value: finiteCount(work?.incorporationPending) },
        { name: 'Unavailable', value: finiteCount(work?.unavailable) },
        { name: 'Failed', value: finiteCount(work?.failed) },
        { name: 'Unplanned', value: finiteCount(work?.unplanned) },
        { name: 'Detached', value: finiteCount(work?.detached) },
      ],
    },
    {
      name: 'EnrichmentFlow',
      explanation: 'Supplementary participants enrich the view; they do not block structural readiness. Lookahead work is not included here.',
      measures: [
        { name: 'Active', value: finiteCount(supplementary?.active) },
        { name: 'Total', value: finiteCount(supplementary?.total) },
      ],
    },
  ];
}

// Development-only observations in the app shell, not Weather's live region.
export function constellationStateValuesHtml(view: DebugMeasureView): string {
  const group = debugMeasureGroups(view)[0];
  return '<strong class="topbar-constellation-label">' + escapeHtml(group.name) + '</strong>'
    + group.measures.map((measure) => (
      '<span class="topbar-constellation-measure"><span>' + escapeHtml(measure.name)
      + '</span><strong>' + escapeHtml(measure.value) + '</strong></span>'
    )).join('');
}

export function constellationStateTopbarHtml(view: DebugMeasureView, enabled: boolean): string {
  return '<div class="topbar-constellation-state" id="topbar-constellation-state"'
    + ' role="group" aria-label="ConstellationState measurements" tabindex="0"'
    + (enabled ? '' : ' hidden') + '>'
    + constellationStateValuesHtml(view) + '</div>';
}

export function debugMeasuresHtml(view: DebugMeasureView): string {
  return '<div class="debug-measures" id="debug-measures" role="region" tabindex="0" aria-label="Current View measurements">'
    + debugMeasureGroups(view).slice(1).map((group, index) => {
      const headingId = 'debug-measure-group-' + index;
      return '<section class="debug-measure-group" aria-labelledby="' + headingId + '">'
        + '<h3 id="' + headingId + '">' + escapeHtml(group.name) + '</h3>'
        + '<p class="debug-measure-explanation">' + escapeHtml(group.explanation) + '</p>'
        + '<dl class="debug-measure-list">' + group.measures.map((measure) => (
          '<div class="debug-measure"><dt>' + escapeHtml(measure.name)
          + '</dt><dd>' + escapeHtml(measure.value) + '</dd></div>'
        )).join('') + '</dl></section>';
    }).join('') + '</div>';
}
