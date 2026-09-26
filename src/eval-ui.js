import './eval-ui.css';
import { getNode, getOutgoing } from './db.js';
import {
  ENGINE_MIN_DEPTH,
  HUMAN_SAMPLE_FLOOR,
  POPULAR_BAD_SHARE,
  humanMismatch,
  loadCloudEval,
  loadMasters,
  moveEvaluation,
  positionEvaluation,
  railWorthy,
  rootRarity,
} from './eval.js';
import {
  evidenceRequestFailed,
  engineUnavailableLabel,
  humanFailureIndicator,
} from './evidence-presentation.js';

let guideOn = localStorage.getItem('chessview.guide') === '1';

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
  if (typeof composition?.relationshipsFor === 'function') return composition.relationshipsFor(key, options);
  const { incoming = true, outgoing = true } = options;
  return (composition?.relationships ?? []).filter((relationship) => (
    (incoming && relationship.target === key) || (outgoing && relationship.source === key)
  ));
}

function decorateStructure() {
  const rail = document.querySelector('.analysis-rail');
  const tabs = rail?.querySelector('.mode-tabs');
  if (!rail || !tabs) return;
  if (!rail.querySelector('.rail-title')) {
    const title = document.createElement('div');
    title.className = 'rail-title';
    title.textContent = 'Rail';
    rail.insertBefore(title, tabs);
  }
  const position = rail.querySelector('.rail-position');
  if (position) position.classList.add('rail-current-details');
  const debugButton = document.querySelector('#debug-toggle');
  if (debugButton && !document.querySelector('#guide-toggle')) {
    const button = document.createElement('button');
    button.id = 'guide-toggle';
    button.type = 'button';
    button.className = `toolbar-button guide-toggle ${guideOn ? 'is-active' : ''}`;
    button.textContent = 'Guide';
    button.addEventListener('click', () => {
      guideOn = !guideOn;
      localStorage.setItem('chessview.guide', guideOn ? '1' : '0');
      button.classList.toggle('is-active', guideOn);
      renderGuide();
    });
    debugButton.parentElement?.insertBefore(button, debugButton);
  }
  renderGuide();
}

function renderGuide() {
  const rail = document.querySelector('.analysis-rail');
  const existing = rail?.querySelector('.eval-guide');
  if (!guideOn) return existing?.remove();
  if (!rail || existing) return;
  const position = rail.querySelector('.rail-current-details');
  if (!position) return;
  position.insertAdjacentHTML('beforebegin', `
    <section class="eval-guide" aria-label="Chessview guide">
      <div><strong>Engine</strong><span class="guide-dot guide-good"></span>&lt;0.5 pawn <span class="guide-dot guide-dubious"></span>0.5–1.0 <span class="guide-dot guide-bad"></span>1.0+</div>
      <div><strong>Human mismatch</strong><span class="human-marker human-masters">▲</span> Masters <span class="human-marker human-lichess">▲</span> Lichess</div>
    </section>`);
}

async function edgeEvidence(scope, edge, cache) {
  const id = edge?.id ?? `${edge?.source}|${edge?.uci ?? ''}|${edge?.target}`;
  if (cache.has(id)) return cache.get(id);
  const promise = (async () => {
    const sourceNode = await getNode(edge.source);
    if (!scope.isCurrent()) return null;
    const [sourceEval, targetEval, masters] = await Promise.all([
      loadCloudEval(edge.source),
      loadCloudEval(edge.target),
      loadMasters(edge.source),
    ]);
    if (!scope.isCurrent()) return null;
    const moveEval = moveEvaluation(edge.source, edge, sourceEval, targetEval);
    const lichess = sourceNode?.explorer ?? null;
    return {
      sourceNode,
      sourceEval,
      targetEval,
      moveEval,
      masters,
      lichess,
      mastersMismatch: humanMismatch(masters, edge, edge.source, moveEval),
      lichessMismatch: humanMismatch(lichess, edge, edge.source, moveEval),
    };
  })();
  cache.set(id, promise);
  return promise;
}

function relationshipForSatellite(element, scope) {
  const key = element.dataset.key;
  if (!key) return null;
  const visible = scope.view === 'roots'
    ? relationshipsFor(scope.composition, key, { incoming: false })
    : relationshipsFor(scope.composition, key, { outgoing: false });
  return visible[0] ?? null;
}

async function decorateSatellites(scope, cache) {
  for (const element of document.querySelectorAll('.satellite[data-key]')) {
    if (!scope.isCurrent() || !element.isConnected) return;
    const relationship = relationshipForSatellite(element, scope);
    if (!relationship) continue;
    const evidence = await edgeEvidence(scope, relationship.edge, cache);
    if (!evidence || !scope.isCurrent() || !element.isConnected) return;
    const quality = evidence.moveEval?.quality ?? 'unknown';
    const rarity = scope.view === 'roots' ? rootRarity(relationship.edge, evidence.sourceNode) : null;
    setClass(element, 'eval-', quality);
    setClass(element, 'rarity-', rarity);
    const label = element.querySelector('.mini-label');
    if (!label) continue;
    let pill = label.querySelector('.mini-eval');
    if (!pill) {
      pill = document.createElement('span');
      pill.className = 'mini-eval';
      label.appendChild(pill);
    }
    const failed = evidenceRequestFailed(evidence.sourceEval, evidence.targetEval);
    pill.textContent = evidence.moveEval ? lossLabel(evidence.moveEval) : failed ? '!' : '·';
    pill.title = evidence.moveEval
      ? `${lossLabel(evidence.moveEval)} pawn loss vs best`
      : engineUnavailableLabel([evidence.sourceEval, evidence.targetEval]);
  }
}

async function decorateCenter(scope) {
  const stats = document.querySelector('.rail-current-details .position-stats');
  if (!stats) return;
  const cloud = await loadCloudEval(scope.center);
  if (!scope.isCurrent() || !stats.isConnected) return;
  const evaluation = positionEvaluation(cloud);
  let badge = stats.querySelector('.center-eval-detail');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'center-eval-detail';
    stats.appendChild(badge);
  }
  badge.innerHTML = evaluation
    ? `<strong>${escapeHtml(evaluation.label)}</strong>${evaluation.depth ? ` <span>d${evaluation.depth}</span>` : ''}`
    : `<span>${escapeHtml(engineUnavailableLabel([cloud]))}</span>`;
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

async function decorateLineRail(scope) {
  if (scope.view !== 'lines') return;
  const [node, outgoing, sourceEval, masters] = await Promise.all([
    getNode(scope.center),
    getOutgoing(scope.center),
    loadCloudEval(scope.center),
    loadMasters(scope.center),
  ]);
  if (!scope.isCurrent()) return;
  const lichess = node?.explorer ?? null;
  const candidates = outgoing
    .slice()
    .sort((a, b) => (b.share ?? 0) - (a.share ?? 0) || (a.uci ?? '').localeCompare(b.uci ?? ''))
    .filter((edge) => edge.manual || (edge.games ?? 0) >= HUMAN_SAMPLE_FLOOR || (edge.share ?? 0) > POPULAR_BAD_SHARE);
  const rows = [];
  for (const edge of candidates) {
    let targetEval = null;
    let moveEval = moveEvaluation(scope.center, edge, sourceEval, null);
    const fallback = Boolean(sourceEval?.pvs?.length) && Number.isFinite(sourceEval?.depth) && sourceEval.depth >= ENGINE_MIN_DEPTH;
    if (!moveEval && fallback) {
      targetEval = await loadCloudEval(edge.target);
      if (!scope.isCurrent()) return;
      moveEval = moveEvaluation(scope.center, edge, sourceEval, targetEval);
    }
    if (!railWorthy({ edge, sourceKey: scope.center, lichessExplorer: lichess, moveQuality: moveEval })) continue;
    rows.push({
      edge,
      sourceEval,
      targetEval,
      moveEval,
      masters,
      mastersMismatch: humanMismatch(masters, edge, scope.center, moveEval),
      lichessMismatch: humanMismatch(lichess, edge, scope.center, moveEval),
    });
  }
  const list = document.querySelector('.analysis-rail .rail-explorer .explorer-list');
  if (!list || !scope.isCurrent()) return;
  list.classList.add('eval-rail-list');
  const mastersFailure = humanFailureIndicator(masters, 'Masters');
  list.innerHTML = rows.length
    ? `<div class="eval-rail-head"><span>Move</span><span>Loss</span><span>Human${mastersFailure ? ' !' : ''}</span><span></span></div>${rows.map(railRowHtml).join('')}`
    : '<div class="rail-empty">No Rail-worthy Lines yet.</div>';
  list.querySelectorAll('[data-eval-nav]').forEach((button) => {
    button.addEventListener('click', () => scope.navigate(button.dataset.evalNav));
  });
}

function showPresentationFailure(error) {
  const rail = document.querySelector('.analysis-rail .rail-explorer');
  if (!rail || rail.querySelector('.evidence-presentation-failure')) return;
  const note = document.createElement('div');
  note.className = 'rail-empty evidence-presentation-failure';
  note.textContent = 'Supplementary evidence is temporarily unavailable.';
  note.title = error?.message ?? 'Evidence presentation failed';
  rail.appendChild(note);
}

export async function decorateEvidence(scope) {
  decorateStructure();
  const cache = new Map();
  const results = await Promise.allSettled([
    decorateCenter(scope),
    decorateLineRail(scope),
    decorateSatellites(scope, cache),
  ]);
  const rejected = results.filter((result) => result.status === 'rejected');
  if (rejected.length && scope.isCurrent()) {
    showPresentationFailure(rejected[0].reason);
    throw rejected[0].reason;
  }
}
