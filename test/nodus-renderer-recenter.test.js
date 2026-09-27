import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createServer } from 'vite';
import { canonicalPosition, resolveMove, START_FEN } from '../src/graph.js';

class FakeElement {
  constructor(ownerDocument, { id = '' } = {}) {
    this.ownerDocument = ownerDocument;
    this.id = id;
    this.dataset = {};
    this.children = [];
    this.listeners = new Map();
    this.style = { setProperty() {} };
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

  addEventListener(type, listener) { this.listeners.set(type, listener); }
  emit(type) { return this.listeners.get(type)?.(); }
  appendChild(child) { this.children.push(child); return child; }

  querySelector(selector) {
    if (this.id === 'app') {
      if (selector === '#center-board') return this.centerBoard ?? null;
      if (selector === '#satellites') return this.satellites ?? null;
      return null;
    }
    if (selector === '.mini-board') return this._miniBoard;
    return null;
  }

  querySelectorAll() { return []; }
}

class FakeDocument {
  constructor() {
    this.defaultView = {
      innerWidth: 1280,
      navigator: {},
      prompt() { return null; },
    };
  }

  createElement() { return new FakeElement(this); }
}

test('NodusRenderer wires rendered targets and board moves to Recenter', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const chessgroundStub = fileURLToPath(new URL('../test-support/chessground-stub.js', import.meta.url));
  const vite = await createServer({
    root,
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
    resolve: {
      alias: [{ find: /^@lichess-org\/chessground$/, replacement: chessgroundStub }],
    },
  });

  try {
    globalThis.__chessviewRendererBoardCalls = [];
    const { createNodusRenderer } = await vite.ssrLoadModule('/src/nodus-renderer.js');
    const source = canonicalPosition(START_FEN);
    const target = resolveMove(source, { uci: 'e2e4' }).target;
    const document = new FakeDocument();
    const app = new FakeElement(document, { id: 'app' });
    const recenterCalls = [];
    const actions = {
      recenter(request) { recenterCalls.push(request); return true; },
      setMode() {},
      back() {},
      flip() {},
      redraw() {},
    };
    const view = {
      center: source,
      mode: 'lines',
      orientation: 'white',
      navigation: { canGoBack: false },
      structure: {
        status: 'ready',
        error: null,
        value: {
          composition: { center: source, direction: 'lines', nodes: [], relationships: [], families: [] },
          centerNode: { key: source },
          positions: [{
            key: target,
            distance: 1,
            relation: 'outgoing',
            edge: { source, target, san: 'e4', uci: 'e2e4' },
            record: {},
          }],
          incomingCount: 0,
          lineEdges: [],
          rootRows: [],
        },
      },
      evidence: { status: 'idle', value: null, error: null },
    };

    const renderer = createNodusRenderer({ app, preferences: {} });
    renderer.render(view, actions);

    assert.equal(app.satellites.children.length, 1);
    await app.satellites.children[0].emit('click');

    const centerBoard = globalThis.__chessviewRendererBoardCalls
      .find(({ element }) => element?.id === 'center-board');
    assert.ok(centerBoard?.config?.movable?.events?.after);
    await centerBoard.config.movable.events.after('e2', 'e4');

    assert.deepEqual(recenterCalls, [
      { target },
      { move: { from: 'e2', to: 'e4' } },
    ]);
  } finally {
    delete globalThis.__chessviewRendererBoardCalls;
    await vite.close();
  }
});
