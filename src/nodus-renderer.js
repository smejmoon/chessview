import { Chessground } from '@lichess-org/chessground';
import './chessground-overrides.css';
import {
  legalDestinations,
  omittedShare,
  stableEdgeOrder,
  toPlayableFen,
} from './graph.js';
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
import { createPromotionChooser } from './promotion-chooser.js';
import {
  bindRecenterTarget,
  createBoardMoveRecenterHandler,
} from './recenter-input.js';
import { viewStatusSpec } from './view-status.js';

function percent(value) { return `${Math.round((value ?? 0) * 100)}%`; }
function compactGames(value = 0) { return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value); }
function escapeHtml(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function moveCueShapes(item, structure, mode) {
  const uci = item.edge?.uci;
  if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8]/.test(uci)) return [];
  if (mode === 'roots') {
    const node = structure.composition?.nodes?.find?.((candidate) => candidate.key === item.key);
    if (node?.merge) return [];
  }
  return [{ orig: uci.slice(0, 2), dest: uci.slice(2, 4), brush: 'green' }];
}

function mapCenterX(width) {
  if (width <= 460) return 34;
  if (width <= 760) return 31;
  if (width <= 1100) return 29;
  return 26;
}

function layoutPositions(items, viewportWidth) {
  const positions = new Map();
  const levels = new Map();
  for (const item of items) {
    if (!levels.has(item.distance)) levels.set(item.distance, []);
    levels.get(item.distance).push(item);
  }
  if (!levels.size) return positions;
  const maxDepth = Math.max(...levels.keys());
  const centerX = mapCenterX(viewportWidth);
  for (const [depth, level] of levels) {
    const x = centerX + (92 - centerX) * (depth / Math.max(1, maxDepth));
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
    composition: { nodes: [], relationships: [], families: [] },
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

export function createNodusRenderer({
  app = globalThis.document?.querySelector?.('#app'),
  preferences = {},
} = {}) {
  if (!app) throw new Error('Nodus renderer requires an app element');
  const document = app.ownerDocument ?? globalThis.document;
  const window = document?.defaultView ?? globalThis.window;
  const boards = new Set();
  const promotionChooser = createPromotionChooser({ app });

  function disposeBoards() {
    for (const api of boards) api?.destroy?.();
    boards.clear();
  }

  function bindControls(actions) {
    app.querySelector('#roots-tab')?.addEventListener('click', () => actions.setMode('roots'));
    app.querySelector('#lines-tab')?.addEventListener('click', () => actions.setMode('lines'));
    app.querySelectorAll('[data-nav-key]').forEach((button) => bindRecenterTarget(button, actions, () => button.dataset.navKey));
    app.querySelector('#back')?.addEventListener('click', actions.back);
    app.querySelector('#flip')?.addEventListener('click', actions.flip);
    app.querySelector('#guide-toggle')?.addEventListener('click', () => {
      preferences.setGuide?.(!preferences.getGuide?.());
      void actions.redraw();
    });
    app.querySelector('#debug-toggle')?.addEventListener('click', () => {
      setDebugEnabled(!isDebugEnabled());
      void actions.redraw();
    });
    app.querySelector('#debug-clear')?.addEventListener('click', () => {
      clearDebugLog();
      void actions.redraw();
    });
    app.querySelector('#debug-copy')?.addEventListener('click', async () => {
      try { await window?.navigator?.clipboard?.writeText?.(debugText()); debugLog('debug log copied'); }
      catch (error) { debugLog('debug copy failed', error, 'warn'); }
      void actions.redraw();
    });
  }

  function renderSatellites(view, structure, actions) {
    const host = app.querySelector('#satellites');
    if (!host) return;
    const positions = layoutPositions(structure.positions ?? [], window?.innerWidth ?? 1280);
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
      bindRecenterTarget(wrapper, actions, item.key);
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
        drawable: {
          enabled: false,
          visible: true,
          autoShapes: moveCueShapes(item, structure, view.mode),
        },
      }));
    }
  }

  function renderStatus(presentation) {
    const element = app.querySelector('#view-status');
    if (!element) return;
    const status = viewStatusSpec(presentation);
    element.className = `view-status is-${presentation}`;
    element.title = status.title;
    element.setAttribute('aria-label', status.title);
    const mark = element.querySelector('.view-status-mark');
    const label = element.querySelector('.view-status-label');
    if (mark) mark.textContent = status.mark;
    if (label) label.textContent = status.label;
  }

  function render(view, actions, presentation = 'hidden') {
    disposeBoards();
    const structure = view.structure.value ?? emptyStructure(view.center);
    const centerNode = structure.centerNode ?? { key: view.center };
    const explorer = centerNode.explorer;
    const status = viewStatusSpec(presentation);
    const turn = view.center.split(' ')[1] === 'b' ? 'black' : 'white';
    const rootCount = structure.incomingCount ?? 0;
    const lineCount = structure.lineEdges?.length ?? 0;
    const structuralError = view.structure.error;
    const debug = isDebugEnabled();
    const guide = preferences.getGuide?.() === true;
    const centerX = mapCenterX(window?.innerWidth ?? 1280);

    app.innerHTML = `<main class="app-shell"><header class="topbar"><a class="brand" href="${import.meta.env.BASE_URL}" aria-label="Chessview start position"><span class="brand-mark">♞</span><span>Chessview</span></a><div class="topbar-meta"><span class="network-status">Lichess · rated standard</span><span id="view-status" class="view-status is-${presentation}" role="status" aria-live="polite" aria-label="${escapeHtml(status.title)}"><span class="view-status-mark">${status.mark}</span><span class="view-status-label">${status.label}</span></span><button class="toolbar-button" id="back" type="button" ${view.navigation.canGoBack ? '' : 'disabled'}>← Back</button><button class="toolbar-button guide-toggle ${guide ? 'is-active' : ''}" id="guide-toggle" type="button">Guide</button><button class="toolbar-button ${debug ? 'is-active' : ''}" id="debug-toggle" type="button">Debug</button><button class="icon-button" id="flip" type="button" aria-label="Flip all boards">⇅</button></div></header><div class="workspace"><section class="map mode-${view.mode}" id="map"><svg class="edges" id="edges" aria-hidden="true"></svg><div class="center-position position" data-key="${escapeHtml(view.center)}" style="left:${centerX}%"><div class="center-board board-frame" id="center-board"></div><div class="center-hint">${view.mode === 'roots' ? 'Known move orders converge here.' : 'Drag a legal move, or choose a Line.'}</div></div><div id="satellites"></div>${structuralError ? `<div class="toast">${escapeHtml(structuralError)}</div>` : ''}</section><aside class="analysis-rail"><div class="rail-title">Rail</div><div class="rail-position rail-current-details"><div class="eyebrow">${centerNode.opening ? `${escapeHtml(centerNode.opening.eco ?? '')} · opening` : 'current position'}</div><h1>${escapeHtml(centerNode.opening?.name ?? 'Explore from here')}</h1><div class="position-stats">${centerNode.games ? `<span>${compactGames(centerNode.games)} games</span>` : '<span>no cached games yet</span>'}<span>${turn} to move</span>${view.mode === 'lines' && explorer && omittedShare(explorer) >= 0.005 ? `<span>other · ${percent(omittedShare(explorer))}</span>` : ''}</div></div><div class="mode-tabs" role="tablist"><button id="roots-tab" class="mode-tab ${view.mode === 'roots' ? 'is-active' : ''}" type="button">Roots <small>${rootCount}</small></button><button id="lines-tab" class="mode-tab ${view.mode === 'lines' ? 'is-active' : ''}" type="button">Lines <small>${lineCount}</small></button></div><section class="rail-explorer"><div class="rail-section-head"><div><strong>${view.mode === 'roots' ? 'Root Explorer' : 'Opening Explorer'}</strong></div></div>${railExplorerHtml(view, structure)}</section>${debugRailHtml()}</aside></div></main>`;

    const centerApi = Chessground(app.querySelector('#center-board'), {
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
          after: createBoardMoveRecenterHandler({
            source: view.center,
            actions,
            choosePromotion: (choices, { to }) => promotionChooser.choose({
              center: view.center,
              to,
              choices,
              orientation: view.orientation,
              color: turn,
            }),
          }),
        },
      },
      draggable: { enabled: true, showGhost: true },
      selectable: { enabled: true },
      highlight: { lastMove: true, check: true },
    });
    boards.add(centerApi);
    bindControls(actions);
    renderSatellites(view, structure, actions);
    decorateRootPresentation(app, view);
    decorateEvidencePresentation(app, view, actions, { showGuide: guide });
    promotionChooser.sync({ center: view.center, orientation: view.orientation, color: turn });
  }

  function renderFailure(view, actions, error, presentation = 'failed') {
    promotionChooser.cancel();
    disposeBoards();
    const status = viewStatusSpec(presentation);
    const detail = error?.message ?? String(error ?? 'Presentation failed');
    app.innerHTML = `<main class="app-shell"><header class="topbar"><a class="brand" href="${import.meta.env.BASE_URL}" aria-label="Chessview start position"><span class="brand-mark">♞</span><span>Chessview</span></a><div class="topbar-meta"><span id="view-status" class="view-status is-${presentation}" role="status" aria-live="polite" aria-label="${escapeHtml(status.title)}"><span class="view-status-mark">${status.mark}</span><span class="view-status-label">${status.label}</span></span><button class="toolbar-button" id="back" type="button" ${view?.navigation?.canGoBack ? '' : 'disabled'}>← Back</button><button class="toolbar-button" id="presentation-retry" type="button">Retry</button></div></header><div class="workspace"><section class="map"><div class="toast" title="${escapeHtml(detail)}">Chessview could not present this view.</div></section></div></main>`;
    app.querySelector('#back')?.addEventListener('click', actions.back);
    app.querySelector('#presentation-retry')?.addEventListener('click', () => { void actions.redraw(); });
  }

  function dispose() {
    promotionChooser.dispose();
    disposeBoards();
  }

  return Object.freeze({ render, renderFailure, renderStatus, dispose });
}
