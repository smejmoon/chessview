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
type Group = Readonly<{ name: string; label: string; explanation: string; measures: readonly Measure[] }>;

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
      label: 'Map state',
      explanation: 'Accepted map lifecycle, structural settlement, and Explorer Reading obligations admitted by the current Constellation.',
      measures: [
        { name: 'Map', value: weather?.structure ?? view?.structure?.status ?? 'idle' },
        { name: 'Settling', value: view?.settling === true ? 'yes' : 'no' },
        { name: 'Reading frontier', value: finiteCount(weather?.frontier) },
      ],
    },
    {
      name: 'FrontierWork',
      label: 'Structural',
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
      label: 'Supplementary',
      explanation: 'Supplementary participants enrich the view; they do not block structural readiness. Lookahead work is not included here.',
      measures: [
        { name: 'Active', value: finiteCount(supplementary?.active) },
        { name: 'Total', value: finiteCount(supplementary?.total) },
      ],
    },
  ];
}

// UI-only icon vocabulary. Current View alone publishes the observations.
const descriptions: Record<string, Readonly<{ icon: string; explanation: string }>> = {
  'Structural:Working': { icon: '↻', explanation: 'Structural obligations working in the active run.' },
  'Structural:Satisfied': { icon: '✓', explanation: 'Successful structural work; may persist after incorporation.' },
  'Structural:Incorporation pending': { icon: '⇥', explanation: 'Successful results awaiting settlement recomposition.' },
  'Structural:Unavailable': { icon: '∅', explanation: 'Source acquisition could not complete; chess evidence is not thereby absent.' },
  'Structural:Failed': { icon: '!', explanation: 'Failed obligations do not themselves establish ongoing progress.' },
  'Structural:Unplanned': { icon: '?', explanation: 'Unplanned obligations do not themselves establish ongoing progress.' },
  'Structural:Detached': { icon: '↗', explanation: 'Participants detached from the accepted Reading frontier.' },
  'Supplementary:Active': { icon: '⚡', explanation: 'Active supplementary work does not block structural readiness.' },
  'Supplementary:Total': { icon: 'Σ', explanation: 'Total supplementary participants; lookahead is excluded.' },
};

function metricGroupHtml(group: Group): string {
  return '<span class="topbar-debug-group" role="group" aria-label="'
    + escapeHtml(group.label + ' work') + '">' + group.measures.map((measure) => {
      const description = descriptions[group.label + ':' + measure.name];
      if (!description) return '';
      const details = group.label + ' — ' + measure.name + ': ' + measure.value + '. ' + description.explanation;
      return '<span class="topbar-debug-metric" tabindex="0" title="' + escapeHtml(details)
        + '" aria-label="' + escapeHtml(details) + '" data-debug-metric="'
        + escapeHtml(group.label + ':' + measure.name) + '">'
        + '<span aria-hidden="true" class="topbar-debug-icon">' + escapeHtml(description.icon) + '</span>'
        + '<strong aria-hidden="true">' + escapeHtml(measure.value) + '</strong></span>';
    }).join('') + '</span>';
}

export function debugTopbarValuesHtml(view: DebugMeasureView): string {
  const groups = debugMeasureGroups(view);
  return '<span class="topbar-debug-map" role="group" aria-label="Map state and settling">'
    + groups[0].measures.map((measure) => (
      '<span class="topbar-constellation-measure"><span>'
      + escapeHtml(measure.name === 'Reading frontier' ? 'Frontier' : measure.name)
      + '</span><strong>' + escapeHtml(measure.value) + '</strong></span>'
    )).join('') + '</span>'
    + groups.slice(1).map(metricGroupHtml).join('');
}

export function debugTopbarHtml(view: DebugMeasureView, enabled: boolean): string {
  return '<div class="topbar-debug-observations" id="topbar-debug-observations"'
    + ' role="group" aria-label="Current View Debug measurements" tabindex="0"'
    + (enabled ? '' : ' hidden') + '>'
    + debugTopbarValuesHtml(view) + '</div>';
}
