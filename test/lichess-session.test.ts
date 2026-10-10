import assert from 'node:assert/strict';
import test from 'node:test';
import { createLichessSession } from '../src/lichess-session.ts';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function fixture({ href, response, storedToken, crypto, redirect, localStorage: suppliedLocalStorage }) {
  let current = new URL(href);
  const localStorage = suppliedLocalStorage ?? new MemoryStorage();
  if (storedToken) localStorage.setItem('chessview.lichess.accessToken', storedToken);
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

const authCrypto = {
  getRandomValues(bytes: Uint8Array) { bytes.fill(7); return bytes; },
  subtle: { async digest() { return new Uint8Array(32).buffer; } },
};

test('401 invalidates current token, notifies once and never redirects from requests', async () => {
  const redirects: string[] = [];
  const { session, localStorage } = fixture({
    href: 'https://example.test/chessview/?fen=abc',
    storedToken: 'token123',
    response: { ok: false, status: 401 },
    crypto: authCrypto,
    redirect: (url: string) => { redirects.push(url); },
  });
  let notices = 0;
  session.onAuthorizationLost(() => { notices++; });
  const response = await session.authorizedRequest('https://explorer.lichess.org/lichess');
  assert.equal(response.status, 401);
  assert.equal(localStorage.getItem('chessview.lichess.accessToken'), null);
  assert.equal(notices, 1);
  await assert.rejects(session.authorizedRequest('https://explorer.lichess.org/lichess'), /Reconnect Lichess/);
  assert.equal(notices, 1);
  assert.deepEqual(redirects, []);

  // Only the application's deliberate reconnect action can navigate.
  assert.equal(await session.establishAuthorization(), null);
  assert.equal(redirects.length, 1);
  const redirectUrl = new URL(redirects[0]);
  assert.equal(redirectUrl.origin, 'https://lichess.org');
  assert.equal(redirectUrl.pathname, '/oauth');
  assert.equal(new URL(redirectUrl.searchParams.get('redirect_uri')!).searchParams.get('fen'), 'abc');
});

test('a stale 401 cannot invalidate a more recently stored token', async () => {
  const { session, localStorage } = fixture({
    href: 'https://example.test/chessview/',
    storedToken: 'old',
    response: { ok: false, status: 401 },
  });
  let notices = 0;
  session.onAuthorizationLost(() => { notices++; });
  // Mutating stored state simulates another completed authorization while the request is in flight.
  const gatewayRequest = session.authorizedRequest('https://explorer.lichess.org/masters');
  localStorage.setItem('chessview.lichess.accessToken', 'new');
  await gatewayRequest;
  assert.equal(localStorage.getItem('chessview.lichess.accessToken'), 'new');
  assert.equal(notices, 0);
});

test('malformed successful token JSON consumes callback before explicit retry', async () => {
  const redirects: string[] = [];
  const { session, sessionStorage, replacements } = fixture({
    href: 'https://example.test/chessview/?fen=abc&code=code123&state=expected',
    response: { ok: true, status: 200, json: async () => { throw new SyntaxError('bad JSON'); } },
    crypto: authCrypto,
    redirect: (url: string) => { redirects.push(url); },
  });
  seedTransaction(sessionStorage);
  await assert.rejects(session.establishAuthorization(), /token response was invalid/);
  assert.equal(sessionStorage.getItem('chessview.lichess.pkceVerifier'), null);
  assert.equal(sessionStorage.getItem('chessview.lichess.oauthState'), null);
  assert.equal(replacements.at(-1), '/chessview/?fen=abc');
  assert.equal(await session.establishAuthorization(), null);
  assert.equal(redirects.length, 1);
  assert.equal(new URL(redirects[0]).searchParams.get('response_type'), 'code');
});

test('token persistence failure consumes callback without false authorization', async () => {
  const redirects: string[] = [];
  class FailingStorage extends MemoryStorage {
    setItem(key: string, value: string) {
      if (key === 'chessview.lichess.accessToken') throw new Error('quota');
      super.setItem(key, value);
    }
  }
  const { session, sessionStorage, replacements } = fixture({
    href: 'https://example.test/chessview/?code=code123&state=expected',
    response: { ok: true, status: 200, json: async () => ({ access_token: 'token123' }) },
    localStorage: new FailingStorage(),
    crypto: authCrypto,
    redirect: (url: string) => { redirects.push(url); },
  });
  seedTransaction(sessionStorage);
  await assert.rejects(session.establishAuthorization(), /could not be saved/);
  assert.equal(session.isAuthenticated(), false);
  assert.equal(sessionStorage.getItem('chessview.lichess.pkceVerifier'), null);
  assert.equal(replacements.at(-1), '/chessview/');
  assert.equal(await session.establishAuthorization(), null);
  assert.equal(redirects.length, 1);
});

test('denied callback never redirects until explicitly retried', async () => {
  const redirects: string[] = [];
  const { session, sessionStorage, replacements } = fixture({
    href: 'https://example.test/chessview/?error=access_denied',
    crypto: authCrypto,
    redirect: (url: string) => { redirects.push(url); },
  });
  seedTransaction(sessionStorage);
  await assert.rejects(session.establishAuthorization(), /access_denied/);
  assert.equal(replacements.at(-1), '/chessview/');
  assert.deepEqual(redirects, []);
  assert.equal(await session.establishAuthorization(), null);
  assert.equal(redirects.length, 1);
});

test('authorized requests forward HTTP options and work separately without OAuth navigation', async () => {
  const calls = [];
  const session = createLichessSession({
    gateway: {
      async request(input, init, work) {
        calls.push({ input, init, work });
        return { status: 200, ok: true };
      },
    },
    localStorage: new MemoryStorage(),
    location: { href: 'https://example.test/chessview/', search: '' },
    log: () => {},
  });
  // The session must not create authorization from source demand.
  await assert.rejects(session.authorizedRequest('https://explorer.lichess.org/lichess'), /Reconnect Lichess/);
  assert.equal(calls.length, 0);
});
