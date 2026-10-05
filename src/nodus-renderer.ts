import { Chessground } from '@lichess-org/chessground';
import './chessground-overrides.css';
import './presentation-geometry.css';
import { legalDestinations, toPlayableFen } from './graph.js';
import type { CurrentViewActions } from './current-view-controller.ts';
import { createLens } from './lens.ts';
import type { Lens, Orientation } from './lens.ts';
import type { ViewMode } from './route-ledger.ts';
import { clearDebugLog, debugLog, debugText, getDebugEntries } from './debug.js';
import { decorateEvidencePresentation } from './eval-ui.js';
import { decorateLichessEvalStatus } from './lichess-eval-presentation.js';
import { decorateRootPresentation } from './root-presentation.js';
import { createPromotionChooser } from './promotion-chooser.js';
import { bindRecenterTarget, createBoardMoveRecenterHandler } from './recenter-input.js';
import { placeLineFamilies, placeRootFamilies } from './presentation-geometry.js';
import type { PresentationGeometry, PresentationSlot } from './presentation-geometry.ts';
import { viewStatusSpec } from './view-status.js';

type ChessgroundConfig = NonNullable<Parameters<typeof Chessground>[1]>;
type BoardApi = ReturnType<typeof Chessground>;
type DisplayEdge = Readonly<{ target?: string; san?: string; uci?: string; share?: number; games?: number }>;
type Opening = Readonly<{ eco?: string; name?: string }>;
type PositionRecord = Readonly<{ key?: string; fen?: string; games?: number; opening?: Opening }>;
type CompositionNode = Readonly<{ key: string; relation?: string; merge?: boolean }>;
type RendererPosition = Readonly<{
  key: string;
  distance: number;
  relation?: string;
  branch?: string;
  families?: readonly string[];
  edge?: DisplayEdge;
  record?: PositionRecord;
}>;
type RendererStructure = Readonly<{
  composition?: Readonly<{ nodes?: readonly CompositionNode[]; relationships?: readonly unknown[]; families?: readonly unknown[] }>;
  centerNode?: PositionRecord;
  positions?: readonly RendererPosition[];
}>;
type RailLine = Readonly<{ edge?: DisplayEdge; frequency?: Readonly<{ share?: number; games?: number }> | null }>;
type RailValue = Readonly<{ lines?: readonly RailLine[] }>;
type Lifecycle<T> = Readonly<{ status?: string; value?: T | null; error?: string | null }>;

type CenterBoardState = Readonly<{
  api: BoardApi;
  center: string;
  orientation: Orientation;
  rootContext: boolean;
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
type RendererMaintenance = Readonly<{
  refetchView?: (positions: readonly string[]) => unknown | Promise<unknown>;
  clearExplorerCache?: () => unknown | Promise<unknown>;
}>;
export type NodusRendererOptions = Readonly<{
  app?: Element | null;
  lens?: Lens | null;
  maintenance?: RendererMaintenance;
}>;

function percent(value?: number | null): string { return `${Math.round((value ?? 0) * 100)}%`; }
function compactGames(value = 0): string { return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value); }
function escapeHtml(value: unknown = ''): string { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string') return (error as { message: string }).message;
  return String(error ?? 'Presentation failed');
}
function isRootContext(item: RendererPosition): boolean { return item.relation === 'root' || item.relation === 'sibling'; }
function relationLabel(item: RendererPosition): string {
  if (item.relation === 'root') return 'root';
  if (item.relation === 'sibling') return 'sibling';
  return item.distance > 1 ? `+${item.distance}` : 'line';
}
function familyFor(item: RendererPosition): string { return item.branch ?? item.families?.[0] ?? item.edge?.uci ?? item.key; }
function moveCueShapes(item: RendererPosition, structure: RendererStructure) {
  const uci = item.edge?.uci;
  if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8]/.test(uci)) return [];
  const node = structure.composition?.nodes?.find((candidate) => candidate.key === item.key);
  if (isRootContext(item) && node?.merge) return [];
  return [{ orig: uci.slice(0, 2), dest: uci.slice(2, 4), brush: 'green' }];
}
function emptyStructure(center: string): RendererStructure {
  return { composition: { nodes: [], relationships: [], families: [] }, centerNode: { key: center }, positions: [] };
}
function railExplorerHtml(view: RendererView): string {
  const rows = view.rail?.value?.lines ?? [];
  if (!rows.length) return `<div class="rail-empty">${view.rail?.status === 'loading' ? 'Loading Lichess Lines…' : 'No Lichess Lines yet.'}</div>`;
  return `<div class="explorer-list">${rows.map((row) => {
    const edge = row.edge ?? {};
    const share = row.frequency?.share ?? edge.share ?? 0;
    const games = row.frequency?.games ?? edge.games ?? 0;
    return `<button class="explorer-row" type="button" data-nav-key="${escapeHtml(edge.target)}"><span class="explorer-move">${escapeHtml(edge.san ?? edge.uci)}</span><span class="explorer-track"><span style="width:${Math.max(2, Math.round(share * 100))}%"></span></span><span class="explorer-share">${share > 0 ? percent(share) : ''}</span><span class="explorer-games">${games > 0 ? compactGames(games) : ''}</span></button>`;
  }).join('')}</div>`;
}
function debugRailHtml(debug: boolean): string {
  if (!debug) return '';
  return `<section class="rail-debug" aria-label="Chessview debug log"><div class="debug-head"><div class="debug-title">Debug <small>${getDebugEntries().length} events</small></div><div class="debug-actions"><button class="debug-action" id="debug-copy" type="button">Copy</button><button class="debug-action" id="debug-clear" type="button">Clear</button></div></div><div class="debug-maintenance"><button class="debug-action" id="debug-refetch-view" type="button">Refetch view</button><button class="debug-action" id="debug-clear-explorer" type="button">Clear Explorer cache</button></div><pre class="debug-log" id="debug-log">${escapeHtml(debugText())}</pre></section>`;
}
function rootContextButton(rootContext: boolean): string {
  return `<button id="root-context-toggle" class="root-context-toggle ${rootContext ? 'is-active' : ''}" type="button" aria-pressed="${rootContext}">Roots + siblings</button>`;
}
function railHtml(view: RendererView, centerNode: PositionRecord, turn: Orientation, debug: boolean): string {
  const lineCount = view.rail?.value?.lines?.length ?? 0;
  return `<div class="rail-title">Rail</div><div class="rail-position rail-current-details"><div class="eyebrow">${centerNode.opening ? `${escapeHtml(centerNode.opening.eco ?? '')} · opening` : 'current position'}</div><h1>${escapeHtml(centerNode.opening?.name ?? 'Explore from here')}</h1><div class="position-stats">${centerNode.games ? `<span>${compactGames(centerNode.games)} games</span>` : '<span>no cached games yet</span>'}<span>${turn} to move</span></div></div><section class="rail-explorer"><div class="rail-section-head"><div><strong>Opening Explorer</strong><small>${lineCount} Lines</small></div></div>${railExplorerHtml(view)}</section>${debugRailHtml(debug)}`;
}

export function createNodusRenderer({ app: appOption = null, lens: lensOption = null, maintenance = {} }: NodusRendererOptions = {}) {
  const app = (appOption ?? globalThis.document?.querySelector('#app') ?? null) as Element;
  if (!app) throw new Error('Nodus renderer requires an app element');
  const document = app.ownerDocument ?? globalThis.document;
  const window = document.defaultView ?? globalThis.window;
  const lens = lensOption ?? createLens({ app });
  const satelliteBoards = new Set<BoardApi>();
  const promotionChooser = createPromotionChooser({ app });
  let centerBoardState: CenterBoardState | null = null;
  let lichessEvalStatus: unknown = null;
  let debugPinnedToLatest = true;
  let debugScrollTop = 0;

  function disposeSatelliteBoards(): void { for (const api of satelliteBoards) api.destroy?.(); satelliteBoards.clear(); }
  function disposeCenterBoard(): void { centerBoardState?.api.destroy?.(); centerBoardState = null; }
  function disposeBoards(): void { disposeSatelliteBoards(); disposeCenterBoard(); }

  function visiblePositions(view: RendererView): readonly string[] {
    return Object.freeze([...new Set([
      view.center,
      ...((view.structure.value?.positions ?? []).map((position) => position.key)),
    ])]);
  }

  function bindDebugScroll(): void {
    const log = app.querySelector('#debug-log') as HTMLElement | null;
    if (!log) return;
    const scrollHeight = Number(log.scrollHeight ?? 0);
    if (debugPinnedToLatest) log.scrollTop = scrollHeight;
    else log.scrollTop = Math.min(debugScrollTop, scrollHeight);
    log.addEventListener('scroll', () => {
      debugScrollTop = Number(log.scrollTop ?? 0);
      const remaining = Number(log.scrollHeight ?? 0) - debugScrollTop - Number(log.clientHeight ?? 0);
      debugPinnedToLatest = remaining <= 8;
    });
  }

  function bindStaticControls(actions: CurrentViewActions): void {
    app.querySelector('#back')?.addEventListener('click', actions.back);
    app.querySelector('#flip')?.addEventListener('click', actions.flip);
    app.querySelector('#guide-toggle')?.addEventListener('click', () => { lens.toggleGuide(); void actions.redraw(); });
    app.querySelector('#debug-toggle')?.addEventListener('click', () => {
      const opening = !lens.debugEnabled();
      if (opening) {
        debugPinnedToLatest = true;
        debugScrollTop = 0;
      }
      lens.toggleDebug();
      void actions.redraw();
    });
  }

  function bindDynamicControls(actions: CurrentViewActions, rootContext: boolean, view: RendererView): void {
    app.querySelector('#root-context-toggle')?.addEventListener('click', () => actions.setMode(rootContext ? 'lines' : 'roots'));
    app.querySelectorAll('[data-nav-key]').forEach((button) => bindRecenterTarget(button, actions, () => (button as HTMLElement).dataset.navKey));
    app.querySelector('#debug-clear')?.addEventListener('click', () => {
      clearDebugLog();
      debugPinnedToLatest = true;
      debugScrollTop = 0;
      void actions.redraw();
    });
    app.querySelector('#debug-copy')?.addEventListener('click', async () => {
      try { await window.navigator?.clipboard?.writeText?.(debugText()); debugLog('debug log copied'); }
      catch (error) { debugLog('debug copy failed', error, 'warn'); }
      void actions.redraw();
    });
    app.querySelector('#debug-refetch-view')?.addEventListener('click', async () => {
      try { await maintenance.refetchView?.(visiblePositions(view)); }
      catch (error) { debugLog('refetch view failed', error, 'error'); void actions.redraw(); }
    });
    app.querySelector('#debug-clear-explorer')?.addEventListener('click', async () => {
      try { await maintenance.clearExplorerCache?.(); }
      catch (error) { debugLog('clear Explorer cache failed', error, 'error'); void actions.redraw(); }
    });
    bindDebugScroll();
  }

  function renderSatellite(item: RendererPosition, slot: PresentationSlot, view: RendererView, structure: RendererStructure, actions: CurrentViewActions): void {
    const host = app.querySelector('#satellites');
    if (!host) return;
    const node = item.record ?? {};
    const wrapper = document.createElement('button');
    wrapper.type = 'button';
    wrapper.className = `satellite position tier-${slot.tier} relation-${item.relation ?? 'line'}`;
    wrapper.dataset.key = item.key;
    wrapper.dataset.family = familyFor(item);
    wrapper.style.setProperty('--x', `${slot.x}px`);
    wrapper.style.setProperty('--y', `${slot.y}px`);
    wrapper.style.setProperty('--size', `${slot.size}px`);
    wrapper.innerHTML = `<span class="mini-label"><span class="relation">${relationLabel(item)}</span><strong>${escapeHtml(item.edge?.san ?? '')}</strong></span><span class="mini-board board-frame"></span>${node.opening?.name ? `<span class="opening-label">${escapeHtml(node.opening.name)}</span>` : ''}`;
    bindRecenterTarget(wrapper, actions, item.key);
    host.appendChild(wrapper);
    const miniBoard = wrapper.querySelector('.mini-board') as HTMLElement | null;
    if (!miniBoard) return;
    satelliteBoards.add(Chessground(miniBoard, {
      fen: toPlayableFen(item.key), orientation: view.orientation, coordinates: false, viewOnly: true,
      animation: { enabled: false }, movable: { free: false, color: undefined }, draggable: { enabled: false }, selectable: { enabled: false },
      drawable: { enabled: false, visible: true, autoShapes: moveCueShapes(item, structure) },
    } as ChessgroundConfig));
  }

  function renderSatellites(view: RendererView, structure: RendererStructure, actions: CurrentViewActions, presentation: PresentationGeometry): void {
    const all = [...(structure.positions ?? [])];
    const lines = all.filter((item) => !isRootContext(item)).slice(0, presentation.lineCapacity);
    const roots = all.filter(isRootContext).slice(0, presentation.rootCapacity);
    const linePlacement = placeLineFamilies(presentation, lines.map((item) => ({
      key: item.key,
      family: familyFor(item),
      anchor: item.relation === 'outgoing',
    })));
    const rootPlacement = placeRootFamilies(presentation, roots.map((item) => ({
      key: item.key,
      family: familyFor(item),
      anchor: item.relation === 'root',
    })));
    for (const item of lines) {
      const slot = linePlacement.get(item.key);
      if (slot) renderSatellite(item, slot, view, structure, actions);
    }
    for (const item of roots) {
      const slot = rootPlacement.get(item.key);
      if (slot) renderSatellite(item, slot, view, structure, actions);
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
  function renderLichessEvalStatus(status: unknown): void { lichessEvalStatus = status; decorateLichessEvalStatus(app, status); }

  function canUpdateInPlace(view: RendererView, rootContext: boolean): boolean {
    return centerBoardState?.center === view.center
      && centerBoardState.orientation === view.orientation
      && centerBoardState.rootContext === rootContext
      && Boolean(app.querySelector('#center-board'))
      && Boolean(app.querySelector('#map'))
      && Boolean(app.querySelector('#satellites'))
      && Boolean(app.querySelector('.map-controls'))
      && Boolean(app.querySelector('#map-message'))
      && Boolean(app.querySelector('.analysis-rail'));
  }

  function updateChrome(view: RendererView, presentation: string, guide: boolean, debug: boolean): void {
    const back = app.querySelector('#back') as HTMLButtonElement | null;
    if (back) back.disabled = !view.navigation.canGoBack;
    app.querySelector('#guide-toggle')?.classList.toggle('is-active', guide);
    app.querySelector('#debug-toggle')?.classList.toggle('is-active', debug);
    renderStatus(presentation);
  }

  function updateDynamicMarkup(
    view: RendererView,
    centerNode: PositionRecord,
    turn: Orientation,
    rootContext: boolean,
    structuralError: string | null | undefined,
    debug: boolean,
  ): void {
    const map = app.querySelector('#map') as HTMLElement | null;
    if (map) map.className = `map ${rootContext ? 'has-root-context' : ''}`;
    const controls = app.querySelector('.map-controls') as HTMLElement | null;
    if (controls) controls.innerHTML = rootContextButton(rootContext);
    const satellites = app.querySelector('#satellites') as HTMLElement | null;
    if (satellites) satellites.innerHTML = '';
    const message = app.querySelector('#map-message') as HTMLElement | null;
    if (message) message.innerHTML = structuralError ? `<div class="toast">${escapeHtml(structuralError)}</div>` : '';
    const rail = app.querySelector('.analysis-rail') as HTMLElement | null;
    if (rail) rail.innerHTML = railHtml(view, centerNode, turn, debug);
  }

  function createCenterBoard(view: RendererView, actions: CurrentViewActions, rootContext: boolean, turn: Orientation): void {
    const centerBoard = app.querySelector('#center-board') as HTMLElement | null;
    if (!centerBoard) throw new Error('Nodus renderer could not create the center board');
    const api = Chessground(centerBoard, {
      fen: toPlayableFen(view.center), orientation: view.orientation, turnColor: turn, coordinates: true,
      animation: { enabled: true, duration: 180 },
      movable: { free: false, color: turn, dests: legalDestinations(view.center), showDests: true, events: {
        after: createBoardMoveRecenterHandler({ source: view.center, actions, choosePromotion: (choices: readonly string[], { to }: { to: string }) => promotionChooser.choose({ center: view.center, to, choices, orientation: view.orientation, color: turn }) }),
      } },
      draggable: { enabled: true, showGhost: true }, selectable: { enabled: true }, highlight: { lastMove: true, check: true },
    } as ChessgroundConfig);
    centerBoardState = Object.freeze({ api, center: view.center, orientation: view.orientation, rootContext });
  }

  function render(view: RendererView, actions: CurrentViewActions, presentation = 'hidden'): void {
    const structure = view.structure.value ?? emptyStructure(view.center);
    const centerNode = structure.centerNode ?? { key: view.center };
    const status = viewStatusSpec(presentation);
    const turn: Orientation = view.center.split(' ')[1] === 'b' ? 'black' : 'white';
    const structuralError = view.structure.error;
    const debug = lens.debugEnabled();
    const guide = lens.guideEnabled();
    const rootContext = view.mode === 'roots';
    const inPlace = canUpdateInPlace(view, rootContext);

    if (inPlace) {
      disposeSatelliteBoards();
      updateChrome(view, presentation, guide, debug);
      updateDynamicMarkup(view, centerNode, turn, rootContext, structuralError, debug);
    } else {
      disposeBoards();
      app.innerHTML = `<main class="app-shell"><header class="topbar"><a class="brand" href="${import.meta.env.BASE_URL}" aria-label="Chessview start position"><span class="brand-mark">♞</span><span>Chessview</span></a><div class="topbar-meta"><span class="network-status">Lichess · rated standard</span><span id="view-status" class="view-status is-${presentation}" role="status" aria-live="polite" aria-label="${escapeHtml(status.title)}"><span class="view-status-mark">${status.mark}</span><span class="view-status-label">${status.label}</span></span><button class="toolbar-button" id="back" type="button" ${view.navigation.canGoBack ? '' : 'disabled'}>← Back</button><button class="toolbar-button guide-toggle ${guide ? 'is-active' : ''}" id="guide-toggle" type="button">Guide</button><button class="toolbar-button ${debug ? 'is-active' : ''}" id="debug-toggle" type="button">Debug</button><button class="icon-button" id="flip" type="button" aria-label="Flip all boards">⇅</button></div></header><div class="workspace"><section class="map ${rootContext ? 'has-root-context' : ''}" id="map"><svg class="edges" id="edges" aria-hidden="true"></svg><div class="map-controls">${rootContextButton(rootContext)}</div><div class="center-position position" data-key="${escapeHtml(view.center)}"><div class="center-board board-frame" id="center-board"></div><div class="center-hint">Drag a legal move, or choose a Line.</div></div><div id="satellites"></div><div id="map-message">${structuralError ? `<div class="toast">${escapeHtml(structuralError)}</div>` : ''}</div></section><aside class="analysis-rail">${railHtml(view, centerNode, turn, debug)}</aside></div></main>`;
      renderLichessEvalStatus(lichessEvalStatus);
      createCenterBoard(view, actions, rootContext, turn);
      bindStaticControls(actions);
    }

    const mapGeometry = lens.geometry(view.mode);
    const centerPosition = app.querySelector('.center-position') as HTMLElement | null;
    centerPosition?.style.setProperty('left', `${mapGeometry.center.x}px`, 'important');
    centerPosition?.style.setProperty('top', `${mapGeometry.center.y}px`, 'important');
    centerPosition?.style.setProperty('--center-size', `${mapGeometry.center.size}px`);

    bindDynamicControls(actions, rootContext, view);
    renderSatellites(view, structure, actions, mapGeometry);
    decorateRootPresentation(app, view);
    decorateEvidencePresentation(app, view, actions, { showGuide: guide });
    promotionChooser.sync({ center: view.center, orientation: view.orientation, color: turn });
  }

  function renderFailure(view: RendererView | null | undefined, actions: CurrentViewActions, error: unknown, presentation = 'failed'): void {
    promotionChooser.cancel(); disposeBoards();
    const status = viewStatusSpec(presentation); const detail = errorMessage(error);
    app.innerHTML = `<main class="app-shell"><header class="topbar"><a class="brand" href="${import.meta.env.BASE_URL}" aria-label="Chessview start position"><span class="brand-mark">♞</span><span>Chessview</span></a><div class="topbar-meta"><span class="network-status">Lichess · rated standard</span><span id="view-status" class="view-status is-${presentation}" role="status" aria-live="polite" aria-label="${escapeHtml(status.title)}"><span class="view-status-mark">${status.mark}</span><span class="view-status-label">${status.label}</span></span><button class="toolbar-button" id="back" type="button" ${view?.navigation?.canGoBack ? '' : 'disabled'}>← Back</button><button class="toolbar-button" id="presentation-retry" type="button">Retry</button></div></header><div class="workspace"><section class="map"><div class="toast" title="${escapeHtml(detail)}">Chessview could not present this view.</div></section></div></main>`;
    renderLichessEvalStatus(lichessEvalStatus);
    app.querySelector('#back')?.addEventListener('click', actions.back);
    app.querySelector('#presentation-retry')?.addEventListener('click', () => { void actions.redraw(); });
  }
  function dispose(): void { promotionChooser.dispose(); disposeBoards(); }
  return Object.freeze({ render, renderFailure, renderStatus, renderLichessEvalStatus, dispose });
}
