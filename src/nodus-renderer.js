import { Chessground } from '@lichess-org/chessground';
import {
  legalDestinations,
  omittedShare,
  stableEdgeOrder,
  toPlayableFen,
} from './graph.js';
import { ensureManualEdge } from './explorer.js';
import {
  clearDebugLog,
  debugLog,
  debugText,
  getDebugEntries,
  isDebugEnabled,
  setDebugEnabled,
} from './debug.js';
import { decorateEvidencePresentation } from './eval-ui.js';
import { decorateRootPresentation } from './root-presentation.js';
import { createViewStatusPresenter, viewStatusSpec } from './view-status.js';

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

function relationLabel(item, mode) {
  if (mode === 'roots') return item.distance === 1 ? 'root' : `−${item.distance}`;
  return item.distance > 1 ? `+${item.distance}` : 'line';
}

function emptyStructure(center) {
  return {
    composition: { center, direction: 'lines', nodes: [], relationships: [], families: [] },
    centerNode: { key: center },
    positions: [],
    incomingCount: 0,
    lineEdges: [],
    rootRows: [],
  };
}

function rootRowMap(structure) {
  return new Map((structure.rootRows ?? []).map((row) => [row.key, row]));
}

function railExplorerHtml(view, structure) {
  if (view.mode === 'lines') {
    const edges = (structure.lineEdges ?? []).slice().sort(stableEdgeOrder);
    if (!edges.length) {
      return `<div class="rail-empty">${view.structure.status === 'loading' ? 'Mapping continuations…' : 'No known Lines yet.'}</div>`;
    }
    return `<div class="explorer-list">${edges.slice(0, 14).map((edge) => `<button class="explorer-row" type="button" data-nav-key="${escapeHtml(edge.target)}"><span class="explorer-move">${escapeHtml(edge.san ?? edge.uci)}</span><span class="explorer-track"><span style="width:${Math.max(2, Math.round((edge.share ?? 0) * 100))}%"></span></span><span class="explorer-share">${percent(edge.share)}</span><span class="explorer-games">${compactGames(edge.games ?? 0)}</span></button>`).join('')}</div>`;
  }
  if (!(structure.positions ?? []).length) {
    return '<div class="rail-empty">No known Roots yet. Roots grow as Chessview discovers positions through Lines.</div>';
  }
  const labels = rootRowMap(structure);
  return `<div class="explorer-list">${structure.positions.map((item) => {
    const row = labels.get(item.key);
    const name = row?.label ?? item.record?.opening?.name ?? 'known position';
    const title = row?.title ? ` title="${escapeHtml(row.title)}"` : '';
    return `<button class="explorer-row roots-row" type="button" data-nav-key="${escapeHtml(item.key)}"><span class="root-depth">${item.distance === 1 ? 'root' : `−${item.distance}`}</span><span class="explorer-move">${escapeHtml(item.edge?.san ?? item.edge?.uci ?? '')}</span><span class="root-name"${title}>${escapeHtml(name)}</span><span class="explorer-share">${item.edge?.share ? percent(item.edge.share) : ''}</span><span class="explorer-games">${item.edge?.games ? compactGames(item.edge.games) : ''}</span></button>`;
  }).join('')}</div>`;
}

function debugRailHtml() {
  if (!isDebugEnabled()) return '';
  return `<section class="rail-debug" aria-label="Chessview debug log"><div class="debug-head"><div class="debug-title">Debug <small>${getDebugEntries().length} events</small></div><div class="debug-actions"><button class="debug-action" id="debug-copy" type="button">Copy</button><button class="debug-action" id="debug-clear" type="button">Clear</button></div></div><pre class="debug-log" id="debug-log">${escapeHtml(debugText())}</pre></section>`;
}

function bindControls(actions) {
  document.querySelector('#roots-tab')?.addEventListener('click', () => actions.setMode('roots'));
  document.querySelector('#lines-tab')?.addEventListener('click', () => actions.setMode('lines'));
  document.querySelectorAll('[data-nav-key]').forEach((button) => button.addEventListener('click', () => actions.navigate(button.dataset.navKey)));
  document.querySelector('#back')?.addEventListener('click', actions.back);
  document.querySelector('#flip')?.addEventListener('click', actions.flip);
  document.querySelector('#debug-toggle')?.addEventListener('click', () => {
    setDebugEnabled(!isDebugEnabled());
    void actions.redraw();
  });
  document.querySelector('#debug-clear')?.addEventListener('click', () => {
    clearDebugLog();
    void actions.redraw();
  });
  document.querySelector('#debug-copy')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(debugText()); debugLog('debug log copied'); }
    catch (error) { debugLog('debug copy failed', error, 'warn'); }
    void actions.redraw();
  });
}

export function createNodusRenderer({ app = document.querySelector('#app') } = {}) {
  if (!app) throw new Error('Nodus renderer requires an app element');
  const boards = new Set();
  const statusPresenter = createViewStatusPresenter();

  function disposeBoards() {
    for (const api of boards) api?.destroy?.();
    boards.clear();
  }

  function renderSatellites(view, structure, actions) {
    const host = document.querySelector('#satellites');
    if (!host) return;
    const positions = layoutPositions(structure.positions ?? []);
    for (const item of structure.positions ?? []) {
      const point = positions.get(item.key);
      if (!point) continue;
      const node = item.record ?? {};
      const wrapper = document.createElement('button');
      wrapper.type = 'button';
      wrapper.className = `satellite position tier-${point.tier} relation-${item.relation}`;
      wrapper.dataset.key = item.key;
      wrapper.style.setProperty('--x', `${point.x}%`);
      wrapper.style.setProperty('--y', `${point.y}%`);
      wrapper.innerHTML = `<span class="mini-label"><span class="relation">${relationLabel(item, view.mode)}</span><strong>${escapeHtml(item.edge?.san ?? '')}</strong></span><span class="mini-board board-frame"></span>${node.opening?.name ? `<span class="opening-label">${escapeHtml(node.opening.name)}</span>` : ''}`;
      wrapper.addEventListener('click', () => actions.navigate(item.key));
      host.appendChild(wrapper);
      boards.add(Chessground(wrapper.querySelector('.mini-board'), {
        fen: toPlayableFen(item.key),
        orientation: view.orientation,
        coordinates: false,
        viewOnly: true,
        animation: { enabled: false },
        movable: { free: false, color: undefined },
        draggable: { enabled: false },
        selectable: { enabled: false },
      }));
    }
  }

  function render(view, actions) {
    statusPresenter.update(view);
    disposeBoards();
    const structure = view.structure.value ?? emptyStructure(view.center);
    const centerNode = structure.centerNode ?? { key: view.center };
    const explorer = centerNode.explorer;
    const status = viewStatusSpec(statusPresenter.presentation);
    const turn = view.center.split(' ')[1] === 'b' ? 'black' : 'white';
    const rootCount = structure.incomingCount ?? 0;
    const lineCount = structure.lineEdges?.length ?? 0;
    const structuralError = view.structure.error;
    const debug = isDebugEnabled();

    app.innerHTML = `<main class="app-shell"><header class="topbar"><a class="brand" href="${import.meta.env.BASE_URL}" aria-label="Chessview start position"><span class="brand-mark">♞</span><span>Chessview</span></a><div class="topbar-meta"><span class="network-status">Lichess · rated standard</span><span id="view-status" class="view-status is-${statusPresenter.presentation}" role="status" aria-live="polite" aria-label="${escapeHtml(status.title)}"><span class="view-status-mark">${status.mark}</span><span class="view-status-label">${status.label}</span></span><button class="toolbar-button" id="back" type="button" ${view.navigation.canGoBack ? '' : 'disabled'}>← Back</button><button class="toolbar-button ${debug ? 'is-active' : ''}" id="debug-toggle" type="button">Debug</button><button class="icon-button" id="flip" type="button" aria-label="Flip all boards">⇅</button></div></header><div class="workspace"><section class="map mode-${view.mode}" id="map"><svg class="edges" id="edges" aria-hidden="true"></svg><div class="center-position position" data-key="${escapeHtml(view.center)}" style="left:${mapCenterX()}%"><div class="center-board board-frame" id="center-board"></div><div class="center-hint">${view.mode === 'roots' ? 'Known move orders converge here.' : 'Drag a legal move, or choose a Line.'}</div></div><div id="satellites"></div>${structuralError ? `<div class="toast">${escapeHtml(structuralError)}</div>` : ''}</section><aside class="analysis-rail"><div class="rail-position"><div class="eyebrow">${centerNode.opening ? `${escapeHtml(centerNode.opening.eco ?? '')} · opening` : 'current position'}</div><h1>${escapeHtml(centerNode.opening?.name ?? 'Explore from here')}</h1><div class="position-stats">${centerNode.games ? `<span>${compactGames(centerNode.games)} games</span>` : '<span>no cached games yet</span>'}<span>${turn} to move</span>${view.mode === 'lines' && explorer && omittedShare(explorer) >= 0.005 ? `<span>other · ${percent(omittedShare(explorer))}</span>` : ''}</div></div><div class="mode-tabs" role="tablist"><button id="roots-tab" class="mode-tab ${view.mode === 'roots' ? 'is-active' : ''}" type="button">Roots <small>${rootCount}</small></button><button id="lines-tab" class="mode-tab ${view.mode === 'lines' ? 'is-active' : ''}" type="button">Lines <small>${lineCount}</small></button></div><section class="rail-explorer"><div class="rail-section-head"><div><strong>${view.mode === 'roots' ? 'Root Explorer' : 'Opening Explorer'}</strong></div></div>${railExplorerHtml(view, structure)}</section>${debugRailHtml()}</aside></div></main>`;

    const centerApi = Chessground(document.querySelector('#center-board'), {
      fen: toPlayableFen(view.center),
      orientation: view.orientation,
      turnColor: turn,
      coordinates: true,
      animation: { enabled: true, duration: 180 },
      movable: {
        free: false,
        color: turn,
        dests: legalDestinations(view.center),
        showDests: true,
        events: {
          after: async (from, to) => {
            const result = await ensureManualEdge(view.center, from, to, 'q');
            if (result) await actions.navigate(result.target);
            else await actions.redraw();
          },
        },
      },
      draggable: { enabled: true, showGhost: true },
      selectable: { enabled: true },
      highlight: { lastMove: true, check: true },
    });
    boards.add(centerApi);
    bindControls(actions);
    renderSatellites(view, structure, actions);
    decorateRootPresentation(view);
    decorateEvidencePresentation(view, actions);
    statusPresenter.paint();
  }

  function dispose() {
    statusPresenter.dispose();
    disposeBoards();
  }

  return Object.freeze({ render, dispose });
}
