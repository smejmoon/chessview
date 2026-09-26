import './eval-ui.css';
import { canonicalPosition } from './graph.js';
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
import { reportViewWorkSettled, VIEW_RENDERED_EVENT } from './view-cycle.js';

let generation = 0;
let guideOn = localStorage.getItem('chessview.guide') === '1';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function percent(value) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function compactGames(value = 0) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function lossLabel(moveEval, empty = '—') {
  if (!Number.isFinite(moveEval?.lossCp)) return empty;
  return (moveEval.lossCp / 100).toFixed(1);
}

function evidencedShareLabel(edge) {
  const games = Number(edge?.games ?? 0);
  const share = edge?.share;
  if (!(games > 0) || !Number.isFinite(share) || share <= 0) return '';
  const value = share * 100;
  if (value < 0.5) return '<1%';
  return `${Math.round(value)}%`;
}

function rarityNote(rarity, edge) {
  if (!rarity) return '';
  const share = evidencedShareLabel(edge);
  const label = rarity === 'very-rare' ? 'very rare Root move' : 'rare Root move';
  return `${label}${share ? ` · ${share} of games` : ''}`;
}

function currentMap() {
  return document.querySelector('.map.mode-roots, .map.mode-lines');
}

function currentCenter() {
  return currentMap()?.querySelector('.center-position[data-key]')?.dataset.key ?? null;
}

function currentView() {
  return currentMap()?.classList.contains('mode-roots') ? 'roots' : 'lines';
}

function currentRun(run, centerAtStart) {
  return run === generation && currentCenter() === centerAtStart;
}

function visibleRelationshipsFor(composition, key, { incoming = true, outgoing = true } = {}) {
  if (typeof composition?.relationshipsFor === 'function') {
    return composition.relationshipsFor(key, { incoming, outgoing });
  }
  return (composition?.relationships ?? []).filter((relationship) => (
    (incoming && relationship.target === key)
    || (outgoing && relationship.source === key)
  ));
}

function nodeFor(composition, key) {
  return composition?.nodeByKey?.get?.(key)
    ?? composition?.nodes?.find?.((node) => node.key === key)
    ?? null;
}

function recenterFromRail(key) {
  const next = canonicalPosition(key);
  const depth = Number.isFinite(history.state?.cvDepth) ? history.state.cvDepth + 1 : 1;
  const url = new URL(window.location.href);
  url.searchParams.set('fen', next);
  history.pushState({ fen: next, cvDepth: depth }, '', `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
}

function humanMarkerHtml(mismatch, population, evidenceValue = null, { showFailure = true } = {}) {
  const populationLabel = population === 'masters' ? 'Masters' : 'Lichess';
  const failure = showFailure ? humanFailureIndicator(evidenceValue, populationLabel) : null;
  if (failure) {
    return `<span class="human-marker human-${population} human-unavailable" title="${escapeHtml(failure.title)}">${failure.text}</span>`;
  }
  if (!mismatch) return '';
  const arrow = mismatch.direction === 'up' ? '▲' : '▼';
  const label = mismatch.direction === 'up' ? 'performs better than engine expectation' : 'performs worse than engine expectation';
  return `<span class="human-marker human-${population} human-${mismatch.direction}" title="${populationLabel} ${label}">${arrow}</span>`;
}

function qualityLabel(moveEval) {
  return moveEval?.quality ?? 'unknown';
}

function setClass(element, prefix, value) {
  for (const className of [...element.classList]) {
    if (className.startsWith(prefix)) element.classList.remove(className);
  }
  if (value) element.classList.add(`${prefix}${value}`);
}

function guideHtml() {
  return `
    <section class="eval-guide" aria-label="Chessview guide">
      <div><strong>Engine</strong><span class="guide-dot guide-good"></span>&lt;0.5 pawn <span class="guide-dot guide-dubious"></span>0.5–1.0 <span class="guide-dot guide-bad"></span>1.0+ <span class="human-marker human-unavailable">!</span> unavailable</div>
      <div><strong>Root rarity</strong><span class="rarity-key">◇</span>&lt;5% · stronger fade/dash &lt;1%</div>
      <div><strong>Human mismatch</strong><span class="human-marker human-masters">▲</span> Masters <span class="human-marker human-lichess">▲</span> Lichess · ▲ better, ▼ worse than engine expectation · <span class="human-marker human-unavailable">!</span> unavailable</div>
    </section>`;
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
  if (position) {
    position.classList.add('rail-current-details');
    const debug = rail.querySelector('.rail-debug');
    if (position.nextElementSibling !== debug && (!debug || debug.previousElementSibling !== position)) {
      rail.insertBefore(position, debug ?? null);
    }
  }

  const debugButton = document.querySelector('#debug-toggle');
  if (debugButton && !document.querySelector('#guide-toggle')) {
    const button = document.createElement('button');
    button.id = 'guide-toggle';
    button.type = 'button';
    button.className = `toolbar-button guide-toggle ${guideOn ? 'is-active' : ''}`;
    button.setAttribute('aria-pressed', guideOn ? 'true' : 'false');
    button.textContent = 'Guide';
    button.addEventListener('click', () => {
      guideOn = !guideOn;
      localStorage.setItem('chessview.guide', guideOn ? '1' : '0');
      button.classList.toggle('is-active', guideOn);
      button.setAttribute('aria-pressed', guideOn ? 'true' : 'false');
      renderGuide();
    });
    debugButton.parentElement?.insertBefore(button, debugButton);
  }

  renderGuide();
}

function renderGuide() {
  const rail = document.querySelector('.analysis-rail');
  if (!rail) return;
  const existing = rail.querySelector('.eval-guide');
  if (!guideOn) {
    existing?.remove();
    return;
  }
  if (existing) return;
  const position = rail.querySelector('.rail-current-details');
  if (!position) return;
  position.insertAdjacentHTML('beforebegin', guideHtml());
}

async function evidenceForEdge(edge, centerAtStart, run) {
  if (!edge?.source || !edge?.target) return null;
  const sourceNode = await getNode(edge.source);
  if (!currentRun(run, centerAtStart)) return null;

  const sourceEval = await loadCloudEval(edge.source);
  if (!currentRun(run, centerAtStart)) return null;
  const targetEval = await loadCloudEval(edge.target);
  if (!currentRun(run, centerAtStart)) return null;
  const moveEval = moveEvaluation(edge.source, edge, sourceEval, targetEval);

  const masters = await loadMasters(edge.source);
  if (!currentRun(run, centerAtStart)) return null;
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
}

function relationshipForSatellite(element, view, composition) {
  const key = element.dataset.key;
  const move = element.querySelector('.mini-label strong')?.textContent?.trim() ?? '';
  if (!key) return null;

  const visible = view === 'roots'
    ? visibleRelationshipsFor(composition, key, { incoming: false })
    : visibleRelationshipsFor(composition, key, { outgoing: false });
  const byMove = visible.find((relationship) => (
    (relationship.edge?.san ?? relationship.edge?.uci) === move
  ));
  return byMove ?? visible[0] ?? null;
}

function evidenceForRelationship(relationship, centerAtStart, run, cache) {
  if (!relationship) return Promise.resolve(null);
  const id = relationship.id ?? `${relationship.source}|${relationship.edge?.uci ?? ''}|${relationship.target}`;
  if (!cache.has(id)) cache.set(id, evidenceForEdge(relationship.edge, centerAtStart, run));
  return cache.get(id);
}

function decorateSatelliteUi(element, edge, evidence, view) {
  if (!edge || !evidence) return;
  const boardEval = positionEvaluation(view === 'roots' ? evidence.sourceEval : evidence.targetEval);
  const moveEval = evidence.moveEval;
  const rarity = view === 'roots' ? rootRarity(edge, evidence.sourceNode) : null;
  setClass(element, 'eval-', qualityLabel(moveEval));
  setClass(element, 'rarity-', rarity);
  element.dataset.evalEdgeSource = edge.source;
  element.dataset.evalEdgeTarget = edge.target;

  const label = element.querySelector('.mini-label');
  if (!label) return;

  let evalPill = label.querySelector('.mini-eval');
  if (!evalPill) {
    evalPill = document.createElement('span');
    evalPill.className = 'mini-eval';
    label.appendChild(evalPill);
  }
  const engineUnavailable = engineUnavailableLabel([evidence.sourceEval, evidence.targetEval], {
    failed: 'Cloud eval request failed',
    missing: 'No adequate cloud eval',
  });
  const loss = moveEval ? lossLabel(moveEval) : evidenceRequestFailed(evidence.sourceEval, evidence.targetEval) ? '!' : '·';
  if (evalPill.textContent !== loss) evalPill.textContent = loss;
  const rarityText = rarityNote(rarity, edge);
  evalPill.title = moveEval
    ? `${lossLabel(moveEval)} pawn loss vs best${moveEval.depth ? ` · depth ${moveEval.depth}` : ''}${rarityText ? ` · ${rarityText}` : ''}${boardEval?.label ? ` · resulting position ${boardEval.label}` : ''}`
    : `${rarityText ? `${rarityText} · ` : ''}${boardEval?.label ? `Resulting position ${boardEval.label}` : engineUnavailable}`;

  const shareText = evidencedShareLabel(edge);
  let share = label.querySelector('.mini-share');
  if (shareText) {
    if (!share) {
      share = document.createElement('span');
      share.className = 'mini-share';
      label.appendChild(share);
    }
    if (share.textContent !== shareText) share.textContent = shareText;
  } else {
    share?.remove();
  }

  let humans = label.querySelector('.mini-humans');
  const humanHtml = `${humanMarkerHtml(evidence.mastersMismatch, 'masters', evidence.masters)}${humanMarkerHtml(evidence.lichessMismatch, 'lichess')}`;
  if (humanHtml) {
    if (!humans) {
      humans = document.createElement('span');
      humans.className = 'mini-humans';
      label.appendChild(humans);
    }
    if (humans.innerHTML !== humanHtml) humans.innerHTML = humanHtml;
  } else {
    humans?.remove();
  }
}

async function decorateSatellites(centerAtStart, run, composition, evidenceCache) {
  const view = currentView();
  const satellites = [...document.querySelectorAll('.satellite[data-key]')];
  for (const element of satellites) {
    if (!currentRun(run, centerAtStart) || !element.isConnected) return;
    const relationship = relationshipForSatellite(element, view, composition);
    if (!relationship) continue;
    const evidence = await evidenceForRelationship(relationship, centerAtStart, run, evidenceCache);
    if (!evidence || !currentRun(run, centerAtStart) || !element.isConnected) return;
    decorateSatelliteUi(element, relationship.edge, evidence, view);
  }
}

async function decorateConnectors(centerAtStart, run, composition, evidenceCache) {
  const map = currentMap();
  if (!map || !composition?.relationships?.length) return;
  const roots = currentView() === 'roots';
  const paths = [...map.querySelectorAll('#edges path[data-relationship-id]')];
  const pathsByRelationship = new Map();
  for (const path of paths) {
    const id = path.dataset.relationshipId;
    if (!id) continue;
    if (!pathsByRelationship.has(id)) pathsByRelationship.set(id, []);
    pathsByRelationship.get(id).push(path);
  }

  for (const relationship of composition.relationships) {
    if (!currentRun(run, centerAtStart)) return;
    const targets = pathsByRelationship.get(relationship.id) ?? [];
    if (!targets.length) continue;
    const evidence = await evidenceForRelationship(relationship, centerAtStart, run, evidenceCache);
    if (!evidence || !currentRun(run, centerAtStart)) return;
    const quality = qualityLabel(evidence.moveEval);
    const rarity = roots ? rootRarity(relationship.edge, evidence.sourceNode) : null;
    for (const path of targets) {
      if (!path.isConnected) continue;
      setClass(path, 'edge-quality-', quality ?? null);
      setClass(path, 'edge-rarity-', rarity ?? null);
    }
  }
}

function railRowHtml(row, { showMastersFailure = true } = {}) {
  const { edge, moveEval, targetEval, masters, mastersMismatch, lichessMismatch, sourceEval } = row;
  const quality = qualityLabel(moveEval);
  const engineFailed = evidenceRequestFailed(sourceEval, targetEval);
  const evalLabel = moveEval ? lossLabel(moveEval) : engineFailed ? '!' : '—';
  const mismatch = `${humanMarkerHtml(mastersMismatch, 'masters', masters, { showFailure: showMastersFailure })}${humanMarkerHtml(lichessMismatch, 'lichess')}` || '<span class="human-none">—</span>';
  const share = evidencedShareLabel(edge);
  const engineNote = !moveEval && engineFailed ? ' · engine evidence request failed' : '';
  const title = `${edge.san ?? edge.uci}${share ? ` · ${share}` : ''}${edge.games ? ` · ${compactGames(edge.games)} games` : ''}${moveEval ? ` · ${lossLabel(moveEval)} pawn loss vs best` : ''}${engineNote}`;
  return `
    <button class="eval-rail-row eval-${quality}" type="button" data-eval-nav="${escapeHtml(edge.target)}" title="${escapeHtml(title)}">
      <span class="eval-rail-move">${escapeHtml(edge.san ?? edge.uci)}${share ? ` · ${escapeHtml(share)}` : ''}</span>
      <span class="eval-badge">${escapeHtml(evalLabel)}</span>
      <span class="eval-human-cell">${mismatch}</span>
      <span class="eval-play">›</span>
    </button>`;
}

function railRow(edge, moveEval, targetEval, sourceEval, masters, lichess, sourceKey) {
  return {
    edge,
    moveEval,
    targetEval,
    sourceEval,
    masters,
    mastersMismatch: humanMismatch(masters, edge, sourceKey, moveEval),
    lichessMismatch: humanMismatch(lichess, edge, sourceKey, moveEval),
  };
}

function renderLineRailRows(centerAtStart, run, candidates, rowsById, masters) {
  if (!currentRun(run, centerAtStart)) return false;
  const rows = candidates.map((edge) => rowsById.get(edge.id)).filter(Boolean);
  if (currentView() !== 'lines') return true;

  const list = document.querySelector('.analysis-rail .rail-explorer .explorer-list');
  if (!list) return false;
  const mastersFailure = humanFailureIndicator(masters, 'Masters');
  const signature = rows.map(({ edge, moveEval, targetEval, masters: rowMasters, mastersMismatch, lichessMismatch }) => [
    edge.id,
    moveEval?.lossCp,
    moveEval?.quality,
    mastersMismatch?.direction,
    lichessMismatch?.direction,
    evidenceRequestFailed(rowMasters) ? 'masters-failed' : '',
    evidenceRequestFailed(rowsById.get(edge.id)?.sourceEval, targetEval) ? 'engine-failed' : '',
  ].join(':')).join('|');
  const fullSignature = `${signature}|masters:${mastersFailure ? 'failed' : masters ? 'ready' : 'pending'}`;
  if (list.dataset.evalSignature === fullSignature) return true;
  list.dataset.evalSignature = fullSignature;
  list.classList.add('eval-rail-list');
  const humanHead = mastersFailure
    ? `<span class="eval-human-head">Human <span class="human-marker human-masters human-unavailable" title="${escapeHtml(mastersFailure.title)}">${mastersFailure.text}</span></span>`
    : '<span>Human</span>';
  list.innerHTML = rows.length
    ? `<div class="eval-rail-head"><span>Move</span><span>Loss</span>${humanHead}<span></span></div>${rows.map((row) => railRowHtml(row, { showMastersFailure: false })).join('')}`
    : '<div class="rail-empty">No Rail-worthy Lines yet.</div>';

  list.querySelectorAll('[data-eval-nav]').forEach((button) => {
    button.addEventListener('click', () => recenterFromRail(button.dataset.evalNav));
  });
  return true;
}

async function decorateLineRail(centerAtStart, run) {
  const node = await getNode(centerAtStart);
  const outgoing = await getOutgoing(centerAtStart);
  if (!currentRun(run, centerAtStart)) return;
  const lichess = node?.explorer ?? null;

  const sourceEvalPromise = loadCloudEval(centerAtStart);
  const mastersPromise = loadMasters(centerAtStart);
  const sourceEval = await sourceEvalPromise;
  if (!currentRun(run, centerAtStart)) return;

  const candidates = outgoing
    .slice()
    .sort((a, b) => (b.share ?? 0) - (a.share ?? 0) || (a.uci ?? '').localeCompare(b.uci ?? ''))
    .filter((edge) => edge.manual || (edge.games ?? 0) >= HUMAN_SAMPLE_FLOOR || (edge.share ?? 0) > POPULAR_BAD_SHARE);
  const rowsById = new Map();
  const fallbackEdges = [];
  const canUseFallback = Boolean(sourceEval?.pvs?.length)
    && Number.isFinite(sourceEval?.depth)
    && sourceEval.depth >= ENGINE_MIN_DEPTH
    && !evidenceRequestFailed(sourceEval);

  for (const edge of candidates) {
    const moveEval = moveEvaluation(centerAtStart, edge, sourceEval, null);
    if (!moveEval && canUseFallback) {
      fallbackEdges.push(edge);
      continue;
    }
    if (!railWorthy({ edge, sourceKey: centerAtStart, lichessExplorer: lichess, moveQuality: moveEval })) continue;
    rowsById.set(edge.id, railRow(edge, moveEval, null, sourceEval, null, lichess, centerAtStart));
  }
  renderLineRailRows(centerAtStart, run, candidates, rowsById, null);

  const masters = await mastersPromise;
  if (!currentRun(run, centerAtStart)) return;
  for (const [id, row] of rowsById) {
    rowsById.set(id, railRow(row.edge, row.moveEval, row.targetEval, sourceEval, masters, lichess, centerAtStart));
  }
  renderLineRailRows(centerAtStart, run, candidates, rowsById, masters);

  for (const edge of fallbackEdges) {
    const targetEval = await loadCloudEval(edge.target);
    if (!currentRun(run, centerAtStart)) return;
    const moveEval = moveEvaluation(centerAtStart, edge, sourceEval, targetEval);
    if (railWorthy({ edge, sourceKey: centerAtStart, lichessExplorer: lichess, moveQuality: moveEval })) {
      rowsById.set(edge.id, railRow(edge, moveEval, targetEval, sourceEval, masters, lichess, centerAtStart));
    } else {
      rowsById.delete(edge.id);
    }
    renderLineRailRows(centerAtStart, run, candidates, rowsById, masters);
  }
}

function relationshipForRootRow(row, centerAtStart, composition) {
  const key = row.dataset.navKey;
  const node = nodeFor(composition, key);
  const move = row.querySelector('.explorer-move')?.textContent?.trim() ?? '';
  if (!key || !Number.isFinite(node?.distance)) return null;

  return visibleRelationshipsFor(composition, key, { incoming: false })
    .filter((relationship) => (
      node.distance === 1
        ? relationship.target === centerAtStart
        : nodeFor(composition, relationship.target)?.distance === node.distance - 1
    ))
    .slice()
    .sort((a, b) => {
      const aMove = (a.edge?.san ?? a.edge?.uci ?? '') === move ? 0 : 1;
      const bMove = (b.edge?.san ?? b.edge?.uci ?? '') === move ? 0 : 1;
      return aMove - bMove
        || (b.edge?.games ?? 0) - (a.edge?.games ?? 0)
        || (a.edge?.uci ?? '').localeCompare(b.edge?.uci ?? '');
    })[0] ?? null;
}

async function decorateRootRail(centerAtStart, run, composition, evidenceCache) {
  if (currentView() !== 'roots') return;
  const rows = [...document.querySelectorAll('.roots-row[data-nav-key]')];
  if (!rows.length) return;

  for (const row of rows) {
    if (!currentRun(run, centerAtStart) || !row.isConnected) return;
    const relationship = relationshipForRootRow(row, centerAtStart, composition);
    if (!relationship) continue;
    const edge = relationship.edge;
    const evidence = await evidenceForRelationship(relationship, centerAtStart, run, evidenceCache);
    if (!evidence || !currentRun(run, centerAtStart) || !row.isConnected) return;

    const quality = qualityLabel(evidence.moveEval);
    const rarity = rootRarity(edge, evidence.sourceNode);
    setClass(row, 'eval-', quality);
    setClass(row, 'rarity-', rarity);
    row.dataset.evalEdgeSource = edge.source;
    row.dataset.evalEdgeTarget = edge.target;

    const lossCell = row.querySelector('.explorer-share');
    if (lossCell) {
      lossCell.classList.add('root-loss');
      const engineFailed = evidenceRequestFailed(evidence.sourceEval, evidence.targetEval);
      const text = evidence.moveEval ? lossLabel(evidence.moveEval) : engineFailed ? '!' : '—';
      if (lossCell.textContent !== text) lossCell.textContent = text;
      const rarityText = rarityNote(rarity, edge);
      const engineUnavailable = engineUnavailableLabel([evidence.sourceEval, evidence.targetEval], {
        failed: 'Cloud eval request failed',
        missing: 'No adequate cloud eval',
      });
      lossCell.title = evidence.moveEval
        ? `${text} pawn loss vs best${rarityText ? ` · ${rarityText}` : ''}`
        : `${rarityText ? `${rarityText} · ` : ''}${engineUnavailable}`;
    }

    const humanCell = row.querySelector('.explorer-games');
    if (humanCell) {
      humanCell.classList.add('root-human');
      const html = `${humanMarkerHtml(evidence.mastersMismatch, 'masters', evidence.masters)}${humanMarkerHtml(evidence.lichessMismatch, 'lichess')}` || '<span class="human-none">—</span>';
      if (humanCell.innerHTML !== html) humanCell.innerHTML = html;
    }
  }
}

async function decorateCenter(centerAtStart, run) {
  const position = document.querySelector('.rail-current-details');
  const stats = position?.querySelector('.position-stats');
  if (!position || !stats) return;
  const cloud = await loadCloudEval(centerAtStart);
  if (!currentRun(run, centerAtStart) || !position.isConnected) return;
  const evaluation = positionEvaluation(cloud);

  let badge = stats.querySelector('.center-eval-detail');
  const html = evaluation
    ? `<strong>${escapeHtml(evaluation.label)}</strong>${evaluation.depth ? ` <span>d${evaluation.depth}</span>` : ''}`
    : `<span>${escapeHtml(engineUnavailableLabel([cloud]))}</span>`;
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'center-eval-detail';
    stats.appendChild(badge);
  }
  if (badge.innerHTML !== html) badge.innerHTML = html;
}

async function decorate(detail) {
  const run = ++generation;
  const centerAtStart = detail.center;
  const composition = detail.composition;
  const evidenceCache = new Map();
  try {
    decorateStructure();
    if (!currentRun(run, centerAtStart)) return;

    const results = await Promise.allSettled([
      decorateCenter(centerAtStart, run),
      decorateLineRail(centerAtStart, run),
      decorateRootRail(centerAtStart, run, composition, evidenceCache),
      decorateSatellites(centerAtStart, run, composition, evidenceCache),
      decorateConnectors(centerAtStart, run, composition, evidenceCache),
    ]);
    for (const result of results) {
      if (result.status === 'rejected') console.error('Chessview evidence decoration failed', result.reason);
    }
  } catch (error) {
    console.error('Chessview evidence decoration failed', error);
  } finally {
    if (currentRun(run, centerAtStart)) {
      reportViewWorkSettled({
        cycleId: detail.cycleId,
        label: 'evidence',
        task: detail.tasks?.evidence,
        center: centerAtStart,
      });
    }
  }
}

window.addEventListener(VIEW_RENDERED_EVENT, (event) => {
  const detail = event.detail ?? {};
  if (!detail.tasks?.evidence) return;
  decorate(detail);
});