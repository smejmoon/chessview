import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createServer } from 'vite';
import { canonicalPosition, resolveMove, START_FEN } from '../src/graph.js';

class FakeStyle {
  constructor() { this.values = new Map(); }
  setProperty(name, value) { this.values.set(name, value); }
  getPropertyValue(name) { return this.values.get(name) ?? ''; }
}

class FakeElement {
  constructor(ownerDocument, { id = '' } = {}) {
    this.ownerDocument = ownerDocument;
    this.id = id;
    this.dataset = {};
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.parentNode = null;
    this.style = new FakeStyle();
    this.classList = {
      add() {},
      remove() {},
      toggle() {},
      [Symbol.iterator]: function* iterator() {},
    };
    this._innerHTML = '';
    this._miniBoard = null;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    if (this.id === 'app') {
      this.centerBoard = new FakeElement(this.ownerDocument, { id: 'center-board' });
      this.satellites = new FakeElement(this.ownerDocument, { id: 'satellites' });
    } else if (this._innerHTML.includes('mini-board')) {
      this._miniBoard = new FakeElement(this.ownerDocument);
    }
  }

  get innerHTML() { return this._innerHTML; }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  emit(type, event = {}) { return this.listeners.get(type)?.(event); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  find(predicate) {
    if (predicate(this)) return this;
    for (const child of this.children) {
      const found = child.find?.(predicate);
      if (found) return found;
    }
    return null;
  }

  querySelector(selector) {
    if (this.id === 'app') {
      if (selector === '#center-board') return this.centerBoard ?? null;
      if (selector === '#satellites') return this.satellites ?? null;
    }
    if (selector === '.mini-board') return this._miniBoard;
    if (selector === '#promotion-choice') return this.find((node) => node.id === 'promotion-choice');
    if (selector.startsWith('[data-promotion="')) {
      const piece = selector.slice(17, -2);
      return this.find((node) => node.dataset?.promotion === piece);
    }
    return null;
  }

  querySelectorAll() { return []; }
}

class FakeDocument {
  constructor() {
    this.listeners = new Map();
    this.defaultView = {
      innerWidth: 1280,
      navigator: {},
    };
  }

  createElement() { return new FakeElement(this); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }
}

function viewFor(center, positions = []) {
  return {
    center,
    mode: 'lines',
    orientation: 'white',
    navigation: { canGoBack: false },
    structure: {
      status: 'ready',
      error: null,
      value: {
        composition: { nodes: [], relationships: [], families: [] },
        centerNode: { key: center },
        positions,
        incomingCount: 0,
        lineEdges: [],
        rootRows: [],
      },
    },
    evidence: { status: 'idle', value: null, error: null },
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

test('NodusRenderer wires rendered targets and board moves to Recenter', async () => withRenderer(async (createNodusRenderer) => {
  const source = canonicalPosition(START_FEN);
  const target = resolveMove(source, { uci: 'e2e4' }).target;
  const document = new FakeDocument();
  const app = new FakeElement(document, { id: 'app' });
  const recenterCalls = [];
  const actions = {
    recenter(request) { recenterCalls.push(request); return true; },
    setMode() {}, back() {}, flip() {}, redraw() {},
  };
  const view = viewFor(source, [{
    key: target,
    distance: 1,
    relation: 'outgoing',
    edge: { source, target, san: 'e4', uci: 'e2e4' },
    record: {},
  }]);

  const renderer = createNodusRenderer({ app, preferences: {} });
  renderer.render(view, actions);
  assert.equal(app.satellites.children.length, 1);
  await app.satellites.children[0].emit('click');

  const centerBoard = globalThis.__chessviewRendererBoardCalls.find(({ element }) => element?.id === 'center-board');
  await centerBoard.config.movable.events.after('e2', 'e4');
  assert.deepEqual(recenterCalls, [{ target }, { move: { from: 'e2', to: 'e4' } }]);
}));

for (const promotion of ['q', 'n', 'r', 'b']) {
  test(`NodusRenderer promotion overlay preserves ${promotion} into Recenter`, async () => withRenderer(async (createNodusRenderer) => {
    const source = canonicalPosition('k7/4P3/8/8/8/8/8/7K w - - 0 1');
    const document = new FakeDocument();
    const app = new FakeElement(document, { id: 'app' });
    const calls = [];
    const actions = {
      recenter(request) { calls.push(['recenter', request]); return true; },
      redraw() { calls.push(['redraw']); return true; },
      setMode() {}, back() {}, flip() {},
    };
    const renderer = createNodusRenderer({ app, preferences: {} });
    renderer.render(viewFor(source), actions);

    const centerBoard = globalThis.__chessviewRendererBoardCalls.find(({ element }) => element?.id === 'center-board');
    const move = centerBoard.config.movable.events.after('e7', 'e8');
    const button = app.centerBoard.querySelector(`[data-promotion="${promotion}"]`);
    assert.ok(button);
    button.emit('click', { stopPropagation() {} });
    assert.equal(await move, true);
    assert.deepEqual(calls, [['recenter', { move: { from: 'e7', to: 'e8', promotion } }]]);
  }));
}

test('NodusRenderer keeps a pending promotion aligned when the board flips', async () => withRenderer(async (createNodusRenderer) => {
  const source = canonicalPosition('k7/4P3/8/8/8/8/8/7K w - - 0 1');
  const document = new FakeDocument();
  const app = new FakeElement(document, { id: 'app' });
  const calls = [];
  const actions = {
    recenter(request) { calls.push(['recenter', request]); return true; },
    redraw() { calls.push(['redraw']); return true; },
    setMode() {}, back() {}, flip() {},
  };
  const renderer = createNodusRenderer({ app, preferences: {} });
  const whiteView = viewFor(source);
  renderer.render(whiteView, actions);

  const whiteBoard = globalThis.__chessviewRendererBoardCalls.find(({ element }) => element?.id === 'center-board');
  const move = whiteBoard.config.movable.events.after('e7', 'e8');
  let queen = app.centerBoard.querySelector('[data-promotion="q"]');
  assert.equal(queen.style.getPropertyValue('left'), '50%');
  assert.equal(queen.style.getPropertyValue('top'), '0%');

  renderer.render({ ...whiteView, orientation: 'black' }, actions);
  queen = app.centerBoard.querySelector('[data-promotion="q"]');
  assert.ok(queen);
  assert.equal(queen.style.getPropertyValue('left'), '37.5%');
  assert.equal(queen.style.getPropertyValue('top'), '87.5%');

  queen.emit('click', { stopPropagation() {} });
  assert.equal(await move, true);
  assert.deepEqual(calls, [['recenter', { move: { from: 'e7', to: 'e8', promotion: 'q' } }]]);
}));

test('NodusRenderer promotion backdrop cancels without Recenter', async () => withRenderer(async (createNodusRenderer) => {
  const source = canonicalPosition('k7/4P3/8/8/8/8/8/7K w - - 0 1');
  const document = new FakeDocument();
  const app = new FakeElement(document, { id: 'app' });
  const calls = [];
  const actions = {
    recenter(request) { calls.push(['recenter', request]); return true; },
    redraw() { calls.push(['redraw']); return true; },
    setMode() {}, back() {}, flip() {},
  };
  const renderer = createNodusRenderer({ app, preferences: {} });
  renderer.render(viewFor(source), actions);

  const centerBoard = globalThis.__chessviewRendererBoardCalls.find(({ element }) => element?.id === 'center-board');
  const move = centerBoard.config.movable.events.after('e7', 'e8');
  app.centerBoard.querySelector('#promotion-choice').emit('click');
  assert.equal(await move, false);
  assert.deepEqual(calls, [['redraw']]);
}));
