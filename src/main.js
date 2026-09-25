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
  positionUrl,
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

const app = document.querySelector('#app');
const initialDepth = Number.isFinite(history.state?.cvDepth) ? history.state.cvDepth : 0;

function viewFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const explicit = params.get('view');
  if (explicit === 'roots' || explicit === 'lines') return explicit;
  return localStorage.getItem('chessview.view') === 'roots' ? 'roots' : 'lines';
}

const state = {
  center: positionFromUrl(),
  view: viewFromUrl(),
  orientation: localStorage.getItem('chessview.orientation') === 'black' ? 'black' : 'white',
  loading: false,
  error: '',
  scene: null,
  boardApis: [],
  generation: 0,
  navDepth: initialDepth,
  debug: isDebugEnabled(),
  discoveryController: null,
};

debugLog('app start', { center: state.center, view: state.view, navDepth: state.navDepth });

function boardBudget() {
  const area = window.innerWidth * window.innerHeight;
  if (window.innerWidth < 620) return 5;
  if (window.innerWidth < 900 || area < 650_000) return 8;
  if (window.innerWidth < 1250 || area < 1_000_000) return 12;
  return 16;
}

function percent(value) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function compactGames(value = 0) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
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
    for (const edge of edges) {
      if (!visited.has(edge.source)) queue.push({ key: edge.source, depth: current.depth + 1 });
    }
  }
  return incomingByTarget;
}

async function collectScene(center, max) {
  const incomingEdges = await getIncoming(center);
  let selected = [];
  let outgoingBySource = new Map();
  let incomingByTarget = new Map([[center, incomingEdges]]);

  if (state.view === 'lines') {
    outgoingBySource = await collectOutgoingGraph(center, max);
    selected = chooseNeighborhood({ center, incoming: [], outgoingBySource, max });
  } else {
    incomingByTarget = await collectIncomingGraph(center, max);
    selected = chooseRootNeighborhood({ center, incomingByTarget, max });
  }

  const nodes = new Map();
  await Promise.all(
    [center, ...selected.map((item) => item.key)].map(async (key) => {
      const node = await getNode(key);
      nodes.set(key, node ?? { key, fen: toPlayableFen(key) });
    }),
  );

  return { incomingEdges, incomingByTarget, outgoingBySource, selected, nodes };
}

function disposeBoards() {
  for (const api of state.boardApis) api?.destroy?.();
  state.boardApis = [];
}

function layoutPositions(items) {
  const positions = new Map();
  if (!items.length) return positions;

  const levels = new Map();
  for (const item of items) {
    if (!levels.has(item.distance)) levels.set(item.distance, []);
    levels.get(item.distance).push(item);
  }

  const maxDepth = Math.max(...levels.keys());
  const centerX = state.view === 'roots' ? 74 : 26;
  const edgeX = state.view === 'roots' ? 8 : 92;

  for (const [depth, level] of [...levels.entries()].sort((a, b) => a[0] - b[0])) {
    const progress = depth / Math.max(1, maxDepth);
    const x = centerX + (edgeX - centerX) * progress;
    const count = level.length;
    const yStart = count <= 1 ? 50 : 12;
    const yEnd = count <= 1 ? 50 : 88;

    level.forEach((item, index) => {
      const y = count <= 1 ? 50 : yStart + ((yEnd - yStart) * index) / Math.max(1, count - 1);
      const tier = depth === 1 && count <= 4 ? 1 : 2;
      positions.set(item.key, { x, y, tier });
    });
  }

  return positions;
}

function relationLabel(item) {
  if (state.view === 'roots') return item.distance === 1 ? 'root' : `−${item.distance}`;
  if (item.distance > 1) return `+${item.distance}`;
  return 'line';
}

function setView(next) {
  if (next === state.view) return;
  state.view = next;
  localStorage.setItem('chessview.view', next);
  const url = new URL(window.location.href);
  url.searchParams.set('view', next);
  history.replaceState({ ...(history.state ?? {}), fen: state.center, cvDepth: state.navDepth }, '', `${url.pathname}${url.search}${url.hash}`);
  state.error = '';
  state.discoveryController?.abort();
  state.loading = false;
  debugLog('view changed', { view: next, center: state.center });
  render().then(() => {
    if (next === 'lines') refreshDiscovery();
  });
}

function railExplorerHtml(scene) {
  if (state.view === 'lines') {
    const edges = (scene.outgoingBySource.get(state.center) ?? [])
      .filter((edge) => edge.qualifies || edge.manual)
      .slice()
      .sort(stableEdgeOrder);
    if (!edges.length) return `<div class="rail-empty">${state.loading ? 'Mapping continuations…' : 'No known Lines yet.'}</div>`;
    return `<div class="explorer-list">${edges.slice(0, 14).map((edge) => `
      <button class="explorer-row" type="button" data-nav-key="${escapeHtml(edge.target)}">
        <span class="explorer-move">${escapeHtml(edge.san ?? edge.uci)}</span>
        <span class="explorer-track"><span style="width:${Math.max(2, Math.round((edge.share ?? 0) * 100))}%"></span></span>
        <span class="explorer-share">${percent(edge.share)}</span>
        <span class="explorer-games">${compactGames(edge.games ?? 0)}</span>
      </button>`).join('')}</div>`;
  }

  const ancestry = scene.selected
    .slice()
    .sort((a, b) => a.distance - b.distance || (b.edge?.games ?? 0) - (a.edge?.games ?? 0) || a.key.localeCompare(b.key));
  if (!ancestry.length) return `<div class="rail-empty">No known Roots yet. Roots grow as Chessview discovers positions through Lines.</div>`;

  return `<div class="explorer-list">${ancestry.map((item) => {
    const edge = item.edge ?? {};
    const node = scene.nodes.get(item.key) ?? {};
    return `
      <button class="explorer-row roots-row" type="button" data-nav-key="${escapeHtml(item.key)}">
        <span class="root-depth">${item.distance === 1 ? 'root' : `−${item.distance}`}</span>
        <span class="explorer-move">${escapeHtml(edge.san ?? edge.uci ?? '')}</span>
        <span class="root-name">${escapeHtml(node.opening?.name ?? 'known position')}</span>
        <span class="explorer-share">${edge.share ? percent(edge.share) : ''}</span>
        <span class="explorer-games">${edge.games ? compactGames(edge.games) : ''}</span>
      </button>`;
  }).join('')}</div>`;
}

function debugRailHtml() {
  if (!state.debug) return '';
  return `
    <section class="rail-debug" aria-label="Chessview debug log">
      <div class="debug-head">
        <div class="debug-title">Debug <small>${getDebugEntries().length} events</small></div>
        <div class="debug-actions">
          <button class="debug-action" id="debug-copy" type="button">Copy</button>
          <button class="debug-action" id="debug-clear" type="button">Clear</button>
        </div>
      </div>
      <pre class="debug-log" id="debug-log">${escapeHtml(debugText())}</pre>
    </section>`;
}

function bindRailControls() {
  document.querySelector('#roots-tab')?.addEventListener('click', () => setView('roots'));
  document.querySelector('#lines-tab')?.addEventListener('click', () => setView('lines'));
  document.querySelectorAll('[data-nav-key]').forEach((button) => {
    button.addEventListener('click', () => recenter(button.dataset.navKey, { pushHistory: true }));
  });
  document.querySelector('#debug-toggle')?.addEventListener('click', () => {
    state.debug = setDebugEnabled(!state.debug);
    render();
  });
  document.querySelector('#debug-clear')?.addEventListener('click', () => {
    clearDebugLog();
    render();
  });
  document.querySelector('#debug-copy')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(debugText());
      debugLog('debug log copied');
    } catch (error) {
      debugLog('debug copy failed', error, 'warn');
    }
    render();
  });
}

function renderShell(scene) {
  disposeBoards();
  const centerNode = scene.nodes.get(state.center) ?? {};
  const explorer = centerNode.explorer;
  const total = centerNode.games ?? 0;
  const other = explorer ? omittedShare(explorer) : 0;
  const opening = centerNode.opening;
  const boardPosition = state.center;
  const turn = boardPosition.split(' ')[1] === 'b' ? 'black' : 'white';
  const rootCount = state.view === 'roots' ? scene.selected.length : scene.incomingEdges.length;
  const lineCount = (scene.outgoingBySource.get(state.center) ?? []).filter((edge) => edge.qualifies || edge.manual).length;

  app.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <a class="brand" href="${import.meta.env.BASE_URL}" aria-label="Chessview start position"><span class="brand-mark">♞</span><span>Chessview</span></a>
        <div class="topbar-meta">
          <span class="network-status ${state.loading ? 'is-loading' : ''}">${state.loading ? 'mapping…' : state.error ? 'cached map' : 'Lichess · rated standard'}</span>
          <button class="toolbar-button" id="back" type="button" ${state.navDepth > 0 ? '' : 'disabled'}>← Back</button>
          <button class="toolbar-button ${state.debug ? 'is-active' : ''}" id="debug-toggle" type="button">Debug</button>
          <button class="icon-button" id="flip" type="button" aria-label="Flip all boards">⇅</button>
        </div>
      </header>

      <div class="workspace">
        <section class="map mode-${state.view}" id="map" aria-label="${state.view === 'roots' ? 'Root position map' : 'Continuation line map'}">
          <svg class="edges" id="edges" aria-hidden="true"></svg>
          <div class="center-position position" data-key="${escapeHtml(state.center)}">
            <div class="center-board board-frame" id="center-board"></div>
            <div class="center-hint">${state.view === 'roots' ? 'Known move orders converge here.' : 'Drag a legal move, or choose a Line.'}</div>
          </div>
          <div id="satellites"></div>
          ${state.error ? `<div class="toast">${escapeHtml(state.error)}</div>` : ''}
        </section>

        <aside class="analysis-rail">
          <div class="rail-position">
            <div class="eyebrow">${opening ? `${escapeHtml(opening.eco ?? '')} · opening` : 'current position'}</div>
            <h1>${escapeHtml(opening?.name ?? 'Explore from here')}</h1>
            <div class="position-stats">
              ${total ? `<span>${compactGames(total)} games</span>` : '<span>no cached games yet</span>'}
              <span>${turn} to move</span>
              ${state.view === 'lines' && other >= 0.005 ? `<span>other · ${percent(other)}</span>` : ''}
            </div>
          </div>

          <div class="mode-tabs" role="tablist" aria-label="Graph direction">
            <button id="roots-tab" class="mode-tab ${state.view === 'roots' ? 'is-active' : ''}" type="button" role="tab" aria-selected="${state.view === 'roots'}">Roots <small>${rootCount || ''}</small></button>
            <button id="lines-tab" class="mode-tab ${state.view === 'lines' ? 'is-active' : ''}" type="button" role="tab" aria-selected="${state.view === 'lines'}">Lines <small>${lineCount || ''}</small></button>
          </div>

          <section class="rail-explorer">
            <div class="rail-section-head">
              <div><strong>${state.view === 'roots' ? 'Root Explorer' : 'Opening Explorer'}</strong><small>${state.view === 'roots' ? `${scene.selected.length} known positions · ${scene.incomingEdges.length} direct ${scene.incomingEdges.length === 1 ? 'Root' : 'Roots'}` : 'moves from this position'}</small></div>
            </div>
            ${railExplorerHtml(scene)}
          </section>
          ${debugRailHtml()}
        </aside>
      </div>
    </main>`;

  const centerEl = document.querySelector('#center-board');
  const centerApi = Chessground(centerEl, {
    fen: toPlayableFen(boardPosition),
    orientation: state.orientation,
    turnColor: turn,
    coordinates: true,
    animation: { enabled: true, duration: 180 },
    movable: {
      free: false,
      color: turn,
      dests: legalDestinations(boardPosition),
      showDests: true,
      events: {
        after: async (from, to) => {
          const result = await ensureManualEdge(boardPosition, from, to, 'q');
          if (result) recenter(result.target, { pushHistory: true });
          else render();
        },
      },
    },
    draggable: { enabled: true, showGhost: true },
    selectable: { enabled: true },
    highlight: { lastMove: true, check: true },
  });
  state.boardApis.push(centerApi);

  document.querySelector('#back')?.addEventListener('click', () => {
    if (state.navDepth > 0) history.back();
  });
  document.querySelector('#flip')?.addEventListener('click', () => {
    state.orientation = state.orientation === 'white' ? 'black' : 'white';
    localStorage.setItem('chessview.orientation', state.orientation);
    render();
  });

  bindRailControls();
  renderSatellites(scene);
}

function renderSatellites(scene) {
  const host = document.querySelector('#satellites');
  const positions = layoutPositions(scene.selected);

  scene.selected.forEach((item) => {
    const node = scene.nodes.get(item.key) ?? {};
    const point = positions.get(item.key);
    if (!point) return;
    const wrapper = document.createElement('button');
    wrapper.type = 'button';
    wrapper.className = `satellite position tier-${point.tier} relation-${item.relation}`;
    wrapper.dataset.key = item.key;
    wrapper.style.setProperty('--x', `${point.x}%`);
    wrapper.style.setProperty('--y', `${point.y}%`);
    wrapper.title = node.opening?.name ?? item.edge?.san ?? item.key;
    wrapper.innerHTML = `
      <span class="mini-label"><span class="relation">${relationLabel(item)}</span><strong>${escapeHtml(item.edge?.san ?? '')}</strong>${item.edge?.share ? `<span>${percent(item.edge.share)}</span>` : ''}</span>
      <span class="mini-board board-frame"></span>
      ${node.opening?.name ? `<span class="opening-label">${escapeHtml(node.opening.name)}</span>` : ''}`;
    wrapper.addEventListener('click', () => recenter(item.key, { pushHistory: true }));
    host.appendChild(wrapper);

    const boardEl = wrapper.querySelector('.mini-board');
    const api = Chessground(boardEl, {
      fen: toPlayableFen(item.key),
      orientation: state.orientation,
      coordinates: false,
      viewOnly: true,
      animation: { enabled: false },
      movable: { free: false, color: undefined },
      draggable: { enabled: false },
      selectable: { enabled: false },
    });
    state.boardApis.push(api);
  });

  requestAnimationFrame(() => drawEdges(scene));
}

function drawEdges(scene) {
  const map = document.querySelector('#map');
  const svg = document.querySelector('#edges');
  if (!map || !svg) return;
  const mapRect = map.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${mapRect.width} ${mapRect.height}`);
  svg.innerHTML = '';
  const elementFor = (key) => document.querySelector(`.position[data-key="${CSS.escape(key)}"]`);

  const addLine = (sourceKey, targetKey, strong = false) => {
    const source = elementFor(sourceKey);
    const target = elementFor(targetKey);
    if (!source || !target) return;
    const a = source.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const x1 = a.left + a.width / 2 - mapRect.left;
    const y1 = a.top + a.height / 2 - mapRect.top;
    const x2 = b.left + b.width / 2 - mapRect.left;
    const y2 = b.top + b.height / 2 - mapRect.top;
    const horizontal = x2 >= x1 ? 1 : -1;
    const bend = Math.max(28, Math.abs(x2 - x1) * 0.36);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${x1 + horizontal * bend} ${y1}, ${x2 - horizontal * bend} ${y2}, ${x2} ${y2}`);
    path.setAttribute('class', strong ? 'edge edge-strong' : 'edge');
    svg.appendChild(path);
  };

  for (const item of scene.selected) {
    addLine(item.edge?.source ?? state.center, item.edge?.target ?? item.key, (item.edge?.share ?? 0) >= 0.2);
  }
}

async function render() {
  const generation = ++state.generation;
  try {
    const scene = await collectScene(state.center, boardBudget());
    if (generation !== state.generation) return;
    state.scene = scene;
    renderShell(scene);
  } catch (error) {
    debugLog('render failed', error, 'error');
    state.error = error?.message ?? 'Could not render the opening map.';
    renderShell({ incomingEdges: [], incomingByTarget: new Map(), outgoingBySource: new Map(), selected: [], nodes: new Map([[state.center, { key: state.center }]]) });
  }
}

async function refreshDiscovery() {
  if (state.view !== 'lines') return;
  state.discoveryController?.abort();
  const controller = new AbortController();
  state.discoveryController = controller;
  const requestedCenter = state.center;
  state.loading = true;
  state.error = '';
  render();
  try {
    await discoverForViewport(requestedCenter, boardBudget(), () => {
      if (!controller.signal.aborted && requestedCenter === state.center && state.view === 'lines') render();
    }, { signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) return;
    debugLog('discovery failed', { center: requestedCenter, error: error?.message ?? String(error) }, 'error');
    if (requestedCenter === state.center) state.error = error?.message ?? 'Lichess Opening Explorer is temporarily unavailable.';
  } finally {
    if (state.discoveryController === controller && requestedCenter === state.center) {
      state.loading = false;
      render();
    }
  }
}

async function recenter(key, { pushHistory = false } = {}) {
  const next = canonicalPosition(key);
  if (next === state.center) return;
  const previous = state.center;
  state.center = next;
  state.error = '';
  if (pushHistory) {
    state.navDepth += 1;
    history.pushState({ fen: next, cvDepth: state.navDepth }, '', positionUrl(next));
  } else {
    history.replaceState({ fen: next, cvDepth: state.navDepth }, '', positionUrl(next));
  }
  debugLog('recenter', { from: previous, to: next, view: state.view, navDepth: state.navDepth });
  await render();
  if (state.view === 'lines') refreshDiscovery();
}

window.addEventListener('popstate', (event) => {
  state.center = positionFromUrl();
  state.view = viewFromUrl();
  state.navDepth = Number.isFinite(event.state?.cvDepth) ? event.state.cvDepth : 0;
  state.error = '';
  render().then(() => {
    if (state.view === 'lines') refreshDiscovery();
  });
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(render, 120);
});

const initialUrl = new URL(window.location.href);
initialUrl.searchParams.set('fen', state.center);
initialUrl.searchParams.set('view', state.view);
history.replaceState({ fen: state.center, cvDepth: state.navDepth }, '', `${initialUrl.pathname}${initialUrl.search}${initialUrl.hash}`);
await render();
if (state.view === 'lines') refreshDiscovery();