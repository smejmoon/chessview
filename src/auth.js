import { debugLog } from './debug.js';
import { lichessGateway } from './lichess-gateway.js';

const LICHESS_HOST = 'https://lichess.org';
const CLIENT_ID = 'chessview.smejmoon.github.io';
const TOKEN_KEY = 'chessview.lichess.accessToken';
const VERIFIER_KEY = 'chessview.lichess.pkceVerifier';
const STATE_KEY = 'chessview.lichess.oauthState';
const REDIRECT_KEY = 'chessview.lichess.redirectUri';

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function randomUrlSafe(size = 48) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function cleanRedirectUri() {
  const url = new URL(window.location.href);
  url.hash = '';
  for (const key of ['code', 'state', 'error', 'error_description']) url.searchParams.delete(key);
  return url.toString();
}

function cleanCallbackUrl() {
  const url = new URL(window.location.href);
  for (const key of ['code', 'state', 'error', 'error_description']) url.searchParams.delete(key);
  return `${url.pathname}${url.search}${url.hash}`;
}

function clearAuthTransaction({ cleanUrl = false } = {}) {
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(REDIRECT_KEY);
  if (cleanUrl) history.replaceState(history.state, '', cleanCallbackUrl());
}

export function getLichessAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearLichessAccessToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLichessAuthenticated() {
  return Boolean(getLichessAccessToken());
}

export async function beginLichessAuth() {
  const verifier = randomUrlSafe(64);
  const state = randomUrlSafe(32);
  const redirectUri = cleanRedirectUri();
  const challenge = await challengeFor(verifier);

  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(REDIRECT_KEY, redirectUri);

  const url = new URL(`${LICHESS_HOST}/oauth`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('state', state);

  debugLog('lichess auth redirect', { redirectUri, clientId: CLIENT_ID });
  window.location.assign(url.toString());
}

export async function completeLichessAuth() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const returnedState = params.get('state');
  const oauthError = params.get('error');

  if (oauthError) {
    const description = params.get('error_description') || oauthError;
    clearAuthTransaction({ cleanUrl: true });
    debugLog('lichess auth denied', { error: oauthError, description }, 'warn');
    throw new Error(`Lichess sign-in failed: ${description}`);
  }
  if (!code) return getLichessAccessToken();

  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const expectedState = sessionStorage.getItem(STATE_KEY);
  const redirectUri = sessionStorage.getItem(REDIRECT_KEY) || cleanRedirectUri();

  if (!verifier || !expectedState || !returnedState || returnedState !== expectedState) {
    debugLog('lichess auth state mismatch', { hasVerifier: Boolean(verifier), hasExpectedState: Boolean(expectedState) }, 'error');
    clearAuthTransaction({ cleanUrl: true });
    throw new Error('Could not verify the Lichess sign-in response. Reload to sign in again.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
    client_id: CLIENT_ID,
  });

  debugLog('lichess token exchange', { redirectUri, clientId: CLIENT_ID });
  let response;
  try {
    response = await lichessGateway.request(`${LICHESS_HOST}/api/token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
  } catch (error) {
    clearAuthTransaction({ cleanUrl: true });
    debugLog('lichess token exchange network failure', error, 'error');
    throw new Error('Lichess sign-in token exchange failed. Reload to sign in again.');
  }

  if (!response.ok) {
    let detail = '';
    try { detail = (await response.text()).slice(0, 300); } catch {}
    clearAuthTransaction({ cleanUrl: true });
    debugLog('lichess token exchange failed', { status: response.status, detail }, 'error');
    throw new Error(`Lichess sign-in token exchange returned ${response.status}. Reload to sign in again.`);
  }

  const token = await response.json();
  if (!token?.access_token) {
    clearAuthTransaction({ cleanUrl: true });
    throw new Error('Lichess sign-in did not return an access token. Reload to sign in again.');
  }

  localStorage.setItem(TOKEN_KEY, token.access_token);
  clearAuthTransaction({ cleanUrl: true });
  debugLog('lichess auth complete', { tokenType: token.token_type ?? 'Bearer', scope: token.scope ?? '' });
  return token.access_token;
}

export async function requireLichessAccessToken() {
  const token = await completeLichessAuth();
  if (token) return token;
  await beginLichessAuth();
  throw new Error('Redirecting to Lichess sign-in…');
}
