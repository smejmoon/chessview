import type { MaterializeMoveInput, MaterializeMoveResult, Move } from './move-materialization.ts';
import type { Route, RouteLedger, ViewMode } from './route-ledger.ts';
import { isObsoleteWork } from './obsolete-work.js';

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
  settling: boolean;
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
  recompose(): Promise<boolean>;
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

export type RefinementTask = Readonly<{
  key: string;
  run(): unknown | Promise<unknown>;
}>;

export type RefinementInput = Readonly<{
  center: string;
  structures: Readonly<Record<ViewMode, unknown | null>>;
  signal: AbortSignal;
}>;

export type LookaheadInput = Readonly<{
  center: string;
  mode: ViewMode;
  structure: unknown;
  signal: AbortSignal;
}>;

type Contributor<Input> = (input: Input) => unknown | Promise<unknown>;
type RefinementPlanner = (input: RefinementInput) => readonly RefinementTask[] | Promise<readonly RefinementTask[]>;
type LookaheadContributor = (input: LookaheadInput) => unknown | Promise<unknown>;
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
  refine?: RefinementPlanner | null;
  lookahead?: LookaheadContributor | null;
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
  settling: boolean;
};

type Run = {
  revision: number;
  abortController: AbortController;
  lookaheadController: AbortController | null;
  structureTails: Record<ViewMode, Promise<boolean>>;
  evidenceTails: Record<ViewMode, Promise<boolean>>;
  railTail: Promise<boolean>;
  refinementKeys: Set<string>;
  settlementDirty: boolean;
  settlementDraining: boolean;
  settlementReady: boolean;
};

type RestoreRoute = {
  center?: unknown;
  view?: unknown;
  mode?: unknown;
  navDepth?: unknown;
};

const MODES: readonly ViewMode[] = Object.freeze(['roots', 'lines']);

function otherMode(mode: ViewMode): ViewMode {
  return mode === 'roots' ? 'lines' : 'roots';
}

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

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => sameValue(value, right[index]));
  }
  if (isPlainRecord(left) || isPlainRecord(right)) {
    if (!isPlainRecord(left) || !isPlainRecord(right)) return false;
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every((key) => Object.hasOwn(right, key) && sameValue(left[key], right[key]));
  }
  return false;
}

function structureSettling(value: unknown): boolean {
  return isPlainRecord(value) && value.settling === true;
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

function tails(): Record<ViewMode, Promise<boolean>> {
  return {
    roots: Promise.resolve(false),
    lines: Promise.resolve(false),
  };
}

export class NodusController {
  #actions: NodusActions;
  #canonicalize: (value: unknown) => string;
  #disposed = false;
  #evidence: Contributor<EvidenceInput> | null;
  #log: Log;
  #lookahead: LookaheadContributor | null;
  #materializeMove: MaterializeMove | null;
  #preferences: Preferences;
  #presenter: Presenter;
  #rail: Contributor<RailInput> | null;
  #refine: RefinementPlanner | null;
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
    refine = null,
    lookahead = null,
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
    this.#refine = refine;
    this.#lookahead = lookahead;
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
      settling: false,
    };
    this.#actions = Object.freeze({
      recenter: (request: RecenterRequest) => this.recenter(request),
      setMode: (mode: ViewMode) => this.setMode(mode),
      flip: () => this.flip(),
      back: () => this.back(),
      refresh: () => this.refresh(),
      recompose: () => this.recompose(),
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
      settling: this.#state.settling,
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
    this.#syncSettlingFromActiveStructure();
    this.#preferences.setView?.(next);
    this.#routeLedger.replace?.(this.#route());
    this.#log('view mode changed', { mode: next, center: this.#state.center });
    await this.#presentCurrent('update');
    const run = this.#run;
    if (this.#isCurrent(run)) this.#refreshLookahead(run, next);
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

  async recompose(): Promise<boolean> {
    if (this.#disposed) return false;
    const run = this.#run;
    if (!this.#isCurrent(run)) return false;
    const activeMode = this.#state.mode;

    this.#state.settling = true;
    await this.#presentCurrent('update');

    await this.#settleProjection(run, activeMode);
    if (!this.#isCurrent(run)) return false;

    this.#syncSettlingFromActiveStructure();
    await this.#presentCurrent('update');

    void this.#settleProjection(run, otherMode(activeMode));
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
    this.#run?.lookaheadController?.abort();
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

  #syncSettlingFromActiveStructure(): void {
    const structure = this.#state.projections[this.#state.mode].structure;
    this.#state.settling = structure.status === 'ready' && structureSettling(structure.value);
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
    this.#run?.lookaheadController?.abort();
    this.#run?.abortController.abort();
    this.#revision += 1;
    const run: Run = {
      revision: this.#revision,
      abortController: new AbortController(),
      lookaheadController: null,
      structureTails: tails(),
      evidenceTails: tails(),
      railTail: Promise.resolve(false),
      refinementKeys: new Set(),
      settlementDirty: false,
      settlementDraining: false,
      settlementReady: false,
    };
    this.#run = run;

    const preserveEstablished = reason === 'refresh';
    if (!preserveEstablished) {
      this.#state.projections = {
        roots: { structure: lifecycle('loading'), evidence: lifecycle('idle') },
        lines: { structure: lifecycle('loading'), evidence: lifecycle('idle') },
      };
      this.#state.rail = typeof this.#rail === 'function' ? lifecycle('loading') : lifecycle('idle');
    }
    this.#state.settling = preserveEstablished;
    this.#log('Nodus view started', { revision: run.revision, center: this.#state.center, mode: this.#state.mode, reason });
    await this.#presentCurrent('start');

    if (typeof this.#rail === 'function') {
      void this.#queueRail(run, { preserveEstablished, publish: true });
    }

    const activeMode = this.#state.mode;
    const activeReady = await this.#queueStructure(run, activeMode, {
      preserveEstablished,
      publish: true,
    });
    if (!this.#isCurrent(run)) return;

    if (activeReady && typeof this.#evidence === 'function') {
      void this.#queueEvidence(run, activeMode, { preserveEstablished, publish: true });
    }

    await this.#planRefinements(run);
    if (!this.#isCurrent(run)) return;
    this.#syncSettlingFromActiveStructure();
    run.settlementReady = true;
    await this.#presentCurrent('update');
    this.#refreshLookahead(run, activeMode);

    void this.#prepareProjection(run, otherMode(activeMode), preserveEstablished);
    if (run.settlementDirty) this.#queueSettlement(run);
  }

  async #prepareProjection(run: Run, mode: ViewMode, preserveEstablished: boolean): Promise<void> {
    if (!this.#isCurrent(run)) return;
    const before = this.snapshot;
    const ready = await this.#queueStructure(run, mode, { preserveEstablished, publish: true });
    if (!this.#isCurrent(run)) return;
    if (ready && typeof this.#evidence === 'function') {
      void this.#queueEvidence(run, mode, { preserveEstablished, publish: true });
    }
    await this.#planRefinements(run);
    if (!this.#isCurrent(run)) return;
    if (this.#isActiveMode(mode)) this.#refreshLookahead(run, mode);
    const after = this.snapshot;
    if (!sameValue(before, after)) await this.#presentCurrent('update');
  }

  #refreshLookahead(run: Run, mode: ViewMode): void {
    run.lookaheadController?.abort();
    run.lookaheadController = null;
    const lookahead = this.#lookahead;
    if (!this.#isCurrent(run) || !this.#isActiveMode(mode) || typeof lookahead !== 'function') return;
    const structure = this.#state.projections[mode].structure;
    if (structure.status !== 'ready') return;

    const controller = new AbortController();
    run.lookaheadController = controller;
    void Promise.resolve(lookahead(Object.freeze({
      center: this.#state.center,
      mode,
      structure: structure.value,
      signal: controller.signal,
    }))).catch((error: unknown) => {
      if (controller.signal.aborted || isObsoleteWork(error, controller.signal) || !this.#isCurrent(run)) return;
      this.#log('supplementary lookahead failed', { mode, error: errorMessage(error) });
    });
  }

  #queueStructure(
    run: Run,
    mode: ViewMode,
    options: { preserveEstablished?: boolean; publish?: boolean } = {},
  ): Promise<boolean> {
    const tail = run.structureTails[mode]
      .catch(() => false)
      .then(() => this.#composeMode(run, mode, options));
    run.structureTails[mode] = tail;
    return tail;
  }

  #queueEvidence(
    run: Run,
    mode: ViewMode,
    options: { preserveEstablished?: boolean; publish?: boolean } = {},
  ): Promise<boolean> {
    const tail = run.evidenceTails[mode]
      .catch(() => false)
      .then(() => this.#deriveEvidence(run, mode, options));
    run.evidenceTails[mode] = tail;
    return tail;
  }

  #queueRail(
    run: Run,
    options: { preserveEstablished?: boolean; publish?: boolean } = {},
  ): Promise<boolean> {
    const tail = run.railTail
      .catch(() => false)
      .then(() => this.#deriveRail(run, options));
    run.railTail = tail;
    return tail;
  }

  async #composeMode(
    run: Run,
    mode: ViewMode,
    { preserveEstablished = false, publish = true }: { preserveEstablished?: boolean; publish?: boolean } = {},
  ): Promise<boolean> {
    if (!this.#isCurrent(run)) return false;
    const projectionState = this.#state.projections[mode];
    const previous = projectionState.structure;
    let value: unknown;
    try {
      value = await this.#structure(Object.freeze({ center: this.#state.center, mode, signal: run.abortController.signal }));
    } catch (structureError: unknown) {
      if (!this.#isCurrent(run) || isObsoleteWork(structureError, run.abortController.signal)) return false;
      if (preserveEstablished && previous.status === 'ready') {
        this.#log('Nodus structure refinement failed; keeping established structure', {
          mode,
          error: errorMessage(structureError),
        });
        return false;
      }
      projectionState.structure = lifecycle('failed', null, structureError);
      projectionState.evidence = lifecycle('idle');
      if (this.#isActiveMode(mode)) this.#syncSettlingFromActiveStructure();
      this.#log('Nodus structure failed', { mode, error: errorMessage(structureError) });
      if (publish && this.#isActiveMode(mode)) await this.#presentCurrent('update');
      return false;
    }
    if (!this.#isCurrent(run)) return false;
    projectionState.structure = lifecycle('ready', value);
    if (this.#isActiveMode(mode)) this.#syncSettlingFromActiveStructure();
    if (publish && this.#isActiveMode(mode)) await this.#presentCurrent('update');
    return true;
  }

  async #deriveEvidence(
    run: Run,
    mode: ViewMode,
    { preserveEstablished = false, publish = true }: { preserveEstablished?: boolean; publish?: boolean } = {},
  ): Promise<boolean> {
    if (!this.#isCurrent(run) || typeof this.#evidence !== 'function') return false;
    const projectionState = this.#state.projections[mode];
    if (projectionState.structure.status !== 'ready') return false;
    const previous = projectionState.evidence;
    try {
      const value = await this.#evidence(Object.freeze({
        center: this.#state.center,
        mode,
        structure: projectionState.structure.value,
        signal: run.abortController.signal,
      }));
      if (!this.#isCurrent(run)) return false;
      projectionState.evidence = lifecycle('ready', value);
      if (publish && this.#isActiveMode(mode)) await this.#presentCurrent('update');
      return true;
    } catch (error: unknown) {
      if (!this.#isCurrent(run) || isObsoleteWork(error, run.abortController.signal)) return false;
      if (preserveEstablished && previous.status === 'ready') {
        this.#log('Nodus evidence refinement failed; keeping established evidence', {
          mode,
          error: errorMessage(error),
        });
        return false;
      }
      projectionState.evidence = lifecycle('failed', null, error);
      this.#log('Nodus evidence failed', { mode, error: errorMessage(error) });
      if (publish && this.#isActiveMode(mode)) await this.#presentCurrent('update');
      return false;
    }
  }

  async #deriveRail(
    run: Run,
    { preserveEstablished = false, publish = true }: { preserveEstablished?: boolean; publish?: boolean } = {},
  ): Promise<boolean> {
    if (!this.#isCurrent(run) || typeof this.#rail !== 'function') return false;
    const previous = this.#state.rail;
    try {
      const value = await this.#rail(Object.freeze({
        center: this.#state.center,
        signal: run.abortController.signal,
      }));
      if (!this.#isCurrent(run)) return false;
      this.#state.rail = lifecycle('ready', value);
      if (publish) await this.#presentCurrent('update');
      return true;
    } catch (error: unknown) {
      if (!this.#isCurrent(run) || isObsoleteWork(error, run.abortController.signal)) return false;
      if (preserveEstablished && previous.status === 'ready') {
        this.#log('Nodus Rail refinement failed; keeping established Rail', error);
        return false;
      }
      this.#state.rail = lifecycle('failed', null, error);
      this.#log('Nodus Rail failed', error);
      if (publish) await this.#presentCurrent('update');
      return false;
    }
  }

  async #planRefinements(run: Run): Promise<void> {
    if (!this.#isCurrent(run) || typeof this.#refine !== 'function') return;
    let tasks: readonly RefinementTask[];
    try {
      tasks = await this.#refine(Object.freeze({
        center: this.#state.center,
        structures: Object.freeze({
          roots: this.#state.projections.roots.structure.status === 'ready'
            ? this.#state.projections.roots.structure.value
            : null,
          lines: this.#state.projections.lines.structure.status === 'ready'
            ? this.#state.projections.lines.structure.value
            : null,
        }),
        signal: run.abortController.signal,
      }));
    } catch (error: unknown) {
      if (!this.#isCurrent(run) || isObsoleteWork(error, run.abortController.signal)) return;
      this.#log('Nodus refinement planning failed', { error: errorMessage(error) });
      return;
    }
    if (!this.#isCurrent(run)) return;

    for (const task of tasks ?? []) {
      if (!task || typeof task.key !== 'string' || !task.key || typeof task.run !== 'function') continue;
      if (run.refinementKeys.has(task.key)) continue;
      run.refinementKeys.add(task.key);

      void Promise.resolve()
        .then(() => task.run())
        .catch((error: unknown) => {
          if (!this.#isCurrent(run) || isObsoleteWork(error, run.abortController.signal)) return;
          this.#log('Nodus refinement unavailable', { key: task.key, error: errorMessage(error) });
        })
        .finally(() => {
          if (!this.#isCurrent(run)) return;
          this.#queueSettlement(run);
        });
    }
  }

  #queueSettlement(run: Run): void {
    if (!this.#isCurrent(run)) return;
    run.settlementDirty = true;
    if (!run.settlementReady || run.settlementDraining) return;
    run.settlementDraining = true;
    void this.#drainSettlement(run).catch((error: unknown) => {
      if (!this.#isCurrent(run)) return;
      this.#log('Nodus settlement failed', { error: errorMessage(error) });
    });
  }

  async #drainSettlement(run: Run): Promise<void> {
    try {
      await Promise.resolve();
      while (this.#isCurrent(run) && run.settlementReady && run.settlementDirty) {
        run.settlementDirty = false;
        await this.#settle(run);
      }
    } finally {
      run.settlementDraining = false;
      if (this.#isCurrent(run) && run.settlementReady && run.settlementDirty) {
        this.#queueSettlement(run);
      }
    }
  }

  async #settle(run: Run): Promise<void> {
    if (!this.#isCurrent(run)) return;
    const activeMode = this.#state.mode;
    const before = this.snapshot;
    const beforeStructure = before.structure.value;

    await this.#queueStructure(run, activeMode, {
      preserveEstablished: true,
      publish: false,
    });
    if (!this.#isCurrent(run)) return;

    const projectionState = this.#state.projections[activeMode];
    const refinements: Promise<boolean>[] = [];
    if (projectionState.structure.status === 'ready' && typeof this.#evidence === 'function') {
      refinements.push(this.#queueEvidence(run, activeMode, {
        preserveEstablished: true,
        publish: false,
      }));
    }
    if (typeof this.#rail === 'function') {
      refinements.push(this.#queueRail(run, {
        preserveEstablished: true,
        publish: false,
      }));
    }
    await Promise.all(refinements);
    if (!this.#isCurrent(run)) return;

    await this.#planRefinements(run);
    if (!this.#isCurrent(run)) return;
    this.#syncSettlingFromActiveStructure();

    const after = this.snapshot;
    if (!sameValue(beforeStructure, after.structure.value)) this.#refreshLookahead(run, this.#state.mode);
    if (!sameValue(before, after)) await this.#presentCurrent('update');

    void this.#settleProjection(run, otherMode(activeMode));
  }

  async #settleProjection(run: Run, mode: ViewMode): Promise<void> {
    if (!this.#isCurrent(run)) return;
    const before = this.snapshot;
    const ready = await this.#queueStructure(run, mode, {
      preserveEstablished: true,
      publish: false,
    });
    if (!this.#isCurrent(run)) return;
    if (ready && typeof this.#evidence === 'function') {
      await this.#queueEvidence(run, mode, {
        preserveEstablished: true,
        publish: false,
      });
    }
    if (!this.#isCurrent(run)) return;
    await this.#planRefinements(run);
    if (!this.#isCurrent(run)) return;
    if (this.#isActiveMode(mode)) {
      this.#syncSettlingFromActiveStructure();
      this.#refreshLookahead(run, mode);
    }
    const after = this.snapshot;
    if (!sameValue(before, after)) await this.#presentCurrent('update');
  }
}
