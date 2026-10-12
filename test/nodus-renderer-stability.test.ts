import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createServer } from 'vite';
import { canonicalPosition, START_FEN } from '../src/graph.ts';

class FakeStyle {
  constructor() { this.values = new Map(); }
  setProperty(name, value) { this.values.set(name, value); }
}

class FakeElement {
  constructor(ownerDocument, { id = '', className = '' } = {}) {
    this.ownerDocument = ownerDocument;
    this.id = id;
    this.className = className;
    this.dataset = {};
    this.children = [];
    this.listeners = new Map();
    this.style = new FakeStyle();
    this.textContent = '';
    this.title = '';
    this.disabled = false;
    this._innerHTML = '';
    this.scrollTop = 0;
    this.scrollHeight = 1000;
    this.clientHeight = 120;
    this.classList = { add() {}, remove() {}, toggle() {}, [Symbol.iterator]: function* iterator() {} };
    this.railOwner = null;
    this.lastFocusOptions = null;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    if (this.id === 'app') {
      this.map = new FakeElement(this.ownerDocument, { id: 'map', className: 'map' });
      this.map.getBoundingClientRect = () => ({ width: 1100, height: 720 });
      this.mapControls = new FakeElement(this.ownerDocument, { className: 'map-controls' });
      this.centerPosition = new FakeElement(this.ownerDocument, { className: 'center-position' });
      this.centerBoard = new FakeElement(this.ownerDocument, { id: 'center-board', className: 'center-board' });
      this.centerHint = new FakeElement(this.ownerDocument, { className: 'center-hint' });
      this.satellites = new FakeElement(this.ownerDocument, { id: 'satellites' });
      this.mapMessage = new FakeElement(this.ownerDocument, { id: 'map-message' });
      this.rail = new FakeElement(this.ownerDocument, { className: 'analysis-rail' });
      this.networkStatus = new FakeElement(this.ownerDocument, { className: 'network-status' });
      this.viewStatus = new FakeElement(this.ownerDocument, { id: 'view-status' });
      this.viewStatusMark = new FakeElement(this.ownerDocument, { className: 'view-status-mark' });
      this.viewStatusLabel = new FakeElement(this.ownerDocument, { className: 'view-status-label' });
      this.viewStatus.querySelector = (selector) => selector === '.view-status-mark' ? this.viewStatusMark : selector === '.view-status-label' ? this.viewStatusLabel : null;
      this.back = new FakeElement(this.ownerDocument, { id: 'back' });
      this.flip = new FakeElement(this.ownerDocument, { id: 'flip' });
      this.guide = new FakeElement(this.ownerDocument, { id: 'guide-toggle' });
      this.debug = new FakeElement(this.ownerDocument, { id: 'debug-toggle' });
      this.rootToggle = new FakeElement(this.ownerDocument, { id: 'root-context-toggle' });
    }
    if (this.className === 'analysis-rail') {
      if (this.contains(this.ownerDocument.activeElement)) this.ownerDocument.activeElement = null;
      const railChild = (id = '', dataset = {}) => {
        const child = new FakeElement(this.ownerDocument, { id });
        child.railOwner = this;
        child.dataset = dataset;
        return child;
      };
      this.explorerToggle = value.includes('id="rail-explorer-toggle"') ? railChild('rail-explorer-toggle') : null;
      this.debugToggle = value.includes('id="rail-debug-toggle"') ? railChild('rail-debug-toggle') : null;
      this.explorerList = value.includes('class="explorer-list"') ? railChild('', {}) : null;
      this.debugMeasures = value.includes('id="debug-measures"') ? railChild('debug-measures') : null;
      this.debugLog = value.includes('id="debug-log"') ? railChild('debug-log') : null;
      this.debugClear = value.includes('id="debug-clear"') ? railChild('debug-clear') : null;
      this.debugRefetch = value.includes('id="debug-refetch-view"') ? railChild('debug-refetch-view') : null;
      this.navButtons = [...value.matchAll(/data-nav-key="([^"]+)"/g)]
        .map((match) => railChild('', { navKey: match[1] }));
    }
    if (this.id === 'satellites' && value === '') this.children = [];
  }

  get innerHTML() { return this._innerHTML; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute() {}
  focus(options = {}) { this.ownerDocument.activeElement = this; this.lastFocusOptions = options; }
  contains(node) { return Boolean(node && node.railOwner === this); }
  querySelector(selector) {
    if (this.className === 'analysis-rail') {
      return {
        '#rail-explorer-toggle': this.explorerToggle,
        '#rail-debug-toggle': this.debugToggle,
        '#debug-measures': this.debugMeasures,
        '#debug-log': this.debugLog,
        '#debug-clear': this.debugClear,
        '#debug-refetch-view': this.debugRefetch,
      }[selector] ?? null;
    }
    return null;
  }
  querySelectorAll(selector) {
    return this.className === 'analysis-rail' && selector === '[data-nav-key]' ? this.navButtons : [];
  }
}

class FakeApp extends FakeElement {
  querySelector(selector) {
    const values = {
      '#map': this.map,
      '.map-controls': this.mapControls,
      '.center-position': this.centerPosition,
      '#center-board': this.centerBoard,
      '.center-hint': this.centerHint,
      '#satellites': this.satellites,
      '#map-message': this.mapMessage,
      '.analysis-rail': this.rail,
      '.network-status': this.networkStatus,
      '#view-status': this.viewStatus,
      '#back': this.back,
      '#flip': this.flip,
      '#guide-toggle': this.guide,
      '#debug-toggle': this.debug,
      '#root-context-toggle': this.rootToggle,
      '#rail-explorer-toggle': this.rail?.explorerToggle,
      '#rail-debug-toggle': this.rail?.debugToggle,
      '.explorer-list': this.rail?.explorerList,
      '#debug-measures': this.rail?.debugMeasures,
      '#debug-log': this.rail?.debugLog,
      '#debug-clear': this.rail?.debugClear,
      '#debug-refetch-view': this.rail?.debugRefetch,
    };
    return values[selector] ?? null;
  }
  querySelectorAll() { return []; }
}

class FakeDocument {
  constructor() {
    this.defaultView = { innerWidth: 1440, innerHeight: 800, navigator: {} };
    this.activeElement = null;
  }
  createElement() { return new FakeElement(this); }
  addEventListener() {}
  removeEventListener() {}
}

function viewFor(center, railLines = [], mode = 'lines') {
  return {
    center,
    mode,
    orientation: 'white',
    navigation: { canGoBack: false },
    structure: {
      status: 'ready',
      error: null,
      value: { composition: { nodes: [], relationships: [], families: [] }, centerNode: { key: center }, positions: [] },
    },
    evidence: { status: 'idle', value: null, error: null },
    rail: { status: 'ready', value: { lines: railLines }, error: null },
  };
}

async function withRenderer(run) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const chessgroundStub = fileURLToPath(new URL('../test-support/chessground-stub.ts', import.meta.url));
  const vite = await createServer({
    root,
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
    resolve: { alias: [{ find: /^@lichess-org\/chessground$/, replacement: chessgroundStub }] },
  });
  try {
    globalThis.__chessviewRendererBoardCalls = [];
    const { createNodusRenderer } = await vite.ssrLoadModule('/src/nodus-renderer.ts');
    await run(createNodusRenderer);
  } finally {
    delete globalThis.__chessviewRendererBoardCalls;
    await vite.close();
  }
}

test('same-Nodus mode changes preserve the playable center Chessground while relaying out the Constellation', async () => withRenderer(async (createNodusRenderer) => {
  const document = new FakeDocument();
  const app = new FakeApp(document, { id: 'app' });
  const center = canonicalPosition(START_FEN);
  const actions = { recenter() {}, setMode() {}, back() {}, flip() {}, redraw() {} };
  const renderer = createNodusRenderer({ app, preferences: {} });

  renderer.render(viewFor(center, [], 'lines'), actions, 'ready');
  const firstCenterElement = app.centerBoard;
  renderer.render(viewFor(center, [], 'roots'), actions, 'ready');

  const centerCalls = globalThis.__chessviewRendererBoardCalls.filter(({ element }) => element?.id === 'center-board');
  assert.equal(app.centerBoard, firstCenterElement);
  assert.equal(centerCalls.length, 1);
}));

test('same-Nodus updates preserve the playable center Chessground', async () => withRenderer(async (createNodusRenderer) => {
  const document = new FakeDocument();
  const app = new FakeApp(document, { id: 'app' });
  const center = canonicalPosition(START_FEN);
  const actions = { recenter() {}, setMode() {}, back() {}, flip() {}, redraw() {} };
  const renderer = createNodusRenderer({ app, preferences: {} });

  renderer.render(viewFor(center), actions, 'ready');
  const firstCenterElement = app.centerBoard;
  const firstCenterCalls = globalThis.__chessviewRendererBoardCalls.filter(({ element }) => element?.id === 'center-board');
  assert.equal(firstCenterCalls.length, 1);

  renderer.render(viewFor(center, [{ edge: { target: center, san: 'e4', uci: 'e2e4' } }]), actions, 'updating');
  const secondCenterCalls = globalThis.__chessviewRendererBoardCalls.filter(({ element }) => element?.id === 'center-board');
  assert.equal(app.centerBoard, firstCenterElement);
  assert.equal(secondCenterCalls.length, 1);
}));


test('canonical Nodus presentation does not claim a route-dependent opening identity', async () => withRenderer(async (createNodusRenderer) => {
  const document = new FakeDocument();
  const app = new FakeApp(document, { id: 'app' });
  const center = canonicalPosition(START_FEN);
  const actions = { recenter() {}, setMode() {}, back() {}, flip() {}, redraw() {} };
  const renderer = createNodusRenderer({ app, preferences: {} });

  const view = viewFor(center);
  view.structure.value.centerNode = {
    key: center,
    games: 1234,
    opening: { eco: 'B14', name: 'Caro-Kann Defense: Panov Attack' },
  };

  renderer.render(view, actions, 'ready');
  renderer.render(view, actions, 'ready');

  assert.match(app.rail.innerHTML, /current position/);
  assert.match(app.rail.innerHTML, /Explore from here/);
  assert.doesNotMatch(app.rail.innerHTML, /Panov|B14/);
}));

test('Rail Debug groups follow the published view without changing Weather or the center board', async () => withRenderer(async (createNodusRenderer) => {
  const document = new FakeDocument();
  const app = new FakeApp(document, { id: 'app' });
  let debugEnabled = false;
  const { createLens } = await import('../src/lens.ts');
  const lens = createLens({
    app,
    debug: { enabled: () => debugEnabled, setEnabled(value) { debugEnabled = value; } },
  });
  const renderer = createNodusRenderer({ app, lens });
  const center = canonicalPosition(START_FEN);
  const actions = { recenter() {}, setMode() {}, back() {}, flip() {}, redraw() {} };
  const view = {
    ...viewFor(center),
    settling: true,
    weather: {
      structure: 'ready', frontier: 3,
      structural: { working: 1, satisfied: 2, incorporationPending: 1, unavailable: 1, failed: 0, unplanned: 0, detached: 0 },
      supplementary: { active: 2, total: 5 },
    },
  };

  renderer.render(view, actions, 'updating');
  assert.doesNotMatch(app.rail.innerHTML, /ConstellationState|FrontierWork/);
  lens.setDebug(true);
  renderer.render(view, actions, 'updating');
  assert.match(app.rail.innerHTML, /ConstellationState/);
  assert.match(app.rail.innerHTML, /FrontierWork/);
  assert.match(app.rail.innerHTML, /EnrichmentFlow/);
  assert.match(app.rail.innerHTML, /Incorporation pending<\/dt><dd>1<\/dd>/);
  assert.match(app.rail.innerHTML, /id="debug-measures" role="region" tabindex="0"/);
  assert.match(app.rail.innerHTML, /id="debug-log" tabindex="0"/);
  assert.doesNotMatch(app.rail.innerHTML, /aria-live|role="status"/);
  assert.equal(app.viewStatus.className, 'view-status is-updating');
  assert.equal(app.viewStatus.children.length, 0);

  lens.setDebug(false);
  renderer.render(view, actions, 'updating');
  assert.doesNotMatch(app.rail.innerHTML, /ConstellationState|FrontierWork/);
  assert.equal(app.viewStatus.className, 'view-status is-updating');
  assert.equal(globalThis.__chessviewRendererBoardCalls.filter(({ element }) => element?.id === 'center-board').length, 1);
}));

test('Debug event log auto-follow never hides measurement groups and both scroll positions survive redraws', async () => withRenderer(async (createNodusRenderer) => {
  const document = new FakeDocument();
  const app = new FakeApp(document, { id: 'app' });
  let debugEnabled = false;
  const { createLens } = await import('../src/lens.ts');
  const lens = createLens({
    app,
    debug: { enabled: () => debugEnabled, setEnabled(value) { debugEnabled = value; } },
  });
  const renderer = createNodusRenderer({ app, lens });
  const center = canonicalPosition(START_FEN);
  const actions = { recenter() {}, setMode() {}, back() {}, flip() {}, redraw() {} };
  const view = viewFor(center);

  renderer.render(view, actions, 'ready');
  lens.setDebug(true);
  renderer.render(view, actions, 'ready');
  const measures = app.rail.debugMeasures;
  const log = app.rail.debugLog;
  assert.ok(measures);
  assert.ok(log);
  assert.equal(measures.scrollTop, 0);
  assert.equal(log.scrollTop, 1000, 'the event log alone follows the latest event');

  measures.scrollTop = 95;
  measures.listeners.get('scroll')();
  log.scrollTop = 12;
  log.listeners.get('scroll')();
  renderer.render(view, actions, 'updating');
  assert.equal(app.rail.debugMeasures.scrollTop, 95, 'ongoing refinement keeps the inspected measurements in view');
  assert.equal(app.rail.debugLog.scrollTop, 12, 'inspecting older log events disables follow-latest');
  assert.equal(app.viewStatus.className, 'view-status is-updating');
  assert.equal(globalThis.__chessviewRendererBoardCalls.filter(({ element }) => element?.id === 'center-board').length, 1);
}));

test('in-place Rail updates retain focus for Debug regions, maintenance and matching Explorer Lines', async () => withRenderer(async (createNodusRenderer) => {
  const document = new FakeDocument();
  const app = new FakeApp(document, { id: 'app' });
  let debugEnabled = false;
  const { createLens } = await import('../src/lens.ts');
  const lens = createLens({
    app,
    debug: { enabled: () => debugEnabled, setEnabled(value) { debugEnabled = value; } },
  });
  const renderer = createNodusRenderer({ app, lens });
  const center = canonicalPosition(START_FEN);
  const actions = { recenter() {}, setMode() {}, back() {}, flip() {}, redraw() {} };
  const line = { edge: { san: 'e4', uci: 'e2e4', target: 'reachable-key' }, frequency: { share: 0.4, games: 120 } };
  const view = viewFor(center, [line]);
  renderer.render(view, actions, 'ready');
  lens.setDebug(true);
  renderer.render(view, actions, 'updating');

  for (const name of ['debugMeasures', 'debugLog', 'debugRefetch', 'debugClear']) {
    const oldFocused = app.rail[name];
    assert.ok(oldFocused, name);
    oldFocused.focus();
    renderer.render(view, actions, 'updating');
    assert.notEqual(document.activeElement, oldFocused, 'the full Rail HTML was replaced');
    assert.equal(document.activeElement, app.rail[name], name + ' stays keyboard-active');
    assert.equal(document.activeElement.lastFocusOptions.preventScroll, true);
  }

  lens.setDebug(false);
  renderer.render(view, actions, 'ready');
  const previousLine = app.rail.navButtons[0];
  assert.equal(previousLine.dataset.navKey, 'reachable-key');
  previousLine.focus();
  renderer.render(view, actions, 'updating');
  assert.equal(document.activeElement, app.rail.navButtons[0], 'same Line target retains keyboard focus');
  assert.equal(document.activeElement.lastFocusOptions.preventScroll, true);

  app.rail.navButtons[0].focus();
  renderer.render(viewFor(center), actions, 'ready');
  assert.equal(document.activeElement, null, 'missing navigation targets do not steal focus');
}));

test('Rail switches prioritize Opening Explorer while keeping Debug accessible and visibly selected', async () => withRenderer(async (createNodusRenderer) => {
  const document = new FakeDocument();
  const app = new FakeApp(document, { id: 'app' });
  let debugEnabled = false;
  const { createLens } = await import('../src/lens.ts');
  const lens = createLens({ app, debug: { enabled: () => debugEnabled, setEnabled(next) { debugEnabled = next; } } });
  const renderer = createNodusRenderer({ app, lens });
  const center = canonicalPosition(START_FEN);
  const view = viewFor(center, [{ edge: { san: 'e4', uci: 'e2e4', target: 'target' } }]);
  let redraws = 0;
  const actions = {
    recenter() {}, setMode() {}, back() {}, flip() {},
    redraw() { redraws++; renderer.render(view, actions, 'updating'); },
  };
  renderer.render(view, actions, 'ready');
  assert.match(app.rail.innerHTML, /id="rail-explorer-toggle" class="rail-switch-button is-active" type="button" aria-pressed="true"/);
  assert.doesNotMatch(app.rail.innerHTML, /id="rail-debug-toggle"/);
  assert.doesNotMatch(app.rail.innerHTML, /id="rail-explorer-panel"[^>]*hidden/);

  lens.setDebug(true);
  renderer.render(view, actions, 'ready');
  assert.match(app.rail.innerHTML, /id="rail-explorer-toggle" class="rail-switch-button is-active" type="button" aria-pressed="true"/);
  assert.match(app.rail.innerHTML, /id="rail-debug-toggle" class="rail-switch-button " type="button" aria-pressed="false"/);
  assert.match(app.rail.innerHTML, /id="rail-debug-panel"[^>]*hidden/);
  const list = app.rail.explorerList;
  list.scrollTop = 66;
  list.listeners.get('scroll')();

  app.rail.debugToggle.focus();
  app.rail.debugToggle.listeners.get('click')();
  assert.equal(redraws, 1);
  assert.match(app.rail.innerHTML, /id="rail-explorer-toggle" class="rail-switch-button " type="button" aria-pressed="false"/);
  assert.match(app.rail.innerHTML, /id="rail-debug-toggle" class="rail-switch-button is-active" type="button" aria-pressed="true"/);
  assert.match(app.rail.innerHTML, /id="rail-explorer-panel"[^>]*hidden/);
  assert.doesNotMatch(app.rail.innerHTML, /id="rail-debug-panel"[^>]*hidden/);
  assert.equal(document.activeElement, app.rail.debugToggle, 'focused selector survives redraw');

  app.rail.explorerToggle.listeners.get('click')();
  assert.equal(redraws, 2);
  assert.equal(app.rail.explorerList.scrollTop, 66, 'Explorer scroll survives switching');
  assert.equal(document.activeElement, app.rail.explorerToggle);
  assert.match(app.rail.innerHTML, /id="rail-explorer-toggle" class="rail-switch-button is-active" type="button" aria-pressed="true"/);
  assert.match(app.rail.innerHTML, /id="rail-debug-panel"[^>]*hidden/);
  assert.equal(globalThis.__chessviewRendererBoardCalls.filter(({ element }) => element?.id === 'center-board').length, 1);
}));
