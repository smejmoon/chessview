import { positionFromUrl } from './graph.js';

export type ViewMode = 'roots' | 'lines';

export interface Route {
  center: string;
  view: ViewMode;
}

export interface RouteLedger {
  read(): Route;
  push(route: Route): void;
  replace(route: Route): void;
  canGoBack(): boolean;
  back(): boolean;
  onRestore(handler: (route: Route) => void | Promise<void>): () => void;
}

type MaybeFactory<T> = T | (() => T);

type LocationLike = {
  href: string;
  search?: string;
};

type HistoryLike = {
  state?: Record<string, unknown> | null;
  pushState(state: Record<string, unknown>, title: string, url: string): void;
  replaceState(state: Record<string, unknown>, title: string, url: string): void;
  back(): void;
};

type RestoreEvent = { state?: unknown };
type RestoreListener = (event: RestoreEvent) => void;

type EventTargetLike = {
  addEventListener(type: 'popstate', listener: RestoreListener): void;
  removeEventListener?(type: 'popstate', listener: RestoreListener): void;
};

type PreferencesLike = {
  getView?(): unknown;
};

export interface RouteLedgerOptions {
  location?: MaybeFactory<LocationLike | undefined>;
  history?: MaybeFactory<HistoryLike | undefined>;
  events?: MaybeFactory<EventTargetLike | undefined>;
  preferences?: PreferencesLike | null;
  parseCenter?: (search: string) => string;
}

function resolve<T>(value: MaybeFactory<T>): T {
  return typeof value === 'function' ? (value as () => T)() : value;
}

function normalizeView(view: unknown, fallback: unknown): ViewMode {
  if (view === 'roots' || view === 'lines') return view;
  return fallback === 'roots' ? 'roots' : 'lines';
}

function stateRecord(state: unknown): Record<string, unknown> {
  return state && typeof state === 'object' ? state as Record<string, unknown> : {};
}

function hasChessviewParent(state: unknown): boolean {
  const record = stateRecord(state);
  if (record.cvHasParent === true) return true;
  const legacyDepth = record.cvDepth;
  return typeof legacyDepth === 'number'
    && Number.isFinite(legacyDepth)
    && legacyDepth > 0;
}

function navigationState(state: unknown, hasParent: boolean): Record<string, unknown> {
  const next = { ...stateRecord(state) };
  delete next.fen;
  delete next.cvDepth;
  delete next.cvHasParent;
  next.cvHasParent = hasParent;
  return next;
}

export function createRouteLedger({
  location = () => globalThis.window?.location,
  history = () => globalThis.history,
  events = () => globalThis.window,
  preferences = null,
  parseCenter = positionFromUrl,
}: RouteLedgerOptions = {}): RouteLedger {
  function currentLocation(): LocationLike {
    const value = resolve(location);
    if (!value) throw new Error('RouteLedger requires a location');
    return value;
  }

  function currentHistory(): HistoryLike {
    const value = resolve(history);
    if (!value) throw new Error('RouteLedger requires history');
    return value;
  }

  function routeUrl(route: Route): string {
    const url = new URL(currentLocation().href);
    url.searchParams.set('fen', route.center);
    url.searchParams.set('view', route.view);
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function read(): Route {
    const current = currentLocation();
    const params = new URLSearchParams(current.search ?? new URL(current.href).search);
    return Object.freeze({
      center: parseCenter(params.toString() ? `?${params.toString()}` : ''),
      view: normalizeView(params.get('view'), preferences?.getView?.()),
    });
  }

  function write(method: 'pushState' | 'replaceState', route: Route): void {
    const target = currentHistory();
    const hasParent = method === 'pushState' || hasChessviewParent(target.state);
    target[method](navigationState(target.state, hasParent), '', routeUrl(route));
  }

  function canGoBack(): boolean {
    return hasChessviewParent(currentHistory().state);
  }

  function back(): boolean {
    if (!canGoBack()) return false;
    currentHistory().back();
    return true;
  }

  function onRestore(handler: (route: Route) => void | Promise<void>): () => void {
    const target = resolve(events);
    if (!target?.addEventListener) throw new Error('RouteLedger requires an event target for restoration');
    const listener: RestoreListener = () => { void handler(read()); };
    target.addEventListener('popstate', listener);
    return () => target.removeEventListener?.('popstate', listener);
  }

  return Object.freeze({
    read,
    push(route: Route) { write('pushState', route); },
    replace(route: Route) { write('replaceState', route); },
    canGoBack,
    back,
    onRestore,
  });
}
