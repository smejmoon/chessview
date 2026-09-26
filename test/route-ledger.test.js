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
    state: { cvDepth: 0, keep: 'value' },
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
    emit(state) { for (const listener of [...listeners]) listener({ state }); },
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

test('reads route identity from URL and history state', () => {
  const { ledger } = fixture();
  assert.deepEqual(ledger.read(), { center: START, view: 'lines', navDepth: 0 });
});

test('falls back to PreferenceStore view when URL has no explicit mode', () => {
  const { ledger } = fixture(`https://example.test/chessview/?fen=${encodeURIComponent(START)}`);
  assert.equal(ledger.read().view, 'roots');
});

test('push and replace round-trip ChessView route through browser URL and state', () => {
  const { ledger, calls, history } = fixture();
  ledger.push({ center: OTHER, view: 'roots', navDepth: 1 });
  assert.equal(calls.at(-1)[0], 'push');
  assert.equal(history.state.keep, 'value');
  assert.deepEqual(ledger.read(), { center: OTHER, view: 'roots', navDepth: 1 });

  ledger.replace({ center: START, view: 'lines', navDepth: 1 });
  assert.equal(calls.at(-1)[0], 'replace');
  assert.deepEqual(ledger.read(), { center: START, view: 'lines', navDepth: 1 });
});

test('native popstate is translated into a restored ChessView route', () => {
  const { ledger, events, setHref } = fixture();
  const restored = [];
  const stop = ledger.onRestore((route) => restored.push(route));
  setHref(`https://example.test/chessview/?fen=${encodeURIComponent(OTHER)}&view=roots`);
  events.emit({ cvDepth: 4 });
  assert.deepEqual(restored, [{ center: OTHER, view: 'roots', navDepth: 4 }]);

  stop();
  events.emit({ cvDepth: 5 });
  assert.equal(restored.length, 1);
});
