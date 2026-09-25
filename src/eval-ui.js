import './eval-ui.css';
import { canonicalPosition, positionUrl } from './graph.js';
import { getIncoming, getNode, getOutgoing } from './db.js';
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

let generation = 0;
let scheduled = false;
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

function positionElement(key) {
  return document.querySelector(`.position[data-key="${CSS.escape(key)}"]`);
}

function recenterFromRail(key) {
  const next = canonicalPosition(key);
  const depth = Number.isFinite(history.state?.cvDepth) ? history.state.cvDepth + 1 : 1;
  const url = new URL(window.location.href);
  url.searchParams.set('fen', next);
  history.pushState({ fen: next, cvDepth: depth }, '', `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
}

function humanMarkerHtml(mismatch, population) {
  if (!mismatch) return '';
  const arrow = mismatch.direction === 'up' ? '▲' : '▼';
  const label = mismatch.direction === 'up' ? 'performs better than engine expectation' : 'performs worse than engine expectation';
  return `<span class="human-marker human-${population} human-${mismatch.direction}" title="${population === 'masters' ? 'Masters' : 'Lichess'} ${label}">${arrow}</span>`;
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
      <div><strong>Engine</strong><span class="guide-dot guide-good"></span>&lt;0.5 pawn <span class="guide-dot guide-dubious"></span>0.5–1.0 <span class="guide-dot guide-bad"></span>1.0+</div>
      <div><strong>Root rarity</strong><span class="rarity-key">◇</span>&lt;5% · stronger fade/dash &lt;1%</div>
      <div><strong>Human mismatch</strong><span class="human-marker human-masters">▲</span> Masters <span class="human-marker human-lichess">▲</span> Lichess · ▲ better, ▼ worse than engine expectation</div>
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

async function evidenceForEdge(edge, centerAtStart) {
  if (!edge?.source || !edge?.target) return null;
  const sourceNode = await getNode(edge.source);
  if (currentCenter() !== centerAtStart) return null;

  const sourceEval = await loadCloudEval(edge.source);
  if (currentCenter() !== centerAtStart) return null;
  const targetEval = await loadCloudEval(edge.target);
  if (currentCenter() !== centerAtStart) return null;
  const moveEval = moveEvaluation(edge.source, edge, sourceEval, targetEval);

  const masters = await loadMasters(edge.source);
  if (currentCenter() !== centerAtStart) return null;
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

async function edgeForSatellite(element, view, centerAtStart) {
  const key = element.dataset.key;
  const move = element.querySelector('.mini-label strong')?.textContent?.trim() ?? '';
  if (!key) return null;

  const candidates = view === 'roots' ? await getOutgoing(key) : await getIncoming(key);
  if (currentCenter() !== centerAtStart) return null;
  const visible = candidates.filter((edge) => {
    const neighbor = view === 'roots' ? edge.target : edge.source;
    return Boolean(positionElement(neighbor));
  });
  const byMove = visible.find((edge) => (edge.san ?? edge.uci) === move);
  return byMove ?? visible[0] ?? null;
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
  const loss = lossLabel(moveEval, '·');
  if (evalPill.textContent !== loss) evalPill.textContent = loss;
  const rarityText = rarityNote(rarity, edge);
  evalPill.title = moveEval
    ? `${lossLabel(moveEval)} pawn loss vs best${moveEval.depth ? ` · depth ${moveEval.depth}` : ''}${rarityText ? ` · ${rarityText}` : ''}${boardEval?.label ? ` · resulting position ${boardEval.label}` : ''}`
    : `${rarityText ? `${rarityText} · ` : ''}${boardEval?.label ? `Resulting position ${boardEval.label}` : 'No adequate cloud eval'}`;

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
  const humanHtml = `${humanMarkerHtml(evidence.mastersMismatch, 'masters')}${humanMarkerHtml(evidence.lichessMismatch, 'lichess')}`;
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

async function decorateSatellites(centerAtStart) {
  const view = currentView();
  const satellites = [...document.querySelectorAll('.satellite[data-key]')];
  for (const element of satellites) {
    if (currentCenter() !== centerAtStart || !element.isConnected) return;
    const edge = await edgeForSatellite(element, view, centerAtStart);
    if (!edge) continue;
    const evidence = await evidenceForEdge(edge, centerAtStart);
    if (!evidence || currentCenter() !== centerAtStart || !element.isConnected) return;
    decorateSatelliteUi(element, edge, evidence, view);
  }
}

function decorateConnectorQuality() {
  const map = currentMap();
  if (!map) return;
  const paths = [...map.querySelectorAll('#edges path')];
  const satellites = [...map.querySelectorAll('.satellite[data-key]')];
  const roots = currentView() === 'roots';
  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index];
    const satellite = satellites[index] ?? null;
    const quality = ['good', 'dubious', 'bad', 'unknown'].find((value) => satellite?.classList.contains(`eval-${value}`));
    const rarity = roots
      ? ['rare', 'very-rare'].find((value) => satellite?.classList.contains(`rarity-${value}`))
      : null;
    setClass(path, 'edge-quality-', quality ?? null);
    setClass(path, 'edge-rarity-', rarity ?? null);
  }
}

function railRowHtml(edge, moveEval, mastersMismatch, lichessMismatch) {
  const quality = qualityLabel(moveEval);
  const evalLabel = lossLabel(moveEval);
  const mismatch = `${humanMarkerHtml(mastersMismatch, 'masters')}${humanMarkerHtml(lichessMismatch, 'lichess')}` || '<span class="human-none">—</span>';
  const share = evidencedShareLabel(edge);
  const title = `${edge.san ?? edge.uci}${share ? ` · ${share}` : ''}${edge.games ? ` · ${compactGames(edge.games)} games` : ''}${moveEval ? ` · ${lossLabel(moveEval)} pawn loss vs best` : ''}`;
  return `
    <button class="eval-rail-row eval-${quality}" type="button" data-eval-nav="${escapeHtml(edge.target)}" title="${escapeHtml(title)}">
      <span class="eval-rail-move">${escapeHtml(edge.san ?? edge.uci)}</span>
      <span class="eval-badge">${escapeHtml(evalLabel)}</span>
      <span class="eval-human-cell">${mismatch}</span>
      <span class="eval-play">›</span>
    </button>`;
}

async function hydrateRailMove(centerAtStart, edge, sourceEval) {
  let moveEval = moveEvaluation(centerAtStart, edge, sourceEval, null);
  if (moveEval || !sourceEval || sourceEval.depth < ENGINE_MIN_DEPTH) return moveEval;
  const targetEval = await loadCloudEval(edge.target);
  if (currentCenter() !== centerAtStart) return null;
  return moveEvaluation(centerAtStart, edge, sourceEval, targetEval);
}

async function decorateLineRail(centerAtStart) {
  const rail = document.querySelector('.analysis-rail');
  if (!rail) return;
  const node = await getNode(centerAtStart);
  const outgoing = await getOutgoing(centerAtStart);
  if (currentCenter() !== centerAtStart) return;

  const sourceEval = await loadCloudEval(centerAtStart);
  if (currentCenter() !== centerAtStart) return;
  const masters = await loadMasters(centerAtStart);
  if (currentCenter() !== centerAtStart) return;
  const lichess = node?.explorer ?? null;

  const candidates = outgoing
    .slice()
    .sort((a, b) => (b.share ?? 0) - (a.share ?? 0) || (a.uci ?? '').localeCompare(b.uci ?? ''))
    .filter((edge) => edge.manual || (edge.games ?? 0) >= HUMAN_SAMPLE_FLOOR || (edge.share ?? 0) > POPULAR_BAD_SHARE);

  const rows = [];
  const batchSize = 4;
  for (let index = 0; index < candidates.length; index += batchSize) {
    const batch = await Promise.all(candidates.slice(index, index + batchSize).map(async (edge) => {
      const moveEval = await hydrateRailMove(centerAtStart, edge, sourceEval);
      if (currentCenter() !== centerAtStart) return null;
      if (!railWorthy({ edge, sourceKey: centerAtStart, lichessExplorer: lichess, moveQuality: moveEval })) return null;
      return {
        edge,
        moveEval,
        mastersMismatch: humanMismatch(masters, edge, centerAtStart, moveEval),
        lichessMismatch: humanMismatch(lichess, edge, centerAtStart, moveEval),
      };
    }));
    if (currentCenter() !== centerAtStart) return;
    rows.push(...batch.filter(Boolean));
  }

  const linesCount = document.querySelector('#lines-tab small');
  if (linesCount) linesCount.textContent = String(rows.length);
  if (currentView() !== 'lines') return;

  const list = rail.querySelector('.rail-explorer .explorer-list');
  if (!list) return;
  const signature = rows.map(({ edge, moveEval, mastersMismatch, lichessMismatch }) => [edge.id, moveEval?.lossCp, moveEval?.quality, mastersMismatch?.direction, lichessMismatch?.direction].join(':')).join('|');
  if (list.dataset.evalSignature === signature) return;
  list.dataset.evalSignature = signature;
  list.classList.add('eval-rail-list');
  list.innerHTML = rows.length
    ? `<div class="eval-rail-head"><span>Move</span><span>Loss</span><span>Human</span><span></span></div>${rows.map((row) => railRowHtml(row.edge, row.moveEval, row.mastersMismatch, row.lichessMismatch)).join('')}`
    : '<div class="rail-empty">No Rail-worthy Lines yet.</div>';

  list.querySelectorAll('[data-eval-nav]').forEach((button) => {
    button.addEventListener('click', () => recenterFromRail(button.dataset.evalNav));
  });
}

function rootRowDepth(row) {
  const text = row.querySelector('.root-depth')?.textContent?.trim().toLowerCase() ?? '';
  if (text === 'root') return 1;
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : null;
}

async function edgeForRootRow(row, centerAtStart, depthByKey) {
  const key = row.dataset.navKey;
  const depth = rootRowDepth(row);
  const move = row.querySelector('.explorer-move')?.textContent?.trim() ?? '';
  if (!key || !Number.isFinite(depth)) return null;
  const outgoing = await getOutgoing(key);
  if (currentCenter() !== centerAtStart) return null;
  return outgoing
    .filter((edge) => depth === 1 ? edge.target === centerAtStart : depthByKey.get(edge.target) === depth - 1)
    .sort((a, b) => {
      const aMove = (a.san ?? a.uci ?? '') === move ? 0 : 1;
      const bMove = (b.san ?? b.uci ?? '') === move ? 0 : 1;
      return aMove - bMove || (b.games ?? 0) - (a.games ?? 0) || (a.uci ?? '').localeCompare(b.uci ?? '');
    })[0] ?? null;
}

async function decorateRootRail(centerAtStart) {
  if (currentView() !== 'roots') return;
  const rows = [...document.querySelectorAll('.roots-row[data-nav-key]')];
  if (!rows.length) return;
  const depthByKey = new Map(rows.map((row) => [row.dataset.navKey, rootRowDepth(row)]));

  for (const row of rows) {
    if (currentCenter() !== centerAtStart || !row.isConnected) return;
    const edge = await edgeForRootRow(row, centerAtStart, depthByKey);
    if (!edge) continue;
    const evidence = await evidenceForEdge(edge, centerAtStart);
    if (!evidence || currentCenter() !== centerAtStart || !row.isConnected) return;

    const quality = qualityLabel(evidence.moveEval);
    const rarity = rootRarity(edge, evidence.sourceNode);
    setClass(row, 'eval-', quality);
    setClass(row, 'rarity-', rarity);
    row.dataset.evalEdgeSource = edge.source;
    row.dataset.evalEdgeTarget = edge.target;

    const lossCell = row.querySelector('.explorer-share');
    if (lossCell) {
      lossCell.classList.add('root-loss');
      const text = lossLabel(evidence.moveEval);
      if (lossCell.textContent !== text) lossCell.textContent = text;
      const rarityText = rarityNote(rarity, edge);
      lossCell.title = evidence.moveEval
        ? `${text} pawn loss vs best${rarityText ? ` · ${rarityText}` : ''}`
        : `${rarityText ? `${rarityText} · ` : ''}No adequate cloud eval`;
    }

    const humanCell = row.querySelector('.explorer-games');
    if (humanCell) {
      humanCell.classList.add('root-human');
      const html = `${humanMarkerHtml(evidence.mastersMismatch, 'masters')}${humanMarkerHtml(evidence.lichessMismatch, 'lichess')}` || '<span class="human-none">—</span>';
      if (humanCell.innerHTML !== html) humanCell.innerHTML = html;
    }
  }
}

async function decorateCenter(centerAtStart) {
  const position = document.querySelector('.rail-current-details');
  const stats = position?.querySelector('.position-stats');
  if (!position || !stats) return;
  const cloud = await loadCloudEval(centerAtStart);
  if (currentCenter() !== centerAtStart || !position.isConnected) return;
  const evaluation = positionEvaluation(cloud);

  let badge = stats.querySelector('.center-eval-detail');
  const html = evaluation
    ? `<strong>${escapeHtml(evaluation.label)}</strong>${evaluation.depth ? ` <span>d${evaluation.depth}</span>` : ''}`
    : '<span>eval unavailable</span>';
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'center-eval-detail';
    stats.appendChild(badge);
  }
  if (badge.innerHTML !== html) badge.innerHTML = html;
}

async function decorate() {
  const run = ++generation;
  decorateStructure();
  const centerAtStart = currentCenter();
  if (!centerAtStart) return;

  await decorateCenter(centerAtStart);
  if (run !== generation || currentCenter() !== centerAtStart) return;
  await decorateLineRail(centerAtStart);
  if (run !== generation || currentCenter() !== centerAtStart) return;
  await decorateRootRail(centerAtStart);
  if (run !== generation || currentCenter() !== centerAtStart) return;
  await decorateSatellites(centerAtStart);
  if (run !== generation || currentCenter() !== centerAtStart) return;
  decorateConnectorQuality();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    decorate();
  });
}

new MutationObserver(schedule).observe(document.querySelector('#app'), { childList: true, subtree: true });
schedule();