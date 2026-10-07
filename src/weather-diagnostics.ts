function finiteCount(value) {
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

function weatherMeasures(view) {
  const weather = view?.weather ?? {};
  const structural = weather.structural ?? {};
  const supplementary = weather.supplementary ?? {};
  const structure = weather.structure ?? view?.structure?.status ?? 'idle';

  return Object.freeze([
    Object.freeze({
      label: `map ${structure}`,
      explanation: 'Accepted Constellation structure lifecycle for the current Nodus.',
    }),
    Object.freeze({
      label: `settling ${view?.settling === true ? 'yes' : 'no'}`,
      explanation: 'Whether admitted structural obligations can still change the accepted Constellation shape.',
    }),
    Object.freeze({
      label: `frontier ${finiteCount(weather.frontier)}`,
      explanation: 'Missing rated Explorer Readings currently admitted by Constellation as structurally relevant.',
    }),
    Object.freeze({
      label: `working ${finiteCount(structural.working)}`,
      explanation: 'Structural refinement participants currently executing.',
    }),
    Object.freeze({
      label: `retry ${finiteCount(structural.retryWaiting)}`,
      explanation: 'Structural participants waiting on a legitimate retry gate.',
    }),
    Object.freeze({
      label: `satisfied ${finiteCount(structural.satisfied)}`,
      explanation: 'Structural participants that completed successfully in this refinement run.',
    }),
    Object.freeze({
      label: `incorporating ${finiteCount(structural.incorporationPending)}`,
      explanation: 'Successful structural results still awaiting settlement recomposition into the current view.',
    }),
    Object.freeze({
      label: `unavailable ${finiteCount(structural.unavailable)}`,
      explanation: 'Structural obligations whose source attempt is unavailable for this run after normal fallback or recovery.',
    }),
    Object.freeze({
      label: `failed ${finiteCount(structural.failed)}`,
      explanation: 'Structural participants that failed outside the semantic unavailable path.',
    }),
    Object.freeze({
      label: `unplanned ${finiteCount(structural.unplanned)}`,
      explanation: 'Admitted structural obligations that currently have no scheduled participant.',
    }),
    Object.freeze({
      label: `detached ${finiteCount(structural.detached)}`,
      explanation: 'Structural participants no longer attached to the current admitted frontier.',
    }),
    Object.freeze({
      label: `supplementary ${finiteCount(supplementary.active)}/${finiteCount(supplementary.total)}`,
      explanation: 'Non-structural background work: active participants over total participants in the current refinement run.',
    }),
  ]);
}

export function weatherMeasureLabels(view) {
  return Object.freeze(weatherMeasures(view).map(({ label }) => label));
}

export function decorateWeatherDiagnostics(app, view, { debug = false } = {}) {
  const status = app?.querySelector?.('#view-status');
  if (!status) return false;

  status.dataset.weatherDiagnostics = debug ? 'true' : 'false';
  let measures = status.querySelector?.('.view-status-measures') ?? null;
  if (!debug) {
    measures?.remove?.();
    return true;
  }

  if (!measures) {
    measures = status.ownerDocument?.createElement?.('span') ?? null;
    if (!measures) return false;
    measures.className = 'view-status-measures';
    status.appendChild(measures);
  }

  measures.textContent = '';
  for (const item of weatherMeasures(view)) {
    const measure = status.ownerDocument?.createElement?.('span') ?? null;
    if (!measure) continue;
    measure.className = 'view-status-measure';
    measure.textContent = item.label;
    measure.title = item.explanation;
    measure.setAttribute?.('aria-label', `${item.label}: ${item.explanation}`);
    measures.appendChild?.(measure);
  }
  return true;
}
