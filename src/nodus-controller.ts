import type { MaterializeMoveInput, MaterializeMoveResult, Move } from './move-materialization.ts';
import type { Route, RouteLedger, ViewMode } from './route-ledger.ts';

export type Orientation = 'white' | 'black';
export type LifecycleStatus = 'idle' | 'loading' | 'ready' | 'failed';

export type Lifecycle = Readonly<{
  status: LifecycleStatus;
  value: unknown;
  error: string | null;
}>;

export type NodusSnapshot = Readonly<{
  center: string;
  mode: ViewMode;
  orientation: Orientation;
  navigation: Readonly<{ canGoBack: boolean }>;
  structure: Lifecycle;
  evidence: Lifecycle;
  rail: Lifecycle;
}>;

export type RecenterRequest =
  | Readonly<{ target: string; move?: never }>
  | Readonly<{ move: Move; target?: never }>;

export type NodusActions = Readonly<{
  recenter(request: RecenterRequest): Promise<boolean>;
  setMode(mode: ViewMode): Promise<boolean>;
  flip(): Promise<boolean>;
  back(): boolean;
  refresh(): Promise<boolean>;
  redraw(): Promise<boolean>;
}>;

export type StructureInput = Readonly<{
  center: string;
  mode: ViewMode;
  signal: AbortSignal;
}>;

export type EvidenceInput = Readonly<{
  center: string;
  mode: ViewMode;
  structure: unknown;
  signal: AbortSignal;
}>;

export type RailInput = Readonly<{
  center: string;
  signal: AbortSignal;
}>;

export type DiscoveryInput = Readonly<{
  center: string;
  mode: ViewMode;
  structure: unknown;
  signal: AbortSignal;
  onProgress: () => Promise<unknown | null>;
}>;

export type DiscoveryResult = Readonly<{
  error?: unknown;
  criticalFailure?: boolean;
}> | null;

type Contributor<Input> = (input: Input) => unknown | Promise<unknown>;
type DiscoveryContributor = (input: DiscoveryInput) => DiscoveryResult | Promise<DiscoveryResult>;
type MaterializeMove = (input: MaterializeMoveInput) => Promise<MaterializeMoveResult | null>;
type Log = (message: string, detail?: unknown) => void;

type Preferences = {
  setView?(view: ViewMode): void;
  setOrientation?(orientation: Orientation): void;
};

type Presenter = {
  start(view: NodusSnapshot, actions: NodusActions): unknown | Promise<unknown>;
  update(view: NodusSnapshot, actions: NodusActions): unknown | Promise<unknown>;
};

export type NodusControllerOptions = {
  initial?: {
    center?: unknown;
    view?: unknown;
    mode?: unknown;
    orientation?: unknown;
    navDepth?: unknown;
  };
  canonicalize: (value: unknown) => string;
  routeLedger?: Partial<RouteLedger> | null;
  preferences?: Preferences | null;
  structure: Contributor<StructureInput>;
  evidence?: Contributor<EvidenceInput> | null;
  rail?: Contributor<RailInput> | null;
  discover?: DiscoveryContributor | null;
  materializeMove?: MaterializeMove | null;
  presenter: Presenter;
  log?: Log;
};

type ProjectionState = {
  structure: Lifecycle;
  evidence: Lifecycle;
};

type ControllerState = {
  center: string;
  mode: ViewMode;
  orientation: Orientation;
  navDepth: number;
  projections: Record<ViewMode, ProjectionState>;
  rail: Lifecycle;
};

type Run = {
  revision: number;
  abortController: AbortController;
  composeTails: Record<ViewMode, Promise<unknown>>;
  railTail: Promise<unknown>;
};

type RestoreRoute = {
  center?: unknown;
  view?: unknown;
  mode?: unknown;
  navDepth?: unknown;
};

const MODES: readonly ViewMode[] = Object.freeze(['roots', 'lines']);

function normalizeMode(mode: unknown): ViewMode {
  return mode === 'roots' ? 'roots' : 'lines';
}

function normalizeOrientation(orientation: unknown): Orientation {
  return orientation === 'black' ? 'black' : 'white';
}

function normalizeDepth(depth: unknown): number {
  return typeof depth === 'number' && Number.isFinite(depth) && depth >= 0 ? depth : 0;
}

function errorMessage(error: unknown): string | null {
  if (error == null) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(error);
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'name' in error
    && (error as { name?: unknown }).name === 'AbortError';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && Object.getPrototypeOf(value) === Object.prototype;
}

function immutable(value: unknown): unknown {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (isPlainRecord(value)) {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, immutable(child)]),
    ));
  }
  return value;
}

function lifecycle(status: LifecycleStatus, value: unknown = null, error: unknown = null): Lifecycle {
  return Object.freeze({ status, value: immutable(value), error: errorMessage(error) });
}

function projection(): ProjectionState {
  return {
    structure: lifecycle('idle'),
    evidence: lifecycle('idle'),
  };
}

function projections(): Record<ViewMode, ProjectionState> {
  return {
    roots: projection(),
    lines: projection(),
  };
}

export class NodusController {
  #actions: NodusActions;
  #canonicalize: (value: unknown) => string;
  #discover: DiscoveryContributor | null;
  #disposed = false;
  #evidence: Contributor<EvidenceInput> | null;
  #log: Log;
  #materializeMove: MaterializeMove | null;
  #preferences: Preferences;
  #presenter: Presenter;
  #rail: Contributor<RailInput> | null;
  #revision = 0;
  #routeLedger: Partial<RouteLedger>;
  #run: Run | null = null;
  #state: ControllerState;
  #stopRouteRestore: (() => void) | null = null;
  #structure: Contributor<StructureInput>;

  constructor({
    initial,
    canonicalize,
    routeLedger,
    preferences,
    structure,
    evidence = null,
    rail = null,
    discover = null,
    materializeMove = null,
    presenter,
    log = () => {},
  }: NodusControllerOptions) {
    if (typeof canonicalize !== 'function') throw new TypeError('NodusController requires canonicalize');
    if (typeof structure !== 'function') throw new TypeError('NodusController requires structure');
    if (typeof presenter?.start !== 'function' || typeof presenter?.update !== 'function') {
      throw new TypeError('NodusController requires presenter.start and presenter.update');
    }
    this.#canonicalize = canonicalize;
    this.#routeLedger = routeLedger ?? {};
    this.#preferences = preferences ?? {};
    this.#structure = structure;
    this.#evidence = evidence;
    this.#rail = rail;
    this.#discover = discover;
    this.#materializeMove = materializeMove;
    this.#presenter = presenter;
    this.#log = log;
    this.#state = {
      center: canonicalize(initial?.center),
      mode: normalizeMode(initial?.mode ?? initial?.view),
      orientation: normalizeOrientation(initial?.orientation),
      navDepth: normalizeDepth(initial?.navDepth),
      projections: projections(),
      rail: lifecycle('idle'),
    };
    this.#actions = Object.freeze({
      recenter: (request: RecenterRequest) => this.recenter(request),
      setMode: (mode: ViewMode) => this.setMode(mode),
      flip: () => this.flip(),
      back: () => this.back(),
      refresh: () => this.refresh(),
      redraw: () => this.redraw(),
    });
  }

  get snapshot(): NodusSnapshot {
    const active = this.#state.projections[this.#state.mode];
    return Object.freeze({
      center: this.#state.center,
      mode: this.#state.mode,
      orientation: this.#state.orientation,
      navigation: Object.freeze({ canGoBack: this.#state.navDepth > 0 }),
      structure: active.structure,
      evidence: active.evidence,
      rail: this.#state.rail,
    });
  }

  async start(): Promise<boolean> {
    if (this.#disposed) return false;
    if (!this.#stopRouteRestore && typeof this.#routeLedger.onRestore === 'function') {
      this.#stopRouteRestore = this.#routeLedger.onRestore((route: Route) => { void this.restore(route); }) ?? null;
    }
    this.#routeLedger.replace?.(this.#route());
    await this.#startView('start');
    return true;
  }

  async recenter(request: RecenterRequest | null | undefined): Promise<boolean> {
    if (this.#disposed) return false;
    const candidate = request as { target?: unknown; move?: unknown } | null | undefined;
    const hasTarget = candidate?.target != null;
    const hasMove = candidate?.move != null;
    if (hasTarget === hasMove) return false;
    if (hasTarget) return this.#commitRecenter(candidate?.target);
    if (typeof this.#materializeMove !== 'function') return false;

    const run = this.#run;
    const source = this.#state.center;
    const requestedMove = candidate?.move as Partial<Move> | undefined;
    const move = Object.freeze({
      from: requestedMove?.from,
      to: requestedMove?.to,
      promotion: requestedMove?.promotion,
    });

    let result: MaterializeMoveResult | null = null;
    try {
      result = await this.#materializeMove(Object.freeze({ source, move }));
    } catch (error: unknown) {
      if (this.#isCurrent(run) && this.#state.center === source) {
        this.#log('move materialization failed', { source, move, error: errorMessage(error) });
        await this.#presentCurrent('update');
      }
      return false;
    }

    if (!this.#isCurrent(run) || this.#state.center !== source) return false;
    if (!result?.target) {
      await this.#presentCurrent('update');
      return false;
    }
    return this.#commitRecenter(result.target);
  }

  async restore(route: RestoreRoute = {}): Promise<boolean> {
    if (this.#disposed) return false;
    this.#state.center = this.#canonicalize(route.center ?? this.#state.center);
    this.#state.mode = normalizeMode(route.view ?? route.mode ?? this.#state.mode);
    this.#state.navDepth = normalizeDepth(route.navDepth);
    this.#log('history restored', this.#route());
    await this.#startView('restore');
    return true;
  }

  async setMode(mode: ViewMode): Promise<boolean> {
    if (this.#disposed) return false;
    const next = normalizeMode(mode);
    if (next === this.#state.mode) return false;
    this.#state.mode = next;
    this.#preferences.setView?.(next);
    this.#routeLedger.replace?.(this.#route());
    this.#log('view mode changed', { mode: next, center: this.#state.center });
    await this.#presentCurrent('update');
    return true;
  }

  async flip(): Promise<boolean> {
    if (this.#disposed) return false;
    this.#state.orientation = this.#state.orientation === 'white' ? 'black' : 'white';
    this.#preferences.setOrientation?.(this.#state.orientation);
    await this.#presentCurrent('update');
    return true;
  }

  back(): boolean {
    if (this.#disposed || this.#state.navDepth <= 0) return false;
    this.#routeLedger.back?.();
    return true;
  }

  async refresh(): Promise<boolean> {
    if (this.#disposed) return false;
    await this.#startView('refresh');
    return true;
  }

  async redraw(): Promise<boolean> {
    if (this.#disposed) return false;
    await this.#presentCurrent('update');
    return true;
  }

  dispose(): void {
    this.#disposed = true;
    this.#stopRouteRestore?.();
    this.#stopRouteRestore = null;
    this.#run?.abortController.abort();
    this.#run = null;
  }

  #route(): Route {
    return { center: this.#state.center, view: this.#state.mode, navDepth: this.#state.navDepth };
  }

  #isCurrent(run: Run | null): run is Run {
    return Boolean(
      run
      && !this.#disposed
      && this.#run === run
      && run.revision === this.#revision
      && !run.abortController.signal.aborted,
    );
  }

  #isActiveMode(mode: ViewMode): boolean {
    return this.#state.mode === mode;
  }

  async #commitRecenter(position: unknown): Promise<boolean> {
    const next = this.#canonicalize(position);
    if (next === this.#state.center) return false;
    const previous = this.#state.center;
    this.#state.center = next;
    this.#state.navDepth += 1;
    this.#routeLedger.push?.(this.#route());
    this.#log('recenter', { from: previous, to: next, mode: this.#state.mode, navDepth: this.#state.navDepth });
    await this.#startView('recenter');
    return true;
  }

  async #presentCurrent(kind: 'start' | 'update'): Promise<boolean> {
    if (this.#disposed) return false;
    await this.#presenter[kind](this.snapshot, this.#actions);
    return true;
  }

  async #startView(reason: 'start' | 'restore' | 'recenter' | 'refresh'): Promise<void> {
    this.#run?.abortController.abort();
    this.#revision += 1;
    const run: Run = {
      revision: this.#revision,
      abortController: new AbortController(),
      composeTails: { roots: Promise.resolve(), lines: Promise.resolve() },
      railTail: Promise.resolve(),
    };
    this.#run = run;
    this.#state.projections = {
      roots: { structure: lifecycle('loading'), evidence: lifecycle('idle') },
      lines: { structure: lifecycle('loading'), evidence: lifecycle('idle') },
    };
    this.#state.rail = typeof this.#rail === 'function' ? lifecycle('loading') : lifecycle('idle');
    this.#log('Nodus view started', { revision: run.revision, center: this.#state.center, mode: this.#state.mode, reason });
    await this.#presentCurrent('start');

    if (typeof this.#rail === 'function') void this.#queueRail(run);
    const activeMode = this.#state.mode;
    for (const mode of MODES) {
      if (mode !== activeMode) void this.#runProjection(run, mode);
    }
    await this.#runProjection(run, activeMode);
  }

  async #runProjection(run: Run, mode: ViewMode): Promise<boolean> {
    if (!this.#isCurrent(run)) return false;
    const hasDiscovery = mode === 'lines' && typeof this.#discover === 'function';
    const composed = await this.#queueComposition(run, mode, { status: hasDiscovery ? 'loading' : 'ready' });
    if (!composed || !this.#isCurrent(run)) return false;
    if (mode === 'roots' && typeof this.#rail === 'function') void this.#queueRail(run);
    if (hasDiscovery) void this.#runDiscovery(run, mode);
    else void this.#hydrateEvidence(run, mode);
    return true;
  }

  #queueComposition(
    run: Run,
    mode: ViewMode,
    options: { status?: LifecycleStatus; error?: unknown } = {},
  ): Promise<boolean> {
    const tail = run.composeTails[mode]
      .catch(() => false)
      .then(() => this.#composeMode(run, mode, options));
    run.composeTails[mode] = tail;
    return tail;
  }

  #queueRail(run: Run): Promise<boolean> {
    const tail = run.railTail
      .catch(() => false)
      .then(() => this.#hydrateRail(run));
    run.railTail = tail;
    return tail;
  }

  async #composeMode(
    run: Run,
    mode: ViewMode,
    { status = 'ready', error = null }: { status?: LifecycleStatus; error?: unknown } = {},
  ): Promise<boolean> {
    if (!this.#isCurrent(run)) return false;
    let value: unknown;
    try {
      value = await this.#structure(Object.freeze({ center: this.#state.center, mode, signal: run.abortController.signal }));
    } catch (structureError: unknown) {
      if (!this.#isCurrent(run) || isAbortError(structureError)) return false;
      const projectionState = this.#state.projections[mode];
      projectionState.structure = lifecycle('failed', null, structureError);
      projectionState.evidence = lifecycle('idle');
      this.#log('Nodus structure failed', { mode, error: errorMessage(structureError) });
      if (this.#isActiveMode(mode)) await this.#presentCurrent('update');
      return false;
    }
    if (!this.#isCurrent(run)) return false;
    this.#state.projections[mode].structure = lifecycle(status, value, error);
    if (this.#isActiveMode(mode)) await this.#presentCurrent('update');
    return true;
  }

  async #runDiscovery(run: Run, mode: ViewMode): Promise<void> {
    if (!this.#isCurrent(run) || typeof this.#discover !== 'function') return;
    let result: DiscoveryResult = null;
    try {
      result = await this.#discover(Object.freeze({
        center: this.#state.center,
        mode,
        structure: this.#state.projections[mode].structure.value,
        signal: run.abortController.signal,
        onProgress: async () => {
          if (!this.#isCurrent(run)) return null;
          const composed = await this.#queueComposition(run, mode, { status: 'loading' });
          return composed && this.#isCurrent(run)
            ? this.#state.projections[mode].structure.value
            : null;
        },
      }));
    } catch (error: unknown) {
      if (!this.#isCurrent(run) || isAbortError(error)) return;
      result = { error, criticalFailure: true };
    }
    if (!this.#isCurrent(run)) return;

    const status: LifecycleStatus = result?.criticalFailure ? 'failed' : 'ready';
    const composed = await this.#queueComposition(run, mode, { status, error: result?.error ?? null });
    if (!composed || !this.#isCurrent(run)) return;
    if (status === 'ready') void this.#hydrateEvidence(run, mode);
  }

  async #hydrateEvidence(run: Run, mode: ViewMode): Promise<void> {
    if (!this.#isCurrent(run) || typeof this.#evidence !== 'function') return;
    const projectionState = this.#state.projections[mode];
    projectionState.evidence = lifecycle('loading');
    if (this.#isActiveMode(mode)) await this.#presentCurrent('update');
    let value: unknown;
    try {
      value = await this.#evidence(Object.freeze({
        center: this.#state.center,
        mode,
        structure: projectionState.structure.value,
        signal: run.abortController.signal,
      }));
    } catch (error: unknown) {
      if (!this.#isCurrent(run) || isAbortError(error)) return;
      projectionState.evidence = lifecycle('failed', null, error);
      this.#log('Nodus evidence failed', { mode, error: errorMessage(error) });
      if (this.#isActiveMode(mode)) await this.#presentCurrent('update');
      return;
    }
    if (!this.#isCurrent(run)) return;
    projectionState.evidence = lifecycle('ready', value);
    if (this.#isActiveMode(mode)) await this.#presentCurrent('update');
  }

  async #hydrateRail(run: Run): Promise<boolean> {
    if (!this.#isCurrent(run) || typeof this.#rail !== 'function') return false;
    let value: unknown;
    try {
      value = await this.#rail(Object.freeze({
        center: this.#state.center,
        signal: run.abortController.signal,
      }));
    } catch (error: unknown) {
      if (!this.#isCurrent(run) || isAbortError(error)) return false;
      this.#state.rail = lifecycle('failed', null, error);
      this.#log('Nodus Rail failed', error);
      await this.#presentCurrent('update');
      return false;
    }
    if (!this.#isCurrent(run)) return false;
    this.#state.rail = lifecycle('ready', value);
    await this.#presentCurrent('update');
    return true;
  }
}
