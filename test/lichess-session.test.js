import assert from 'node:assert/strict';
import test from 'node:test';
import { createLichessSession } from '../src/lichess-session.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function fixture({ href, response }) {
  let current = new URL(href);
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const replacements = [];
  const history = {
    state: { marker: true },
    replaceState(state, _title, next) {
      this.state = state;
      current = new URL(next, current);
      replacements.push(next);
    },
  };
  const location = {
    get href() { return current.toString(); },
    get search() { return current.search; },
  };
  const gateway = {
    async request() {
      if (response instanceof Error) throw response;
      return response;
    },
  };
  const session = createLichessSession({
    gateway,
    location,
    history,
    localStorage,
    sessionStorage,
    log: () => {},
  });
  return { session, localStorage, sessionStorage, replacements };
}

function seedTransaction(storage, state = 'expected') {
  storage.setItem('chessview.lichess.pkceVerifier', 'verifier');
  storage.setItem('chessview.lichess.oauthState', state);
  storage.setItem('chessview.lichess.redirectUri', 'https://example.test/chessview/?fen=abc');
}

test('state mismatch consumes failed callback and clears transaction state', async () => {
  const { session, sessionStorage, replacements } = fixture({
    href: 'https://example.test/chessview/?fen=abc&code=bad&state=wrong',
  });
  seedTransaction(sessionStorage, 'expected');

  await assert.rejects(session.completeCallback(), /verify the Lichess sign-in response/);
  assert.equal(sessionStorage.getItem('chessview.lichess.pkceVerifier'), null);
  assert.equal(sessionStorage.getItem('chessview.lichess.oauthState'), null);
  assert.equal(sessionStorage.getItem('chessview.lichess.redirectUri'), null);
  assert.equal(replacements.at(-1), '/chessview/?fen=abc');
});

test('token exchange failure consumes callback and clears transaction state', async () => {
  const { session, sessionStorage, replacements } = fixture({
    href: 'https://example.test/chessview/?fen=abc&code=code123&state=expected',
    response: {
      ok: false,
      status: 500,
      text: async () => 'server failure',
    },
  });
  seedTransaction(sessionStorage);

  await assert.rejects(session.completeCallback(), /token exchange returned 500/);
  assert.equal(sessionStorage.getItem('chessview.lichess.pkceVerifier'), null);
  assert.equal(sessionStorage.getItem('chessview.lichess.oauthState'), null);
  assert.equal(replacements.at(-1), '/chessview/?fen=abc');
});

test('successful token exchange establishes and clears LichessSession state', async () => {
  const { session, localStorage, sessionStorage, replacements } = fixture({
    href: 'https://example.test/chessview/?fen=abc&code=code123&state=expected',
    response: {
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'token123', token_type: 'Bearer' }),
    },
  });
  seedTransaction(sessionStorage);

  assert.equal(await session.completeCallback(), 'token123');
  assert.equal(session.accessToken(), 'token123');
  assert.equal(session.isAuthenticated(), true);
  assert.equal(localStorage.getItem('chessview.lichess.accessToken'), 'token123');
  assert.equal(sessionStorage.getItem('chessview.lichess.pkceVerifier'), null);
  assert.equal(replacements.at(-1), '/chessview/?fen=abc');

  session.clearAccessToken();
  assert.equal(session.isAuthenticated(), false);
});
