import './eval-ui.css';
import {
  evidenceRequestFailed,
  engineUnavailableLabel,
  humanFailureIndicator,
} from './evidence-presentation.js';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function lossLabel(moveEval, empty = '—') {
  if (!Number.isFinite(moveEval?.lossCp)) return empty;
  return (moveEval.lossCp / 100).toFixed(1);
}

function evidencedShareLabel(edge) {
  const games = Number(edge?.games ?? 0);
  if (!(games > 0) || !Number.isFinite(edge?.share) || edge.share <= 0) return '';
  const value = edge.share * 100;
  return value < 0.5 ? '<1%' : `${Math.round(value)}%`;
}

function humanMarkerHtml(mismatch, population, evidenceValue = null, { showFailure = true } = {}) {
  const populationLabel = population === 'masters' ? 'Masters' : 'Lichess';
  const failure = showFailure ? humanFailureIndicator(evidenceValue, populationLabel) : null;
  if (failure) return `<span class="human-marker human-${population} human-unavailable" title="${escapeHtml(failure.title)}">${failure.text}</span>`;
  if (!mismatch) return '';
  const arrow = mismatch.direction === 'up' ? '▲' : '▼';
  return `<span class="human-marker human-${population} human-${mismatch.direction}">${arrow}</span>`;
}

function setClass(element, prefix, value) {
  for (const className of [...element.classList]) {
    if (className.startsWith(prefix)) element.classList.remove(className);
  }
  if (value) element.classList.add(`${prefix}${value}`);
}

function relationshipsFor(composition, key, options = {}) {
  const { incoming = true, outgoing = true } = options;
  return (composition?.relationships ?? []).filter((relationship) => (
    (incoming && relationship.target === key) || (outgoing && relationship.source === key)
  ));
}

function renderGuide(root, visible) {
  const rail = root.querySelector('.analysis-rail');
  const existing = rail?.querySelector('.eval-guide');
  if (!visible) return existing?.remove();
  if (!rail || existing) return;
  const position = rail.querySelector('.rail-current-details');
  if (!position) return;
  position.insertAdjacentHTML('beforebegin', `
    <section class="eval-guide" aria-label="Chessview guide">
      <div><strong>Engine</strong><span class="guide-dot guide-good"></span>&lt;0.5 pawn <span class="guide-dot guide-dubious"></span>0.5–1.0 <span class="guide-dot guide-bad"></span>1.0+</div>
      <div><strong>Human mismatch</strong><span class="human-marker human-masters">▲</span> Masters <span class="human-marker human-lichess">▲</span> Lichess</div>
    </section>`);
}

function decorateCenter(root, evidence) {
  const stats = root.querySelector('.rail-current-details .position-stats');
  if (!stats || !evidence?.center) return;
  const { cloud, evaluation } = evidence.center;
  const badge = (root.ownerDocument ?? globalThis.document).createElement('span');
  badge.className = 'center-eval-detail';
  badge.innerHTML = evaluation
    ? `<strong>${escapeHtml(evaluation.label)}</strong>${evaluation.depth ? ` <span>d${evaluation.depth}</span>` : ''}`
    : `<span>${escapeHtml(engineUnavailableLabel([cloud]))}</span>`;
  stats.appendChild(badge);
}

function relationshipForSatellite(element, view) {
  const key = element.dataset.key;
  const composition = view.structure.value?.composition;
  if (!key || !composition) return null;
  const visible = view.mode === 'roots'
    ? relationshipsFor(composition, key, { incoming: false })
    : relationshipsFor(composition, key, { outgoing: false });
  return visible[0] ?? null;
}

function decorateSatellites(root, view, evidenceById) {
  for (const element of root.querySelectorAll('.satellite[data-key]')) {
    const relationship = relationshipForSatellite(element, view);
    const evidence = relationship ? evidenceById.get(relationship.id) : null;
    if (!evidence) continue;
    const quality = evidence.moveEval?.quality ?? 'unknown';
    setClass(element, 'eval-', quality);
    setClass(element, 'rarity-', evidence.rarity);
    const label = element.querySelector('.mini-label');
    if (!label) continue;
    const pill = (root.ownerDocument ?? globalThis.document).createElement('span');
    pill.className = 'mini-eval';
    const failed = evidenceRequestFailed(evidence.sourceEval, evidence.targetEval);
    pill.textContent = evidence.moveEval ? lossLabel(evidence.moveEval) : failed ? '!' : '·';
    pill.title = evidence.moveEval
      ? `${lossLabel(evidence.moveEval)} pawn loss vs best`
      : engineUnavailableLabel([evidence.sourceEval, evidence.targetEval]);
    label.appendChild(pill);
  }
}

function decorateConnectors(root, evidenceById) {
  for (const path of root.querySelectorAll('path[data-relationship-id]')) {
    const evidence = evidenceById.get(path.dataset.relationshipId);
    if (!evidence) continue;
    setClass(path, 'edge-quality-', evidence.moveEval?.quality ?? null);
    setClass(path, 'edge-rarity-', evidence.rarity);
  }
}

function railRowHtml(row) {
  const quality = row.moveEval?.quality ?? 'unknown';
  const failed = evidenceRequestFailed(row.sourceEval, row.targetEval);
  const mismatch = `${humanMarkerHtml(row.mastersMismatch, 'masters', row.masters)}${humanMarkerHtml(row.lichessMismatch, 'lichess')}` || '<span class="human-none">—</span>';
  return `<button class="eval-rail-row eval-${quality}" type="button" data-eval-nav="${escapeHtml(row.edge.target)}">
    <span class="eval-rail-move">${escapeHtml(row.edge.san ?? row.edge.uci)}${evidencedShareLabel(row.edge) ? ` · ${evidencedShareLabel(row.edge)}` : ''}</span>
    <span class="eval-badge">${row.moveEval ? lossLabel(row.moveEval) : failed ? '!' : '—'}</span>
    <span class="eval-human-cell">${mismatch}</span><span class="eval-play">›</span></button>`;
}

function decorateLineRail(root, view, actions, evidence) {
  if (view.mode !== 'lines') return;
  const list = root.querySelector('.analysis-rail .rail-explorer .explorer-list');
  if (!list) return;
  const rows = evidence?.rail?.rows ?? [];
  const mastersFailure = humanFailureIndicator(evidence?.rail?.masters, 'Masters');
  list.classList.add('eval-rail-list');
  list.innerHTML = rows.length
    ? `<div class="eval-rail-head"><span>Move</span><span>Loss</span><span>Human${mastersFailure ? ' !' : ''}</span><span></span></div>${rows.map(railRowHtml).join('')}`
    : '<div class="rail-empty">No Rail-worthy Lines yet.</div>';
  list.querySelectorAll('[data-eval-nav]').forEach((button) => {
    button.addEventListener('click', () => actions.navigate(button.dataset.evalNav));
  });
}

function showPresentationFailure(root, error) {
  const rail = root.querySelector('.analysis-rail .rail-explorer');
  if (!rail || rail.querySelector('.evidence-presentation-failure')) return;
  const note = (root.ownerDocument ?? globalThis.document).createElement('div');
  note.className = 'rail-empty evidence-presentation-failure';
  note.textContent = 'Supplementary evidence is temporarily unavailable.';
  note.title = error || 'Evidence presentation failed';
  rail.appendChild(note);
}

export function decorateEvidencePresentation(root, view, actions, { showGuide = false } = {}) {
  renderGuide(root, showGuide);
  if (view.evidence.status === 'failed') {
    showPresentationFailure(root, view.evidence.error);
    return;
  }
  if (view.evidence.status !== 'ready' || !view.evidence.value) return;

  const evidence = view.evidence.value;
  const evidenceById = new Map((evidence.relationships ?? []).map((item) => [item.id, item]));
  decorateCenter(root, evidence);
  decorateLineRail(root, view, actions, evidence);
  decorateSatellites(root, view, evidenceById);
  decorateConnectors(root, evidenceById);
}
