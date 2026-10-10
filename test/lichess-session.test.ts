import assert from 'node:assert/strict';
import test from 'node:test';
import { createLichessSession } from '../src/lichess-session.ts';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function fixture({ href, response, crypto, redirect }) {
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
    ...(crypto ? { crypto } : {}),
    ...(redirect ? { redirect } : {}),
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

  await assert.rejects(session.establishAuthorization(), /verify the Lichess sign-in response/);
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

  await assert.rejects(session.establishAuthorization(), /token exchange returned 500/);
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

  assert.equal(await session.establishAuthorization(), 'token123');
  assert.equal(localStorage.getItem('chessview.lichess.accessToken'), 'token123');
  assert.equal(sessionStorage.getItem('chessview.lichess.pkceVerifier'), null);
  assert.equal(replacements.at(-1), '/chessview/?fen=abc');
});

const authCrypto = {
  getRandomValues(bytes) { bytes.fill(7); return bytes; },
  subtle: { async digest() { return new Uint8Array(32).buffer; } },
};

test('authorized requests never initiate an OAuth redirect', async () => {
  const redirects = [];
  const session = createLichessSession({
    location: { href: 'https://example.test/chessview/', search: '' },
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    crypto: authCrypto,
    redirect: (url) => { redirects.push(url); },
    log: () => {},
  });

  await assert.rejects(session.authorizedRequest('https://explorer.lichess.org/lichess'), /authorization required/);
  assert.equal(redirects.length, 0);
  assert.equal(await session.establishAuthorization(), null);
  assert.equal(redirects.length, 1);
  await assert.rejects(session.authorizedRequest('https://explorer.lichess.org/lichess'), /authorization required/);
  assert.equal(redirects.length, 1);
});

test('callback denial is reported at bootstrap and retries only when explicitly called', async () => {
  const redirects = [];
  const { session, sessionStorage, replacements } = fixture({
    href: 'https://example.test/chessview/?error=access_denied',
    crypto: authCrypto,
    redirect: (url) => { redirects.push(url); },
  });
  seedTransaction(sessionStorage);
  await assert.rejects(session.establishAuthorization(), /Lichess sign-in failed: access_denied/);
  assert.equal(replacements.length, 1);
  assert.equal(redirects.length, 0);
  assert.equal(await session.establishAuthorization(), null);
  assert.equal(redirects.length, 1);
});

test('terminal token exchange failure permits a later explicit bootstrap retry', async () => {
  let exchanges = 0;
  const redirects = [];
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  seedTransaction(sessionStorage);
  let current = new URL('https://example.test/chessview/?code=code123&state=expected');
  const session = createLichessSession({
    gateway: { async request() { exchanges++; return { ok: false, status: 500, text: async () => 'failed' }; } },
    location: { get href() { return current.href; }, get search() { return current.search; } },
    history: { state: null, replaceState(_state, _title, next) { current = new URL(next, current); } },
    localStorage,
    sessionStorage,
    crypto: authCrypto,
    redirect: (url) => { redirects.push(url); },
    log: () => {},
  });

  await assert.rejects(session.establishAuthorization(), /token exchange returned 500/);
  assert.equal(exchanges, 1);
  assert.equal(await session.establishAuthorization(), null);
  assert.equal(redirects.length, 1);
  assert.equal(exchanges, 1);
});

test('authorized request attaches token and 401 invalidates it without a redirect', async () => {
  const localStorage = new MemoryStorage();
  localStorage.setItem('chessview.lichess.accessToken', 'token123');
  const redirects = [];
  let calls = 0;
  const session = createLichessSession({
    localStorage,
    gateway: {
      async request(_url, init) {
        calls++;
        assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer token123');
        return { status: 401 };
      },
    },
    redirect: (url) => { redirects.push(url); },
    log: () => {},
  });
  const response = await session.authorizedRequest('https://explorer.lichess.org/lichess');
  assert.equal(response.status, 401);
  assert.equal(localStorage.getItem('chessview.lichess.accessToken'), null);
  await assert.rejects(session.authorizedRequest('https://explorer.lichess.org/lichess'), /authorization required/);
  assert.equal(calls, 1);
  assert.equal(redirects.length, 0);
});
