import { positionFromUrl } from './graph.js';

function resolve(value) {
  return typeof value === 'function' ? value() : value;
}

function normalizeDepth(depth) {
  return Number.isFinite(depth) && depth >= 0 ? depth : 0;
}

function normalizeView(view, fallback) {
  if (view === 'roots' || view === 'lines') return view;
  return fallback === 'roots' ? 'roots' : 'lines';
}

export function createRouteLedger({
  location = () => globalThis.window?.location ?? globalThis.location,
  history = () => globalThis.history,
  events = () => globalThis.window,
  preferences = null,
  parseCenter = positionFromUrl,
} = {}) {
  function currentLocation() {
    const value = resolve(location);
    if (!value) throw new Error('RouteLedger requires a location');
    return value;
  }

  function currentHistory() {
    const value = resolve(history);
    if (!value) throw new Error('RouteLedger requires history');
    return value;
  }

  function routeUrl(route) {
    const url = new URL(currentLocation().href);
    url.searchParams.set('fen', route.center);
    url.searchParams.set('view', route.view);
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function read(historyState = currentHistory().state) {
    const current = currentLocation();
    const params = new URLSearchParams(current.search ?? new URL(current.href).search);
    return Object.freeze({
      center: parseCenter(params.toString() ? `?${params.toString()}` : ''),
      view: normalizeView(params.get('view'), preferences?.getView?.()),
      navDepth: normalizeDepth(historyState?.cvDepth),
    });
  }

  function write(method, route) {
    const target = currentHistory();
    target[method](
      { ...(target.state ?? {}), fen: route.center, cvDepth: normalizeDepth(route.navDepth) },
      '',
      routeUrl(route),
    );
  }

  function onRestore(handler) {
    const target = resolve(events);
    if (!target?.addEventListener) throw new Error('RouteLedger requires an event target for restoration');
    const listener = (event) => handler(read(event.state));
    target.addEventListener('popstate', listener);
    return () => target.removeEventListener?.('popstate', listener);
  }

  return Object.freeze({
    read,
    push(route) { write('pushState', route); },
    replace(route) { write('replaceState', route); },
    back() { currentHistory().back(); },
    onRestore,
  });
}
