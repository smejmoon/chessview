import { Chessground } from '@lichess-org/chessground';
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';
import './debug.css';

import {
  canonicalPosition,
  chooseNeighborhood,
  chooseRootNeighborhood,
  legalDestinations,
  omittedShare,
  positionFromUrl,
  stableEdgeOrder,
  toPlayableFen,
} from './graph.js';
import { getIncoming, getNode, getOutgoing } from './db.js';
import { discoverForViewport, ensureManualEdge } from './explorer.js';
import {
  clearDebugLog,
  debugLog,
  debugText,
  getDebugEntries,
  isDebugEnabled,
  setDebugEnabled,
} from './debug.js';
import { NodusController } from './nodus-controller.js';
import { prepareRootComposition, decorateRootComposition } from './root-pgn.js';
import { decorateEvidence } from './eval-ui.js';

const app = document.querySelector('#app');

function viewFromUrl() {
  const explicit = new URLSearchParams(window.location.search).get('view');
  if (explicit === 'roots' || explicit === 'lines') return explicit;
  return localStorage.getItem('chessview.view') === 'roots' ? 'roots' : 'lines';
}

function routeUrl(route) {
  const url = new URL(window.location.href);
  url.searchParams.set('fen', route.center);
  url.searchParams.set('view', route.view);
  return `${url.pathname}${url.search}${url.hash}`;
}

const browser = {
  readRoute(historyState = history.state) {
    return {
      center: positionFromUrl(),
      view: viewFromUrl(),
      navDepth: Number.isFinite(historyState?.cvDepth) ? historyState.cvDepth : 0,
    };
  },
  push(route) {
    history.pushState({ fen: route.center, cvDepth: route.navDepth }, '', routeUrl(route));
  },
  replace(route) {
    history.replaceState({ fen: route.center, cvDepth: route.navDepth }, '', routeUrl(route));
  },
  persistView(view) { localStorage.setItem('chessview.view', view); },
  persistOrientation(orientation) { localStorage.setItem('chessview.orientation', orientation); },
  back() { history.back(); },
};

const state = {
  center: positionFromUrl(),
  view: viewFromUrl(),
  orientation: localStorage.getItem('chessview.orientation') === 'black' ? 'black' : 'white',
  navDepth: Number.isFinite(history.state?.cvDepth) ? history.state.cvDepth : 0,
  loading: false,
  error: '',
  presentation: 'idle',
  boardApis: [],
  debug: isDebugEnabled(),
};

function syncScope(scope) {
  state.center = scope.center;
  state.view = scope.view;
  state.orientation = scope.orientation;
  state.navDepth = scope.navDepth;
  state.loading = scope.loading;
  state.error = scope.error;
  state.presentation = scope.presentation;
}

function viewStatusSpec(presentation) {
  if (presentation === 'updating') return { mark: '●', label: 'Updating…', title: 'Current view is updating' };
  if (presentation === 'ready') return { mark: '✓', label: 'Ready', title: 'Current view finished updating' };
  if (presentation === 'check') return { mark: '✓', label: '', title: 'Current view finished updating' };
  if (presentation === 'failed') return { mark: '!', label: 'Unavailable', title: 'Current view could not finish updating' };
  return { mark: '', label: '', title: '' };
}

function paintViewStatus(snapshot) {
  state.presentation = snapshot.presentation;
  const element = document.querySelector('#view-status');
  if (!element) return;
  const spec = viewStatusSpec(snapshot.presentation);
  element.className = `view-status is-${snapshot.presentation}`;
  element.title = spec.title;
  element.setAttribute('aria-label', spec.title);
  const mark = element.querySelector('.view-status-mark');
  const label = element.querySelector('.view-status-label');
  if (mark) mark.textContent = spec.mark;
  if (label) label.textContent = spec.label;
}

function boardBudget() {
  const area = window.innerWidth * window.innerHeight;
  if (window.innerWidth < 620) return 5;
  if (window.innerWidth < 900 || area < 650_000) return 8;
  if (window.innerWidth < 1250 || area < 1_000_000) return 12;
  return 16;
}

function percent(value) { return `${Math.round((value ?? 0) * 100)}%`; }
function compactGames(value = 0) { return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value); }
function escapeHtml(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function mapCenterX() {
  if (window.innerWidth <= 460) return 34;
  if (window.innerWidth <= 760) return 31;
  if (window.innerWidth <= 1100) return 29;
  return 26;
}

async function collectOutgoingGraph(center, max) {
  const outgoingBySource = new Map();
  const queue = [{ key: center, depth: 0 }];
  const visited = new Set();
  while (queue.length && visited.size < max * 3) {
    const current = queue.shift();
    if (visited.has(current.key) || current.depth > max) continue;
    visited.add(current.key);
    const edges = await getOutgoing(current.key);
    outgoingBySource.set(current.key, edges);
    for (const edge of edges.filter((item) => item.qualifies || item.manual).sort(stableEdgeOrder)) {
      if (!visited.has(edge.target)) queue.push({ key: edge.target, depth: current.depth + 1 });
    }
  }
  return outgoingBySource;
}

async function collectIncomingGraph(center, max) {
  const incomingByTarget = new Map();
  const queue = [{ key: center, depth: 0 }];
  const visited = new Set();
  while (queue.length && visited.size < max * 3) {
    const current = queue.shift();
    if (visited.has(current.key) || current.depth > max) continue;
    visited.add(current.key);
    const edges = await getIncoming(current.key);
    incomingByTarget.set(current.key, edges);
    for (const edge of edges) if (!visited.has(edge.source)) queue.push({ key: edge.source, depth: current.depth + 1 });
  }
  return incomingByTarget;
}

async function collectScene(center, max) {
  const [incomingEdges, outgoingEdges] = await Promise.all([getIncoming(center), getOutgoing(center)]);
  let selected = [];
  let outgoingBySource = new Map([[center, outgoingEdges]]);
  if (state.view === 'lines') {
    outgoingBySource = await collectOutgoingGraph(center, max);
    selected = chooseNeighborhood({ center, incoming: [], outgoingBySource, max });
  } else {
    const incomingByTarget = await collectIncomingGraph(center, max);
    selected = chooseRootNeighborhood({ center, incomingByTarget, max });
  }
  const nodes = new Map();
  await Promise.all([center, ...selected.map((item) => item.key)].map(async (key) => {
    nodes.set(key, (await getNode(key)) ?? { key, fen: toPlayableFen(key) });
  }));
  return { incomingEdges, outgoingBySource, selected, nodes };
}

function disposeBoards() {
  for (const api of state.boardApis) api?.destroy?.();
  state.boardApis = [];
}

function layoutPositions(items) {
  const positions = new Map();
  const levels = new Map();
  for (const item of items) {
    if (!levels.has(item.distance)) levels.set(item.distance, []);
    levels.get(item.distance).push(item);
  }
  if (!levels.size) return positions;
  const maxDepth = Math.max(...levels.keys());
  for (const [depth, level] of levels) {
    const x = mapCenterX() + (92 - mapCenterX()) * (depth / Math.max(1, maxDepth));
    level.forEach((item, index) => {
      const y = level.length <= 1 ? 50 : 12 + (76 * index) / Math.max(1, level.length - 1);
      positions.set(item.key, { x, y, tier: depth === 1 && level.length <= 4 ? 1 : 2 });
    });
  }
  return positions;
}

function relationLabel(item) {
  if (state.view === 'roots') return item.distance === 1 ? 'root' : `−${item.distance}`;
  return item.distance > 1 ? `+${item.distance}` : 'line';
}

function railExplorerHtml(scene) {
  if (state.view === 'lines') {
    const edges = (scene.outgoingBySource.get(state.center) ?? []).filter((edge) => edge.qualifies || edge.manual).slice().sort(stableEdgeOrder);
    if (!edges.length) return `<div class="rail-empty">${state.loading ? 'Mapping continuations…' : 'No known Lines yet.'}</div>`;
    return `<div class="explorer-list">${edges.slice(0, 14).map((edge) => `<button class="explorer-row" type="button" data-nav-key="${escapeHtml(edge.target)}"><span class="explorer-move">${escapeHtml(edge.san ?? edge.uci)}</span><span class="explorer-track"><span style="width:${Math.max(2, Math.round((edge.share ?? 0) * 100))}%"></span></span><span class="explorer-share">${percent(edge.share)}</span><span class="explorer-games">${compactGames(edge.games ?? 0)}</span></button>`).join('')}</div>`;
  }
  if (!scene.selected.length) return '<div class="rail-empty">No known Roots yet. Roots grow as Chessview discovers positions through Lines.</div>';
  return `<div class="explorer-list">${scene.selected.map((item) => `<button class="explorer-row roots-row" type="button" data-nav-key="${escapeHtml(item.key)}"><span class="root-depth">${item.distance === 1 ? 'root' : `−${item.distance}`}</span><span class="explorer-move">${escapeHtml(item.edge?.san ?? item.edge?.uci ?? '')}</span><span class="root-name">${escapeHtml(scene.nodes.get(item.key)?.opening?.name ?? 'known position')}</span><span class="explorer-share">${item.edge?.share ? percent(item.edge.share) : ''}</span><span class="explorer-games">${item.edge?.games ? compactGames(item.edge.games) : ''}</span></button>`).join('')}</div>`;
}

function debugRailHtml() {
  if (!state.debug) return '';
  return `<section class="rail-debug" aria-label="Chessview debug log"><div class="debug-head"><div class="debug-title">Debug <small>${getDebugEntries().length} events</small></div><div class="debug-actions"><button class="debug-action" id="debug-copy" type="button">Copy</button><button class="debug-action" id="debug-clear" type="button">Clear</button></div></div><pre class="debug-log" id="debug-log">${escapeHtml(debugText())}</pre></section>`;
}

function bindControls(actions) {
  document.querySelector('#roots-tab')?.addEventListener('click', () => actions.setView('roots'));
  document.querySelector('#lines-tab')?.addEventListener('click', () => actions.setView('lines'));
  document.querySelectorAll('[data-nav-key]').forEach((button) => button.addEventListener('click', () => actions.navigate(button.dataset.navKey)));
  document.querySelector('#back')?.addEventListener('click', actions.back);
  document.querySelector('#flip')?.addEventListener('click', actions.flip);
  document.querySelector('#debug-toggle')?.addEventListener('click', () => { state.debug = setDebugEnabled(!state.debug); actions.redraw(); });
  document.querySelector('#debug-clear')?.addEventListener('click', () => { clearDebugLog(); actions.redraw(); });
  document.querySelector('#debug-copy')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(debugText()); debugLog('debug log copied'); }
    catch (error) { debugLog('debug copy failed', error, 'warn'); }
    actions.redraw();
  });
}

function renderSatellites(scene, actions) {
  const host = document.querySelector('#satellites');
  const positions = layoutPositions(scene.selected);
  for (const item of scene.selected) {
    const point = positions.get(item.key);
    if (!point) continue;
    const node = scene.nodes.get(item.key) ?? {};
    const wrapper = document.createElement('button');
    wrapper.type = 'button';
    wrapper.className = `satellite position tier-${point.tier} relation-${item.relation}`;
    wrapper.dataset.key = item.key;
    wrapper.style.setProperty('--x', `${point.x}%`);
    wrapper.style.setProperty('--y', `${point.y}%`);
    wrapper.innerHTML = `<span class="mini-label"><span class="relation">${relationLabel(item)}</span><strong>${escapeHtml(item.edge?.san ?? '')}</strong></span><span class="mini-board board-frame"></span>${node.opening?.name ? `<span class="opening-label">${escapeHtml(node.opening.name)}</span>` : ''}`;
    wrapper.addEventListener('click', () => actions.navigate(item.key));
    host.appendChild(wrapper);
    state.boardApis.push(Chessground(wrapper.querySelector('.mini-board'), {
      fen: toPlayableFen(item.key), orientation: state.orientation, coordinates: false, viewOnly: true,
      animation: { enabled: false }, movable: { free: false, color: undefined }, draggable: { enabled: false }, selectable: { enabled: false },
    }));
  }
}

function renderShell(scene, actions) {
  disposeBoards();
  const centerNode = scene.nodes.get(state.center) ?? {};
  const explorer = centerNode.explorer;
  const status = viewStatusSpec(state.presentation);
  const turn = state.center.split(' ')[1] === 'b' ? 'black' : 'white';
  const rootCount = scene.incomingEdges.length;
  const lineCount = (scene.outgoingBySource.get(state.center) ?? []).filter((edge) => edge.qualifies || edge.manual).length;
  app.innerHTML = `<main class="app-shell"><header class="topbar"><a class="brand" href="${import.meta.env.BASE_URL}" aria-label="Chessview start position"><span class="brand-mark">♞</span><span>Chessview</span></a><div class="topbar-meta"><span class="network-status">Lichess · rated standard</span><span id="view-status" class="view-status is-${state.presentation}" role="status" aria-live="polite" aria-label="${escapeHtml(status.title)}"><span class="view-status-mark">${status.mark}</span><span class="view-status-label">${status.label}</span></span><button class="toolbar-button" id="back" type="button" ${state.navDepth > 0 ? '' : 'disabled'}>← Back</button><button class="toolbar-button ${state.debug ? 'is-active' : ''}" id="debug-toggle" type="button">Debug</button><button class="icon-button" id="flip" type="button" aria-label="Flip all boards">⇅</button></div></header><div class="workspace"><section class="map mode-${state.view}" id="map"><svg class="edges" id="edges" aria-hidden="true"></svg><div class="center-position position" data-key="${escapeHtml(state.center)}" style="left:${mapCenterX()}%"><div class="center-board board-frame" id="center-board"></div><div class="center-hint">${state.view === 'roots' ? 'Known move orders converge here.' : 'Drag a legal move, or choose a Line.'}</div></div><div id="satellites"></div>${state.error ? `<div class="toast">${escapeHtml(state.error)}</div>` : ''}</section><aside class="analysis-rail"><div class="rail-position"><div class="eyebrow">${centerNode.opening ? `${escapeHtml(centerNode.opening.eco ?? '')} · opening` : 'current position'}</div><h1>${escapeHtml(centerNode.opening?.name ?? 'Explore from here')}</h1><div class="position-stats">${centerNode.games ? `<span>${compactGames(centerNode.games)} games</span>` : '<span>no cached games yet</span>'}<span>${turn} to move</span>${state.view === 'lines' && explorer && omittedShare(explorer) >= 0.005 ? `<span>other · ${percent(omittedShare(explorer))}</span>` : ''}</div></div><div class="mode-tabs" role="tablist"><button id="roots-tab" class="mode-tab ${state.view === 'roots' ? 'is-active' : ''}" type="button">Roots <small>${rootCount}</small></button><button id="lines-tab" class="mode-tab ${state.view === 'lines' ? 'is-active' : ''}" type="button">Lines <small>${lineCount}</small></button></div><section class="rail-explorer"><div class="rail-section-head"><div><strong>${state.view === 'roots' ? 'Root Explorer' : 'Opening Explorer'}</strong></div></div>${railExplorerHtml(scene)}</section>${debugRailHtml()}</aside></div></main>`;

  const centerApi = Chessground(document.querySelector('#center-board'), {
    fen: toPlayableFen(state.center), orientation: state.orientation, turnColor: turn, coordinates: true,
    animation: { enabled: true, duration: 180 }, movable: { free: false, color: turn, dests: legalDestinations(state.center), showDests: true, events: { after: async (from, to) => {
      const result = await ensureManualEdge(state.center, from, to, 'q');
      if (result) actions.navigate(result.target); else actions.redraw();
    } } }, draggable: { enabled: true, showGhost: true }, selectable: { enabled: true }, highlight: { lastMove: true, check: true },
  });
  state.boardApis.push(centerApi);
  bindControls(actions);
  renderSatellites(scene, actions);
}

async function renderView(scope) {
  syncScope(scope);
  try {
    const scene = await collectScene(scope.center, boardBudget());
    if (!scope.isCurrent()) return null;
    renderShell(scene, scope.actions);
    return { composition: scene.selected };
  } catch (error) {
    debugLog('render failed', error, 'error');
    state.error = error?.message ?? 'Could not render the opening map.';
    const scene = { incomingEdges: [], outgoingBySource: new Map(), selected: [], nodes: new Map([[scope.center, { key: scope.center }]]) };
    renderShell(scene, scope.actions);
    return { failed: true, error };
  }
}

async function discover(scope) {
  try {
    await discoverForViewport(scope.center, boardBudget(), scope.onProgress, { signal: scope.signal });
    return null;
  } catch (error) {
    if (scope.signal.aborted || !scope.isCurrent()) return null;
    debugLog('discovery failed', { center: scope.center, error: error?.message ?? String(error) }, 'error');
    let hasPersistedExplorer = false;
    try { hasPersistedExplorer = Boolean((await getNode(scope.center))?.explorer); } catch {}
    return { error, criticalFailure: !hasPersistedExplorer };
  }
}

const controller = new NodusController({
  initial: { ...browser.readRoute(), orientation: state.orientation },
  canonicalize: canonicalPosition,
  browser,
  render: renderView,
  prepare: prepareRootComposition,
  decorate: decorateRootComposition,
  evidence: decorateEvidence,
  discover,
  onPresentation: paintViewStatus,
  log: (message, detail) => debugLog(message, detail),
});

debugLog('app start', controller.snapshot);
window.addEventListener('popstate', (event) => { void controller.restore(browser.readRoute(event.state)); });
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { void controller.redraw(); }, 120);
});
window.addEventListener('beforeunload', () => controller.dispose(), { once: true });
await controller.start();
