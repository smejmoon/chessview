import { Chessground } from '@lichess-org/chessground';
import './chessground-overrides.css';
import {
  legalDestinations,
  toPlayableFen,
} from './graph.js';
import type { NodusActions, Orientation } from './nodus-controller.ts';
import type { ViewMode } from './route-ledger.ts';
import {
  clearDebugLog,
  debugLog,
  debugText,
  getDebugEntries,
  isDebugEnabled,
  setDebugEnabled,
} from './debug.js';
import { decorateEvidencePresentation } from './eval-ui.js';
import { decorateLichessEvalStatus } from './lichess-eval-presentation.js';
import { decorateRootPresentation } from './root-presentation.js';
import { createPromotionChooser } from './promotion-chooser.js';
import {
  bindRecenterTarget,
  createBoardMoveRecenterHandler,
} from './recenter-input.js';
import { viewStatusSpec } from './view-status.js';

type ChessgroundConfig = NonNullable<Parameters<typeof Chessground>[1]>;
type BoardApi = ReturnType<typeof Chessground>;

type DisplayEdge = Readonly<{
  target?: string;
  san?: string;
  uci?: string;
  share?: number;
  games?: number;
}>;

type Opening = Readonly<{
  eco?: string;
  name?: string;
}>;

type PositionRecord = Readonly<{
  key?: string;
  fen?: string;
  games?: number;
  opening?: Opening;
}>;

type CompositionNode = Readonly<{
  key: string;
  merge?: boolean;
}>;

type RendererPosition = Readonly<{
  key: string;
  distance: number;
  relation?: string;
  edge?: DisplayEdge;
  record?: PositionRecord;
}>;

type RootRow = Readonly<{
  key: string;
  label: string;
  title?: string;
}>;

type RendererStructure = Readonly<{
  composition?: Readonly<{
    nodes?: readonly CompositionNode[];
    relationships?: readonly unknown[];
    families?: readonly unknown[];
  }>;
  centerNode?: PositionRecord;
  positions?: readonly RendererPosition[];
  rootRows?: readonly RootRow[];
}>;

type RailLine = Readonly<{
  edge?: DisplayEdge;
  frequency?: Readonly<{
    share?: number;
    games?: number;
  }> | null;
}>;

type RailValue = Readonly<{
  rootsCount?: number;
  notableLinesCount?: number;
  lines?: readonly RailLine[];
}>;

type Lifecycle<T> = Readonly<{
  status?: string;
  value?: T | null;
  error?: string | null;
}>;

export type RendererView = Readonly<{
  center: string;
  mode: ViewMode;
  orientation: Orientation;
  navigation: Readonly<{ canGoBack: boolean }>;
  structure: Lifecycle<RendererStructure>;
  evidence?: unknown;
  rail?: Lifecycle<RailValue>;
}>;

type RendererPreferences = Readonly<{
  getGuide?: () => boolean;
  setGuide?: (enabled: boolean) => void;
}>;

export type NodusRendererOptions = Readonly<{
  app?: Element | null;
  preferences?: RendererPreferences;
}>;

type LayoutPoint = Readonly<{
  x: number;
  y: number;
  tier: 1 | 2;
}>;

function percent(value?: number | null): string {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function compactGames(value = 0): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function escapeHtml(value: unknown = ''): string {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(error ?? 'Presentation failed');
}

function moveCueShapes(item: RendererPosition, structure: RendererStructure, mode: ViewMode) {
  const uci = item.edge?.uci;
  if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8]/.test(uci)) return [];
  if (mode === 'roots') {
    const node = structure.composition?.nodes?.find((candidate) => candidate.key === item.key);
    if (node?.merge) return [];
  }
  return [{ orig: uci.slice(0, 2), dest: uci.slice(2, 4), brush: 'green' }];
}

function mapCenterX(width: number): number {
  if (width <= 460) return 34;
  if (width <= 760) return 31;
  if (width <= 1100) return 29;
  return 26;
}

function layoutPositions(items: readonly RendererPosition[], viewportWidth: number): Map<string, LayoutPoint> {
  const positions = new Map<string, LayoutPoint>();
  const levels = new Map<number, RendererPosition[]>();
  for (const item of items) {
    if (!levels.has(item.distance)) levels.set(item.distance, []);
    levels.get(item.distance)?.push(item);
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

function relationLabel(item: RendererPosition, mode: ViewMode): string {
  if (mode === 'roots') return item.distance === 1 ? 'root' : `−${item.distance}`;
  return item.distance > 1 ? `+${item.distance}` : 'line';
}

function emptyStructure(center: string): RendererStructure {
  return {
    composition: { nodes: [], relationships: [], families: [] },
    centerNode: { key: center },
    positions: [],
    rootRows: [],
  };
}

function rootRowMap(structure: RendererStructure): Map<string, RootRow> {
  return new Map((structure.rootRows ?? []).map((row) => [row.key, row]));
}

function railExplorerHtml(view: RendererView, structure: RendererStructure): string {
  if (view.mode === 'lines') {
    const rows = view.rail?.value?.lines ?? [];
    if (!rows.length) {
      return `<div class="rail-empty">${view.rail?.status === 'loading' ? 'Loading Lichess Lines…' : 'No Lichess Lines yet.'}</div>`;
    }
    return `<div class="explorer-list">${rows.map((row) => {
      const edge = row.edge ?? {};
      const share = row.frequency?.share ?? edge.share ?? 0;
      const games = row.frequency?.games ?? edge.games ?? 0;
      return `<button class="explorer-row" type="button" data-nav-key="${escapeHtml(edge.target)}"><span class="explorer-move">${escapeHtml(edge.san ?? edge.uci)}</span><span class="explorer-track"><span style="width:${Math.max(2, Math.round(share * 100))}%"></span></span><span class="explorer-share">${share > 0 ? percent(share) : ''}</span><span class="explorer-games">${games > 0 ? compactGames(games) : ''}</span></button>`;
    }).join('')}</div>`;
  }
  if (!(structure.positions ?? []).length) {
    return '<div class="rail-empty">No known Roots yet. Roots grow as Chessview discovers positions through Lines.</div>';
  }
  const labels = rootRowMap(structure);
  return `<div class="explorer-list">${(structure.positions ?? []).map((item) => {
    const row = labels.get(item.key);
    const name = row?.label ?? item.record?.opening?.name ?? 'known position';
    const title = row?.title ? ` title="${escapeHtml(row.title)}"` : '';
    return `<button class="explorer-row roots-row" type="button" data-nav-key="${escapeHtml(item.key)}"><span class="root-depth">${item.distance === 1 ? 'root' : `−${item.distance}`}</span><span class="explorer-move">${escapeHtml(item.edge?.san ?? item.edge?.uci ?? '')}</span><span class="root-name"${title}>${escapeHtml(name)}</span><span class="explorer-share">${item.edge?.share ? percent(item.edge.share) : ''}</span><span class="explorer-games">${item.edge?.games ? compactGames(item.edge.games) : ''}</span></button>`;
  }).join('')}</div>`;
}

function debugRailHtml(): string {
  if (!isDebugEnabled()) return '';
  return `<section class="rail-debug" aria-label="Chessview debug log"><div class="debug-head"><div class="debug-title">Debug <small>${getDebugEntries().length} events</small></div><div class="debug-actions"><button class="debug-action" id="debug-copy" type="button">Copy</button><button class="debug-action" id="debug-clear" type="button">Clear</button></div></div><pre class="debug-log" id="debug-log">${escapeHtml(debugText())}</pre></section>`;
}

export function createNodusRenderer({
  app: appOption = null,
  preferences = {},
}: NodusRendererOptions = {}) {
  const app = (appOption ?? globalThis.document?.querySelector('#app') ?? null) as Element;
  if (!app) throw new Error('Nodus renderer requires an app element');
  const document = app.ownerDocument ?? globalThis.document;
  const window = document.defaultView ?? globalThis.window;
  const boards = new Set<BoardApi>();
  const promotionChooser = createPromotionChooser({ app });
  let lichessEvalStatus: unknown = null;

  function disposeBoards(): void {
    for (const api of boards) api.destroy?.();
    boards.clear();
  }

  function bindControls(actions: NodusActions): void {
    app.querySelector('#roots-tab')?.addEventListener('click', () => actions.setMode('roots'));
    app.querySelector('#lines-tab')?.addEventListener('click', () => actions.setMode('lines'));
    app.querySelectorAll('[data-nav-key]').forEach((button) => {
      bindRecenterTarget(button, actions, () => (button as HTMLElement).dataset.navKey);
    });
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
      try {
        await window.navigator?.clipboard?.writeText?.(debugText());
        debugLog('debug log copied');
      } catch (error) {
        debugLog('debug copy failed', error, 'warn');
      }
      void actions.redraw();
    });
  }

  function renderSatellites(view: RendererView, structure: RendererStructure, actions: NodusActions): void {
    const host = app.querySelector('#satellites');
    if (!host) return;
    const positions = layoutPositions(structure.positions ?? [], window.innerWidth ?? 1280);
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
      const miniBoard = wrapper.querySelector('.mini-board') as HTMLElement | null;
      if (!miniBoard) continue;
      boards.add(Chessground(miniBoard, {
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
      } as ChessgroundConfig));
    }
  }

  function renderStatus(presentation: string): void {
    const element = app.querySelector('#view-status') as HTMLElement | null;
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

  function renderLichessEvalStatus(status: unknown): void {
    lichessEvalStatus = status;
    decorateLichessEvalStatus(app, status);
  }

  function render(view: RendererView, actions: NodusActions, presentation = 'hidden'): void {
    disposeBoards();
    const structure = view.structure.value ?? emptyStructure(view.center);
    const centerNode = structure.centerNode ?? { key: view.center };
    const status = viewStatusSpec(presentation);
    const turn: Orientation = view.center.split(' ')[1] === 'b' ? 'black' : 'white';
    const rootCount = view.rail?.value?.rootsCount ?? 0;
    const lineCount = view.rail?.value?.notableLinesCount ?? 0;
    const structuralError = view.structure.error;
    const debug = isDebugEnabled();
    const guide = preferences.getGuide?.() === true;
    const centerX = mapCenterX(window.innerWidth ?? 1280);

    app.innerHTML = `<main class="app-shell"><header class="topbar"><a class="brand" href="${import.meta.env.BASE_URL}" aria-label="Chessview start position"><span class="brand-mark">♞</span><span>Chessview</span></a><div class="topbar-meta"><span class="network-status">Lichess · rated standard</span><span id="view-status" class="view-status is-${presentation}" role="status" aria-live="polite" aria-label="${escapeHtml(status.title)}"><span class="view-status-mark">${status.mark}</span><span class="view-status-label">${status.label}</span></span><button class="toolbar-button" id="back" type="button" ${view.navigation.canGoBack ? '' : 'disabled'}>← Back</button><button class="toolbar-button guide-toggle ${guide ? 'is-active' : ''}" id="guide-toggle" type="button">Guide</button><button class="toolbar-button ${debug ? 'is-active' : ''}" id="debug-toggle" type="button">Debug</button><button class="icon-button" id="flip" type="button" aria-label="Flip all boards">⇅</button></div></header><div class="workspace"><section class="map mode-${view.mode}" id="map"><svg class="edges" id="edges" aria-hidden="true"></svg><div class="center-position position" data-key="${escapeHtml(view.center)}" style="left:${centerX}%"><div class="center-board board-frame" id="center-board"></div><div class="center-hint">${view.mode === 'roots' ? 'Known move orders converge here.' : 'Drag a legal move, or choose a Line.'}</div></div><div id="satellites"></div>${structuralError ? `<div class="toast">${escapeHtml(structuralError)}</div>` : ''}</section><aside class="analysis-rail"><div class="rail-title">Rail</div><div class="rail-position rail-current-details"><div class="eyebrow">${centerNode.opening ? `${escapeHtml(centerNode.opening.eco ?? '')} · opening` : 'current position'}</div><h1>${escapeHtml(centerNode.opening?.name ?? 'Explore from here')}</h1><div class="position-stats">${centerNode.games ? `<span>${compactGames(centerNode.games)} games</span>` : '<span>no cached games yet</span>'}<span>${turn} to move</span></div></div><div class="mode-tabs" role="tablist"><button id="roots-tab" class="mode-tab ${view.mode === 'roots' ? 'is-active' : ''}" type="button">Roots <small>${rootCount}</small></button><button id="lines-tab" class="mode-tab ${view.mode === 'lines' ? 'is-active' : ''}" type="button">Lines <small>${lineCount}</small></button></div><section class="rail-explorer"><div class="rail-section-head"><div><strong>${view.mode === 'roots' ? 'Root Explorer' : 'Opening Explorer'}</strong></div></div>${railExplorerHtml(view, structure)}</section>${debugRailHtml()}</aside></div></main>`;
    renderLichessEvalStatus(lichessEvalStatus);

    const centerBoard = app.querySelector('#center-board') as HTMLElement | null;
    if (!centerBoard) throw new Error('Nodus renderer could not create the center board');
    const centerApi = Chessground(centerBoard, {
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
            choosePromotion: (choices: readonly string[], { to }: { to: string }) => promotionChooser.choose({
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
    } as ChessgroundConfig);
    boards.add(centerApi);
    bindControls(actions);
    renderSatellites(view, structure, actions);
    decorateRootPresentation(app, view);
    decorateEvidencePresentation(app, view, actions, { showGuide: guide });
    promotionChooser.sync({ center: view.center, orientation: view.orientation, color: turn });
  }

  function renderFailure(
    view: RendererView | null | undefined,
    actions: NodusActions,
    error: unknown,
    presentation = 'failed',
  ): void {
    promotionChooser.cancel();
    disposeBoards();
    const status = viewStatusSpec(presentation);
    const detail = errorMessage(error);
    app.innerHTML = `<main class="app-shell"><header class="topbar"><a class="brand" href="${import.meta.env.BASE_URL}" aria-label="Chessview start position"><span class="brand-mark">♞</span><span>Chessview</span></a><div class="topbar-meta"><span class="network-status">Lichess · rated standard</span><span id="view-status" class="view-status is-${presentation}" role="status" aria-live="polite" aria-label="${escapeHtml(status.title)}"><span class="view-status-mark">${status.mark}</span><span class="view-status-label">${status.label}</span></span><button class="toolbar-button" id="back" type="button" ${view?.navigation?.canGoBack ? '' : 'disabled'}>← Back</button><button class="toolbar-button" id="presentation-retry" type="button">Retry</button></div></header><div class="workspace"><section class="map"><div class="toast" title="${escapeHtml(detail)}">Chessview could not present this view.</div></section></div></main>`;
    renderLichessEvalStatus(lichessEvalStatus);
    app.querySelector('#back')?.addEventListener('click', actions.back);
    app.querySelector('#presentation-retry')?.addEventListener('click', () => { void actions.redraw(); });
  }

  function dispose(): void {
    promotionChooser.dispose();
    disposeBoards();
  }

  return Object.freeze({ render, renderFailure, renderStatus, renderLichessEvalStatus, dispose });
}
