import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createServer } from 'vite';
import { canonicalPosition, START_FEN } from '../src/graph.js';

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
    this.classList = { add() {}, remove() {}, toggle() {}, [Symbol.iterator]: function* iterator() {} };
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
    if (this.id === 'satellites' && value === '') this.children = [];
  }

  get innerHTML() { return this._innerHTML; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
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
    };
    return values[selector] ?? null;
  }
  querySelectorAll() { return []; }
}

class FakeDocument {
  constructor() {
    this.defaultView = { innerWidth: 1440, innerHeight: 800, navigator: {} };
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
  const chessgroundStub = fileURLToPath(new URL('../test-support/chessground-stub.js', import.meta.url));
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
    const { createNodusRenderer } = await vite.ssrLoadModule('/src/nodus-renderer.js');
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
