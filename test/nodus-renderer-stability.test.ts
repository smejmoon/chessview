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
      this.debugBar = new FakeElement(this.ownerDocument, { id: 'topbar-debug-observations' });
      this.debugBar.hidden = value.includes('id="topbar-debug-observations" role="group" aria-label="Current View Debug measurements" tabindex="0" hidden');
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
    if (this.id === 'topbar-debug-observations') {
      if (this.contains(this.ownerDocument.activeElement)) this.ownerDocument.activeElement = null;
      this.metrics = [...value.matchAll(/data-debug-metric="([^"]+)"/g)].map((match) => {
        const element = new FakeElement(this.ownerDocument);
        element.dataset.debugMetric = match[1];
        element.metricOwner = this;
        return element;
      });
    }
    if (this.className === 'analysis-rail') {
      if (this.contains(this.ownerDocument.activeElement)) this.ownerDocument.activeElement = null;
      const railChild = (id = '', dataset = {}) => {
        const child = new FakeElement(this.ownerDocument, { id });
        child.railOwner = this;
        child.dataset = dataset;
        return child;
      };
      this.debugPanelToggle = value.includes('id="debug-panel-toggle"') ? railChild('debug-panel-toggle') : null;
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
  contains(node) { return Boolean(node && (node.railOwner === this || node.metricOwner === this)); }
  querySelector(selector) {
    if (this.className === 'analysis-rail') {
      return {
        '#debug-panel-toggle': this.debugPanelToggle,
        '#debug-log': this.debugLog,
        '#debug-clear': this.debugClear,
        '#debug-refetch-view': this.debugRefetch,
      }[selector] ?? null;
    }
    return null;
  }
  querySelectorAll(selector) {
    if (this.id === 'topbar-debug-observations' && selector === '[data-debug-metric]') return this.metrics ?? [];
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
      '#topbar-debug-observations': this.debugBar,
      '#view-status': this.viewStatus,
      '#back': this.back,
      '#flip': this.flip,
      '#guide-toggle': this.guide,
      '#debug-toggle': this.debug,
      '#root-context-toggle': this.rootToggle,
      '#debug-panel-toggle': this.rail?.debugPanelToggle,
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

  assert.match(app.rail.innerHTML, /aria-label="Current position"/);
  assert.match(app.rail.innerHTML, /Opening Explorer/);
  assert.doesNotMatch(app.rail.innerHTML, /Panov|B14/);
}));

test('Debug-only topbar holds Current View measurements, leaving Rail to Explorer and tools', async () => withRenderer(async (createNodusRenderer) => {
  const document = new FakeDocument();
  const app = new FakeApp(document, { id: 'app' });
  let enabled = false;
  const { createLens } = await import('../src/lens.ts');
  const lens = createLens({ app, debug: { enabled: () => enabled, setEnabled(v) { enabled = v; } } });
  const renderer = createNodusRenderer({ app, lens });
  const center = canonicalPosition(START_FEN);
  const actions = { recenter() {}, setMode() {}, back() {}, flip() {}, redraw() {} };
  const view = { ...viewFor(center), settling: true, weather: {
    structure: 'ready', frontier: 3,
    structural: { working: 1, satisfied: 2, incorporationPending: 1, unavailable: 1, failed: 0, unplanned: 0, detached: 0 },
    supplementary: { active: 2, total: 98 },
  } };
  renderer.render(view, actions, 'updating');
  assert.match(app.innerHTML, /id="topbar-debug-observations"[^>]*hidden/);
  lens.setDebug(true);
  renderer.render(view, actions, 'updating');
  assert.equal(app.debugBar.hidden, false);
  assert.match(app.debugBar.innerHTML, /Structural — Incorporation pending: 1/);
  assert.match(app.debugBar.innerHTML, /Supplementary — Total: 98/);
  assert.doesNotMatch(app.rail.innerHTML, /debug-measures|Structural|Supplementary|FrontierWork|EnrichmentFlow/);
  assert.match(app.rail.innerHTML, /Events &amp; tools/);
  assert.equal(app.viewStatus.className, 'view-status is-updating');
  lens.setDebug(false);
  renderer.render(view, actions, 'updating');
  assert.equal(app.debugBar.hidden, true);
  assert.doesNotMatch(app.rail.innerHTML, /Events &amp; tools/);
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
  const actions = {
    recenter() {}, setMode() {}, back() {}, flip() {},
    redraw() { renderer.render(view, actions, 'updating'); },
  };
  const line = { edge: { san: 'e4', uci: 'e2e4', target: 'reachable-key' }, frequency: { share: 0.4, games: 120 } };
  const view = viewFor(center, [line]);
  renderer.render(view, actions, 'ready');
  lens.setDebug(true);
  renderer.render(view, actions, 'updating');
  app.rail.debugPanelToggle.listeners.get('click')();
  assert.match(app.rail.innerHTML, /id="debug-panel-toggle"[^>]*aria-expanded="true"/);

  for (const name of ['debugLog', 'debugRefetch', 'debugClear']) {
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

test('Rail keeps Opening Explorer primary and only Events and tools expands', async () => withRenderer(async (createNodusRenderer) => {
  const document = new FakeDocument();
  const app = new FakeApp(document, { id: 'app' });
  let enabled = false;
  const { createLens } = await import('../src/lens.ts');
  const lens = createLens({ app, debug: { enabled: () => enabled, setEnabled(v) { enabled = v; } } });
  const renderer = createNodusRenderer({ app, lens });
  const center = canonicalPosition(START_FEN);
  const view = viewFor(center);
  const actions = { recenter() {}, setMode() {}, back() {}, flip() {}, redraw() { renderer.render(view, actions, 'updating'); } };
  renderer.render(view, actions, 'ready');
  lens.setDebug(true);
  renderer.render(view, actions, 'updating');
  assert.match(app.rail.innerHTML, /Opening Explorer/);
  assert.match(app.rail.innerHTML, /class="rail-debug"/);
  assert.doesNotMatch(app.rail.innerHTML, /debug-measures|Structural|Supplementary/);
  assert.match(app.rail.innerHTML, /id="debug-panel-toggle"[^>]*aria-expanded="false"/);
  assert.match(app.rail.innerHTML, /id="debug-content" hidden/);
  app.rail.debugPanelToggle.focus();
  app.rail.debugPanelToggle.listeners.get('click')();
  assert.match(app.rail.innerHTML, /id="debug-panel-toggle"[^>]*aria-expanded="true"/);
  assert.match(app.rail.innerHTML, /Copy log|Clear log|Clear Explorer cache/);
  assert.equal(document.activeElement, app.rail.debugPanelToggle);
  app.rail.debugPanelToggle.listeners.get('click')();
  assert.match(app.rail.innerHTML, /id="debug-content" hidden/);
  assert.equal(document.activeElement, app.rail.debugPanelToggle);
}));

test('topbar icon focus and values survive in-place current-view updates', async () => withRenderer(async (createNodusRenderer) => {
  const document = new FakeDocument();
  const app = new FakeApp(document, { id: 'app' });
  let enabled = true;
  const { createLens } = await import('../src/lens.ts');
  const lens = createLens({ app, debug: { enabled: () => enabled, setEnabled(v) { enabled = v; } } });
  const renderer = createNodusRenderer({ app, lens });
  const center = canonicalPosition(START_FEN);
  const actions = { recenter() {}, setMode() {}, back() {}, flip() {}, redraw() {} };
  const view = { ...viewFor(center), settling: true, weather: {
    structure: 'ready', frontier: 3, structural: { working: 1 },
    supplementary: { active: 2, total: 98 },
  } };
  renderer.render(view, actions, 'updating');
  assert.match(app.innerHTML, /id="topbar-debug-observations"/);
  const bar = app.debugBar;
  renderer.render(view, actions, 'updating');
  const original = bar.metrics.find((metric) => metric.dataset.debugMetric === 'Structural:Working');
  assert.ok(original);
  original.focus();
  renderer.render({ ...view, settling: false, weather: {
    structure: 'ready', frontier: 0, structural: { working: 0 },
    supplementary: { active: 0, total: 98 },
  } }, actions, 'ready');
  assert.equal(app.debugBar, bar);
  assert.notEqual(document.activeElement, original);
  assert.equal(document.activeElement.dataset.debugMetric, 'Structural:Working');
  assert.equal(document.activeElement.lastFocusOptions.preventScroll, true);
  assert.match(bar.innerHTML, /Structural — Working: 0/);
  assert.equal(app.viewStatus.className, 'view-status is-ready');
  enabled = false;
  renderer.render(view, actions, 'updating');
  assert.equal(bar.hidden, true);
  assert.equal(globalThis.__chessviewRendererBoardCalls.filter(({ element }) => element?.id === 'center-board').length, 1);
}));
