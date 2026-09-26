import { createLichessSession, lichessSession } from './lichess-session.js';

export { createLichessSession, lichessSession };

export function getLichessAccessToken() {
  return lichessSession.accessToken();
}

export function clearLichessAccessToken() {
  return lichessSession.clearAccessToken();
}

export function isLichessAuthenticated() {
  return lichessSession.isAuthenticated();
}

export function beginLichessAuth() {
  return lichessSession.signIn();
}

export function completeLichessAuth() {
  return lichessSession.completeCallback();
}

export function requireLichessAccessToken() {
  return lichessSession.requireAccessToken();
}
