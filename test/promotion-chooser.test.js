import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createServer } from 'vite';

class FakeStyle {
  constructor() { this.values = new Map(); }
  setProperty(name, value) { this.values.set(name, value); }
  getPropertyValue(name) { return this.values.get(name) ?? ''; }
}

class FakeElement {
  constructor(ownerDocument, tag = 'div') {
    this.ownerDocument = ownerDocument;
    this.tagName = tag;
    this.id = '';
    this.className = '';
    this.type = '';
    this.dataset = {};
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.style = new FakeStyle();
    this.parentNode = null;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  addEventListener(type, listener) { this.listeners.set(type, listener); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  emit(type, event = {}) { return this.listeners.get(type)?.(event); }

  querySelector(selector) {
    if (selector === '#center-board') return this.find((node) => node.id === 'center-board');
    if (selector.startsWith('[data-promotion="')) {
      const piece = selector.slice(17, -2);
      return this.find((node) => node.dataset?.promotion === piece);
    }
    if (selector === '#promotion-choice') return this.find((node) => node.id === 'promotion-choice');
    return null;
  }

  find(predicate) {
    if (predicate(this)) return this;
    for (const child of this.children) {
      const found = child.find?.(predicate);
      if (found) return found;
    }
    return null;
  }
}

class FakeDocument {
  constructor() { this.listeners = new Map(); }
  createElement(tag) { return new FakeElement(this, tag); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }
  emit(type, event = {}) { return this.listeners.get(type)?.(event); }
}

async function loadChooser() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const vite = await createServer({
    root,
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
  const module = await vite.ssrLoadModule('/src/promotion-chooser.js');
  return { ...module, close: () => vite.close() };
}

function fixture(document) {
  const app = new FakeElement(document, 'div');
  const board = new FakeElement(document, 'div');
  board.id = 'center-board';
  app.appendChild(board);
  return { app, board };
}

for (const promotion of ['q', 'n', 'r', 'b']) {
  test(`promotion chooser resolves ${promotion} from its board piece`, async () => {
    const { createPromotionChooser, close } = await loadChooser();
    try {
      const document = new FakeDocument();
      const { app } = fixture(document);
      const chooser = createPromotionChooser({ app });
      const choice = chooser.choose({
        center: 'position',
        to: 'e8',
        choices: ['q', 'r', 'b', 'n'],
        orientation: 'white',
        color: 'white',
      });

      const button = app.querySelector(`[data-promotion="${promotion}"]`);
      assert.ok(button);
      button.emit('click', { stopPropagation() {} });
      assert.equal(await choice, promotion);
      assert.equal(app.querySelector('#promotion-choice'), null);
    } finally {
      await close();
    }
  });
}

test('promotion chooser follows the destination file and promotion edge', async () => {
  const { createPromotionChooser, close } = await loadChooser();
  try {
    const document = new FakeDocument();
    const { app } = fixture(document);
    const chooser = createPromotionChooser({ app });
    const pending = chooser.choose({
      center: 'position',
      to: 'b1',
      choices: ['q', 'r', 'b', 'n'],
      orientation: 'black',
      color: 'black',
    });

    const queen = app.querySelector('[data-promotion="q"]');
    const knight = app.querySelector('[data-promotion="n"]');
    assert.equal(queen.style.getPropertyValue('left'), '75%');
    assert.equal(queen.style.getPropertyValue('top'), '0%');
    assert.equal(knight.style.getPropertyValue('top'), '12.5%');
    chooser.cancel();
    assert.equal(await pending, null);
  } finally {
    await close();
  }
});

test('backdrop and Escape cancel without selecting a promotion', async () => {
  const { createPromotionChooser, close } = await loadChooser();
  try {
    const document = new FakeDocument();
    const { app } = fixture(document);
    const chooser = createPromotionChooser({ app });

    let pending = chooser.choose({ center: 'position', to: 'e8', choices: ['q', 'r', 'b', 'n'] });
    app.querySelector('#promotion-choice').emit('click');
    assert.equal(await pending, null);

    pending = chooser.choose({ center: 'position', to: 'e8', choices: ['q', 'r', 'b', 'n'] });
    document.emit('keydown', { key: 'Escape' });
    assert.equal(await pending, null);
  } finally {
    await close();
  }
});

test('same-center sync recreates the chooser after renderer replacement', async () => {
  const { createPromotionChooser, close } = await loadChooser();
  try {
    const document = new FakeDocument();
    const { app, board } = fixture(document);
    const chooser = createPromotionChooser({ app });
    const pending = chooser.choose({ center: 'position', to: 'e8', choices: ['q', 'r', 'b', 'n'] });
    const first = app.querySelector('#promotion-choice');
    first.remove();
    assert.equal(board.children.length, 0);

    assert.equal(chooser.sync('position'), true);
    const replacement = app.querySelector('#promotion-choice');
    assert.ok(replacement);
    assert.notEqual(replacement, first);

    chooser.sync('different-position');
    assert.equal(await pending, null);
  } finally {
    await close();
  }
});
