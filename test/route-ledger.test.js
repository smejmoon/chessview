import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalPosition, START_FEN } from '../src/graph.js';
import { createRouteLedger } from '../src/route-ledger.js';

const START = canonicalPosition(START_FEN);
const OTHER = canonicalPosition('8/8/8/8/8/8/4K3/7k w - - 0 1');

function fixture(href = `https://example.test/chessview/?fen=${encodeURIComponent(START)}&view=lines`) {
  let current = new URL(href);
  const calls = [];
  const listeners = new Set();
  const location = {
    get href() { return current.toString(); },
    get search() { return current.search; },
  };
  const history = {
    state: { keep: 'value' },
    pushState(state, _title, next) {
      this.state = state;
      current = new URL(next, current);
      calls.push(['push', next, state]);
    },
    replaceState(state, _title, next) {
      this.state = state;
      current = new URL(next, current);
      calls.push(['replace', next, state]);
    },
    back() { calls.push(['back']); },
  };
  const events = {
    addEventListener(type, listener) { if (type === 'popstate') listeners.add(listener); },
    removeEventListener(type, listener) { if (type === 'popstate') listeners.delete(listener); },
    emit(state) {
      history.state = state;
      for (const listener of [...listeners]) listener({ state });
    },
  };
  const preferences = { getView: () => 'roots' };
  const ledger = createRouteLedger({ location, history, events, preferences });
  return {
    ledger,
    calls,
    history,
    events,
    setHref(value) { current = new URL(value, current); },
  };
}

test('reads shareable route identity from the URL', () => {
  const { ledger } = fixture();
  assert.deepEqual(ledger.read(), { center: START, view: 'lines' });
});

test('falls back to PreferenceStore view when URL has no explicit mode', () => {
  const { ledger } = fixture(`https://example.test/chessview/?fen=${encodeURIComponent(START)}`);
  assert.equal(ledger.read().view, 'roots');
});

test('replace and push keep browser-entry navigation metadata out of the route', () => {
  const { ledger, calls, history } = fixture();

  ledger.replace({ center: START, view: 'lines' });
  assert.equal(calls.at(-1)[0], 'replace');
  assert.equal(history.state.keep, 'value');
  assert.equal(history.state.cvHasParent, false);
  assert.equal(Object.hasOwn(history.state, 'fen'), false);
  assert.equal(Object.hasOwn(history.state, 'cvDepth'), false);
  assert.deepEqual(ledger.read(), { center: START, view: 'lines' });
  assert.equal(ledger.canGoBack(), false);

  ledger.push({ center: OTHER, view: 'roots' });
  assert.equal(calls.at(-1)[0], 'push');
  assert.equal(history.state.cvHasParent, true);
  assert.deepEqual(ledger.read(), { center: OTHER, view: 'roots' });
  assert.equal(ledger.canGoBack(), true);

  ledger.replace({ center: START, view: 'lines' });
  assert.equal(history.state.cvHasParent, true);
  assert.deepEqual(ledger.read(), { center: START, view: 'lines' });
});

test('back availability is owned by RouteLedger', () => {
  const { ledger, calls } = fixture();
  assert.equal(ledger.back(), false);
  assert.equal(calls.some(([name]) => name === 'back'), false);

  ledger.push({ center: OTHER, view: 'roots' });
  assert.equal(ledger.back(), true);
  assert.equal(calls.at(-1)[0], 'back');
});

test('native popstate restores the URL address while entry metadata drives back availability', () => {
  const { ledger, events, setHref } = fixture();
  const restored = [];
  const stop = ledger.onRestore((route) => restored.push(route));

  setHref(`https://example.test/chessview/?fen=${encodeURIComponent(OTHER)}&view=roots`);
  events.emit({ cvHasParent: true });
  assert.deepEqual(restored.at(-1), { center: OTHER, view: 'roots' });
  assert.equal(ledger.canGoBack(), true);

  setHref(`https://example.test/chessview/?fen=${encodeURIComponent(START)}&view=lines`);
  events.emit({ cvHasParent: false });
  assert.deepEqual(restored.at(-1), { center: START, view: 'lines' });
  assert.equal(ledger.canGoBack(), false);

  stop();
  events.emit({ cvHasParent: true });
  assert.equal(restored.length, 2);
});

test('legacy cvDepth entries retain back availability until rewritten', () => {
  const { ledger, events } = fixture();
  const stop = ledger.onRestore(() => {});
  events.emit({ cvDepth: 4 });
  assert.equal(ledger.canGoBack(), true);
  stop();
});
