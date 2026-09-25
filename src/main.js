import { Chessground } from '@lichess-org/chessground';
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';

import {
  canonicalPosition,
  chooseNeighborhood,
  legalDestinations,
  omittedShare,
  positionFromUrl,
  positionUrl,
  toPlayableFen,
} from './graph.js';
import { getIncoming, getNode, getOutgoing } from './db.js';
import { discoverForViewport, ensureManualEdge, loadExplorer } from './explorer.js';

const app = document.querySelector('#app');

const state = {
  center: positionFromUrl(),
  orientation: localStorage.getItem('chessview.orientation') === 'black' ? 'black' : 'white',
  loading: false,
  error: '',
  scene: null,
  boardApis: [],
  generation: 0,
};

function boardBudget() {
  const area = window.innerWidth * window.innerHeight;
  if (window.innerWidth < 620) return 6;
  if (window.innerWidth < 900 || area < 650_000) return 10;
  if (window.innerWidth < 1250 || area < 1_000_000) return 14;
  return 19;
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

async function collectScene(center, max) {
  const incomingEdges = await getIncoming(center);
  const incoming = await Promise.all(
    incomingEdges.map(async (edge) => {
      const node = await getNode(edge.source);
      return {
        key: edge.source,
        edge,
        games: node?.games ?? edge.games ?? 0,
        opening: node?.opening ?? null,
      };
    }),
  );

  const outgoingBySource = new Map();
  const queue = [{ key: center, depth: 0 }];
  const visited = new Set();
  while (queue.length && visited.size < max * 3) {
    const current = queue.shift();
    if (visited.has(current.key) || current.depth > max) continue;
    visited.add(current.key);
    const edges = await getOutgoing(current.key);
    outgoingBySource.set(current.key, edges);
    for (const edge of edges.filter((item) => item.qualifies)) {
      if (!visited.has(edge.target)) queue.push({ key: edge.target, depth: current.depth + 1 });
    }
  }

  const selected = chooseNeighborhood({ center, incoming, outgoingBySource, max });
  const selectedKeys = new Set(selected.map((item) => item.key));

  // Use spare slots for siblings reached from a known parent. They sit laterally
  // and help reveal move-order/transposition context without overwhelming the map.
  for (const parentEdge of incomingEdges) {
    if (selected.length >= max) break;
    const siblings = (await getOutgoing(parentEdge.source))
      .filter((edge) => edge.target !== center && (edge.qualifies || edge.manual))
      .sort((a, b) => (b.share ?? 0) - (a.share ?? 0) || a.uci.localeCompare(b.uci));
    for (const edge of siblings) {
      if (selected.length >= max) break;
      if (selectedKeys.has(edge.target)) continue;
      selectedKeys.add(edge.target);
      selected.push({ key: edge.target, edge, relation: 'lateral', distance: 2, branch: parentEdge.source });
    }
  }

  const nodes = new Map();
  await Promise.all(
    [center, ...selected.map((item) => item.key)].map(async (key) => {
      const node = await getNode(key);
      nodes.set(key, node ?? { key, fen: toPlayableFen(key) });
    }),
  );

  return { incomingEdges, outgoingBySource, selected, nodes };
}

function disposeBoards() {
  for (const api of state.boardApis) api?.destroy?.();
  state.boardApis = [];
}

function layoutPositions(items) {
  const positions = new Map();
  positions.set(state.center, { x: 50, y: 50, tier: 0 });

  const incoming = items.filter((item) => item.relation === 'incoming');
  const lateral = items.filter((item) => item.relation === 'lateral');
  const lower = items.filter((item) => item.relation === 'outgoing' || item.relation === 'descendant');

  incoming.forEach((item, index) => {
    const spread = incoming.length === 1 ? 0 : (index / (incoming.length - 1) - 0.5) * 58;
    positions.set(item.key, { x: 50 + spread, y: 13, tier: 1 });
  });

  lateral.forEach((item, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const row = Math.floor(index / 2);
    positions.set(item.key, { x: 50 + side * (38 + row * 5), y: 44 + row * 14, tier: 2 });
  });

  const roots = lower.filter((item) => item.distance === 1);
  const rootX = new Map();
  roots.forEach((item, index) => {
    const normalized = roots.length === 1 ? 0 : index / (roots.length - 1) - 0.5;
    rootX.set(item.branch ?? item.edge?.uci ?? item.key, 50 + normalized * 72);
  });

  const perBranchDepth = new Map();
  lower.forEach((item) => {
    const branch = item.branch ?? item.edge?.uci ?? item.key;
    if (!rootX.has(branch)) {
      const seed = [...branch].reduce((sum, char) => sum + char.charCodeAt(0), 0);
      rootX.set(branch, 18 + (seed % 65));
    }
    const depthIndex = perBranchDepth.get(branch) ?? 0;
    perBranchDepth.set(branch, depthIndex + 1);
    const xBase = rootX.get(branch);
    const wiggle = item.distance > 1 ? ((depthIndex % 2 ? 1 : -1) * Math.min(8, item.distance * 2)) : 0;
    const y = item.distance === 1 ? 79 : Math.min(92, 79 + (item.distance - 1) * 8);
    positions.set(item.key, { x: xBase + wiggle, y, tier: item.distance <= 1 ? 1 : 2 });
  });

  return positions;
}

function relationLabel(item) {
  if (item.relation === 'incoming') return 'from';
  if (item.relation === 'lateral') return 'sibling';
  if (item.distance > 1) return `+${item.distance}`;
  return 'next';
}

function renderShell(scene) {
  disposeBoards();
  const centerNode = scene.nodes.get(state.center) ?? {};
  const explorer = centerNode.explorer;
  const total = centerNode.games ?? 0;
  const other = explorer ? omittedShare(explorer) : 0;
  const opening = centerNode.opening;

  app.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <a class="brand" href="${import.meta.env.BASE_URL}" aria-label="Chessview start position">
          <span class="brand-mark">♞</span>
          <span>Chessview</span>
        </a>
        <div class="topbar-meta">
          <span class="network-status ${state.loading ? 'is-loading' : ''}">${state.loading ? 'mapping…' : state.error ? 'offline map' : 'Lichess · rated standard'}</span>
          <button class="icon-button" id="flip" type="button" aria-label="Flip all boards" title="Flip all boards">⇅</button>
        </div>
      </header>

      <section class="map" id="map" aria-label="Opening position map">
        <svg class="edges" id="edges" aria-hidden="true"></svg>
        <div class="center-position position" data-key="${escapeHtml(state.center)}">
          <div class="center-copy">
            <div class="eyebrow">${opening ? `${escapeHtml(opening.eco ?? '')} · opening` : 'current position'}</div>
            <h1>${escapeHtml(opening?.name ?? 'Explore from here')}</h1>
            <div class="position-stats">
              ${total ? `<span>${compactGames(total)} games</span>` : '<span>no cached games yet</span>'}
              ${other >= 0.005 ? `<span>other moves · ${percent(other)}</span>` : ''}
            </div>
          </div>
          <div class="center-board board-frame" id="center-board"></div>
          <div class="center-hint">Drag a legal move, or choose a nearby board.</div>
        </div>
        <div id="satellites"></div>
        ${state.error ? `<div class="toast">${escapeHtml(state.error)}</div>` : ''}
      </section>
    </main>
  `;

  const centerEl = document.querySelector('#center-board');
  const turn = state.center.split(' ')[1] === 'b' ? 'black' : 'white';
  const centerApi = Chessground(centerEl, {
    fen: toPlayableFen(state.center),
    orientation: state.orientation,
    coordinates: true,
    animation: { enabled: true, duration: 180 },
    movable: {
      free: false,
      color: turn,
      dests: legalDestinations(state.center),
      showDests: true,
      events: {
        after: async (from, to) => {
          const result = await ensureManualEdge(state.center, from, to, 'q');
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

  document.querySelector('#flip').addEventListener('click', () => {
    state.orientation = state.orientation === 'white' ? 'black' : 'white';
    localStorage.setItem('chessview.orientation', state.orientation);
    render();
  });

  renderSatellites(scene);
}

function renderSatellites(scene) {
  const host = document.querySelector('#satellites');
  const positions = layoutPositions(scene.selected);

  scene.selected.forEach((item) => {
    const node = scene.nodes.get(item.key) ?? {};
    const point = positions.get(item.key);
    const wrapper = document.createElement('button');
    wrapper.type = 'button';
    wrapper.className = `satellite position tier-${point.tier} relation-${item.relation}`;
    wrapper.dataset.key = item.key;
    wrapper.style.setProperty('--x', `${point.x}%`);
    wrapper.style.setProperty('--y', `${point.y}%`);
    wrapper.title = node.opening?.name ?? item.edge?.san ?? item.key;
    wrapper.innerHTML = `
      <span class="mini-label">
        <span class="relation">${relationLabel(item)}</span>
        <strong>${escapeHtml(item.edge?.san ?? '')}</strong>
        ${item.edge?.share ? `<span>${percent(item.edge.share)}</span>` : ''}
      </span>
      <span class="mini-board board-frame"></span>
      ${node.opening?.name ? `<span class="opening-label">${escapeHtml(node.opening.name)}</span>` : ''}
    `;
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
  const centerEl = elementFor(state.center);

  const addLine = (sourceKey, targetKey, strong = false) => {
    const source = elementFor(sourceKey) ?? centerEl;
    const target = elementFor(targetKey);
    if (!source || !target) return;
    const a = source.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const x1 = a.left + a.width / 2 - mapRect.left;
    const y1 = a.top + a.height / 2 - mapRect.top;
    const x2 = b.left + b.width / 2 - mapRect.left;
    const y2 = b.top + b.height / 2 - mapRect.top;
    const bend = Math.max(24, Math.abs(y2 - y1) * 0.34);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${y1 + (y2 > y1 ? bend : -bend)}, ${x2} ${y2 - (y2 > y1 ? bend : -bend)}, ${x2} ${y2}`);
    path.setAttribute('class', strong ? 'edge edge-strong' : 'edge');
    svg.appendChild(path);
  };

  for (const item of scene.selected) {
    if (item.relation === 'incoming') addLine(item.key, state.center, item.edge?.share >= 0.2);
    else if (item.relation === 'lateral') addLine(state.center, item.key, false);
    else addLine(item.edge?.source ?? state.center, item.key, item.edge?.share >= 0.2);
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
    state.error = error?.message ?? 'Could not render the opening map.';
    const fallback = { selected: [], nodes: new Map([[state.center, { key: state.center }]]) };
    renderShell(fallback);
  }
}

async function refreshDiscovery() {
  const generation = state.generation;
  state.loading = true;
  state.error = '';
  render();
  try {
    await discoverForViewport(state.center, boardBudget(), () => {
      if (generation <= state.generation) render();
    });
  } catch (error) {
    state.error = error?.message ?? 'Lichess Opening Explorer is temporarily unavailable.';
  } finally {
    state.loading = false;
    render();
  }
}

async function recenter(key, { pushHistory = false } = {}) {
  const next = canonicalPosition(key);
  if (next === state.center) return;
  state.center = next;
  state.error = '';
  if (pushHistory) history.pushState({ fen: next }, '', positionUrl(next));
  else history.replaceState({ fen: next }, '', positionUrl(next));
  await render();
  refreshDiscovery();
}

window.addEventListener('popstate', () => {
  state.center = positionFromUrl();
  render().then(refreshDiscovery);
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(render, 120);
});

history.replaceState({ fen: state.center }, '', positionUrl(state.center));
await render();
loadExplorer(state.center).catch(() => {});
refreshDiscovery();
