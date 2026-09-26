import { debugLog } from './debug.js';
import { lichessGateway } from './lichess-gateway.js';

const LICHESS_HOST = 'https://lichess.org';
const CLIENT_ID = 'chessview.smejmoon.github.io';
const TOKEN_KEY = 'chessview.lichess.accessToken';
const VERIFIER_KEY = 'chessview.lichess.pkceVerifier';
const STATE_KEY = 'chessview.lichess.oauthState';
const REDIRECT_KEY = 'chessview.lichess.redirectUri';

function resolve(value) {
  return typeof value === 'function' ? value() : value;
}

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

export function createLichessSession({
  gateway = lichessGateway,
  location = () => globalThis.window?.location ?? globalThis.location,
  history = () => globalThis.history,
  localStorage = () => globalThis.localStorage,
  sessionStorage = () => globalThis.sessionStorage,
  crypto = () => globalThis.crypto,
  redirect = (url) => globalThis.window?.location?.assign(url),
  log = debugLog,
} = {}) {
  function currentLocation() {
    const value = resolve(location);
    if (!value) throw new Error('LichessSession requires a location');
    return value;
  }

  function persistentStorage() {
    return resolve(localStorage);
  }

  function transactionStorage() {
    return resolve(sessionStorage);
  }

  function cleanRedirectUri() {
    const url = new URL(currentLocation().href);
    url.hash = '';
    for (const key of ['code', 'state', 'error', 'error_description']) url.searchParams.delete(key);
    return url.toString();
  }

  function cleanCallbackUrl() {
    const url = new URL(currentLocation().href);
    for (const key of ['code', 'state', 'error', 'error_description']) url.searchParams.delete(key);
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function clearTransaction({ cleanUrl = false } = {}) {
    const storage = transactionStorage();
    storage?.removeItem(VERIFIER_KEY);
    storage?.removeItem(STATE_KEY);
    storage?.removeItem(REDIRECT_KEY);
    if (cleanUrl) {
      const browserHistory = resolve(history);
      browserHistory?.replaceState(browserHistory.state, '', cleanCallbackUrl());
    }
  }

  function accessToken() {
    return persistentStorage()?.getItem(TOKEN_KEY) ?? null;
  }

  function clearAccessToken() {
    persistentStorage()?.removeItem(TOKEN_KEY);
  }

  function isAuthenticated() {
    return Boolean(accessToken());
  }

  function randomUrlSafe(size) {
    const bytes = new Uint8Array(size);
    resolve(crypto).getRandomValues(bytes);
    return base64Url(bytes);
  }

  async function challengeFor(verifier) {
    const digest = await resolve(crypto).subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return base64Url(new Uint8Array(digest));
  }

  async function signIn() {
    const verifier = randomUrlSafe(64);
    const state = randomUrlSafe(32);
    const redirectUri = cleanRedirectUri();
    const challenge = await challengeFor(verifier);
    const storage = transactionStorage();

    storage.setItem(VERIFIER_KEY, verifier);
    storage.setItem(STATE_KEY, state);
    storage.setItem(REDIRECT_KEY, redirectUri);

    const url = new URL(`${LICHESS_HOST}/oauth`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', CLIENT_ID);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('state', state);

    log('lichess auth redirect', { redirectUri, clientId: CLIENT_ID });
    redirect(url.toString());
  }

  async function completeCallback() {
    const params = new URLSearchParams(currentLocation().search);
    const code = params.get('code');
    const returnedState = params.get('state');
    const oauthError = params.get('error');

    if (oauthError) {
      const description = params.get('error_description') || oauthError;
      clearTransaction({ cleanUrl: true });
      log('lichess auth denied', { error: oauthError, description }, 'warn');
      throw new Error(`Lichess sign-in failed: ${description}`);
    }
    if (!code) return accessToken();

    const storage = transactionStorage();
    const verifier = storage.getItem(VERIFIER_KEY);
    const expectedState = storage.getItem(STATE_KEY);
    const redirectUri = storage.getItem(REDIRECT_KEY) || cleanRedirectUri();

    if (!verifier || !expectedState || !returnedState || returnedState !== expectedState) {
      log('lichess auth state mismatch', { hasVerifier: Boolean(verifier), hasExpectedState: Boolean(expectedState) }, 'error');
      clearTransaction({ cleanUrl: true });
      throw new Error('Could not verify the Lichess sign-in response. Reload to sign in again.');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      client_id: CLIENT_ID,
    });

    log('lichess token exchange', { redirectUri, clientId: CLIENT_ID });
    let response;
    try {
      response = await gateway.request(`${LICHESS_HOST}/api/token`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
    } catch (error) {
      clearTransaction({ cleanUrl: true });
      log('lichess token exchange network failure', error, 'error');
      throw new Error('Lichess sign-in token exchange failed. Reload to sign in again.');
    }

    if (!response.ok) {
      let detail = '';
      try { detail = (await response.text()).slice(0, 300); } catch {}
      clearTransaction({ cleanUrl: true });
      log('lichess token exchange failed', { status: response.status, detail }, 'error');
      throw new Error(`Lichess sign-in token exchange returned ${response.status}. Reload to sign in again.`);
    }

    const token = await response.json();
    if (!token?.access_token) {
      clearTransaction({ cleanUrl: true });
      throw new Error('Lichess sign-in did not return an access token. Reload to sign in again.');
    }

    persistentStorage()?.setItem(TOKEN_KEY, token.access_token);
    clearTransaction({ cleanUrl: true });
    log('lichess auth complete', { tokenType: token.token_type ?? 'Bearer', scope: token.scope ?? '' });
    return token.access_token;
  }

  async function requireAccessToken() {
    const token = await completeCallback();
    if (token) return token;
    await signIn();
    throw new Error('Redirecting to Lichess sign-in…');
  }

  return Object.freeze({
    accessToken,
    clearAccessToken,
    isAuthenticated,
    signIn,
    completeCallback,
    requireAccessToken,
  });
}

export const lichessSession = createLichessSession();
