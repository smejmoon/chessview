import { isDebugEnabled, setDebugEnabled } from './debug.js';
import { compositionConstraints, derivePresentationGeometry } from './presentation-geometry.js';
import type { PresentationConstraints, PresentationGeometry } from './presentation-geometry.ts';
import type { ViewMode } from './route-ledger.ts';

export type Orientation = 'white' | 'black';

type LensPreferences = Readonly<{
  getOrientation?: () => unknown;
  setOrientation?: (orientation: Orientation) => unknown;
  getGuide?: () => unknown;
  setGuide?: (enabled: boolean) => unknown;
}>;

type LensDebug = Readonly<{
  enabled(): boolean;
  setEnabled(enabled: boolean): unknown;
}>;

export type Lens = Readonly<{
  orientation(): Orientation;
  setOrientation(orientation: Orientation): Orientation;
  flipOrientation(): Orientation;
  guideEnabled(): boolean;
  setGuide(enabled: boolean): boolean;
  toggleGuide(): boolean;
  debugEnabled(): boolean;
  setDebug(enabled: boolean): boolean;
  toggleDebug(): boolean;
  geometry(mode: ViewMode): PresentationGeometry;
  constraints(mode: ViewMode): PresentationConstraints;
}>;

export type LensOptions = Readonly<{
  app?: Element | null;
  preferences?: LensPreferences | null;
  debug?: LensDebug | null;
}>;

function normalizeOrientation(value: unknown): Orientation {
  return value === 'black' ? 'black' : 'white';
}

export function createLens({
  app: appOption = null,
  preferences: preferenceOption = null,
  debug: debugOption = null,
}: LensOptions = {}): Lens {
  const app = appOption ?? globalThis.document?.querySelector('#app') ?? null;
  if (!app) throw new Error('Lens requires an app element');
  const root = app as Element;
  const preferences = preferenceOption ?? {};
  const document = root.ownerDocument ?? globalThis.document;
  const window = document?.defaultView ?? globalThis.window;
  const debugState = debugOption ?? Object.freeze({
    enabled: isDebugEnabled,
    setEnabled: setDebugEnabled,
  });
  let orientation = normalizeOrientation(preferences.getOrientation?.());
  let guide = preferences.getGuide?.() === true;

  function setOrientation(next: Orientation): Orientation {
    orientation = normalizeOrientation(next);
    preferences.setOrientation?.(orientation);
    return orientation;
  }

  function setGuide(enabled: boolean): boolean {
    guide = Boolean(enabled);
    preferences.setGuide?.(guide);
    return guide;
  }

  function setDebug(enabled: boolean): boolean {
    debugState.setEnabled(Boolean(enabled));
    return debugState.enabled();
  }

  function geometry(mode: ViewMode): PresentationGeometry {
    const map = root.querySelector?.('#map') as HTMLElement | null;
    const rect = map?.getBoundingClientRect?.();
    const width = rect?.width && rect.width > 0 ? rect.width : Math.max(320, (window?.innerWidth ?? 1280) - 340);
    const height = rect?.height && rect.height > 0 ? rect.height : Math.max(240, (window?.innerHeight ?? 720) - 54);
    return derivePresentationGeometry({ width, height, upstreamContext: mode === 'roots' });
  }

  return Object.freeze({
    orientation: () => orientation,
    setOrientation,
    flipOrientation: () => setOrientation(orientation === 'white' ? 'black' : 'white'),
    guideEnabled: () => guide,
    setGuide,
    toggleGuide: () => setGuide(!guide),
    debugEnabled: () => debugState.enabled(),
    setDebug,
    toggleDebug: () => setDebug(!debugState.enabled()),
    geometry,
    constraints: (mode: ViewMode) => compositionConstraints(geometry(mode)),
  });
}
