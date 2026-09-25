import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const { completeLichessAuth } = await import('../src/auth.js');

function installBrowser({ href }) {
  const url = new URL(href);
  globalThis.localStorage = new MemoryStorage();
  globalThis.sessionStorage = new MemoryStorage();
  globalThis.window = {
    location: {
      href: url.toString(),
      search: url.search,
    },
  };
  const replacements = [];
  globalThis.history = {
    state: { marker: true },
    replaceState(state, title, next) {
      replacements.push(next);
    },
  };
  return replacements;
}

function seedTransaction(state = 'expected') {
  sessionStorage.setItem('chessview.lichess.pkceVerifier', 'verifier');
  sessionStorage.setItem('chessview.lichess.oauthState', state);
  sessionStorage.setItem('chessview.lichess.redirectUri', 'https://example.test/chessview/?fen=abc');
}

test('state mismatch consumes the failed callback and clears PKCE state', async () => {
  const replacements = installBrowser({ href: 'https://example.test/chessview/?fen=abc&code=bad&state=wrong' });
  seedTransaction('expected');

  await assert.rejects(completeLichessAuth(), /verify the Lichess sign-in response/);
  assert.equal(sessionStorage.getItem('chessview.lichess.pkceVerifier'), null);
  assert.equal(sessionStorage.getItem('chessview.lichess.oauthState'), null);
  assert.equal(sessionStorage.getItem('chessview.lichess.redirectUri'), null);
  assert.equal(replacements.at(-1), '/chessview/?fen=abc');
});

test('token exchange failure consumes the callback and clears PKCE state', async () => {
  const replacements = installBrowser({ href: 'https://example.test/chessview/?fen=abc&code=code123&state=expected' });
  seedTransaction('expected');
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    text: async () => 'server failure',
  });

  await assert.rejects(completeLichessAuth(), /token exchange returned 500/);
  assert.equal(sessionStorage.getItem('chessview.lichess.pkceVerifier'), null);
  assert.equal(sessionStorage.getItem('chessview.lichess.oauthState'), null);
  assert.equal(replacements.at(-1), '/chessview/?fen=abc');
});

test('successful token exchange stores the token and cleans callback parameters', async () => {
  const replacements = installBrowser({ href: 'https://example.test/chessview/?fen=abc&code=code123&state=expected' });
  seedTransaction('expected');
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ access_token: 'token123', token_type: 'Bearer' }),
  });

  assert.equal(await completeLichessAuth(), 'token123');
  assert.equal(localStorage.getItem('chessview.lichess.accessToken'), 'token123');
  assert.equal(sessionStorage.getItem('chessview.lichess.pkceVerifier'), null);
  assert.equal(replacements.at(-1), '/chessview/?fen=abc');
});
