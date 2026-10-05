function finiteCount(value) {
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

export function weatherMeasureLabels(view) {
  const weather = view?.weather ?? {};
  const structural = weather.structural ?? {};
  const supplementary = weather.supplementary ?? {};
  const structure = weather.structure ?? view?.structure?.status ?? 'idle';

  return Object.freeze([
    `map ${structure}`,
    `settling ${view?.settling === true ? 'yes' : 'no'}`,
    `frontier ${finiteCount(weather.frontier)}`,
    `working ${finiteCount(structural.working)}`,
    `retry ${finiteCount(structural.retryWaiting)}`,
    `satisfied ${finiteCount(structural.satisfied)}`,
    `incorporating ${finiteCount(structural.incorporationPending)}`,
    `unavailable ${finiteCount(structural.unavailable)}`,
    `failed ${finiteCount(structural.failed)}`,
    `unplanned ${finiteCount(structural.unplanned)}`,
    `detached ${finiteCount(structural.detached)}`,
    `supplementary ${finiteCount(supplementary.active)}/${finiteCount(supplementary.total)}`,
  ]);
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

  const labels = weatherMeasureLabels(view);
  measures.textContent = labels.join(' · ');
  measures.title = `Weather diagnostics: ${labels.join(', ')}`;
  measures.setAttribute?.('aria-label', measures.title);
  return true;
}
