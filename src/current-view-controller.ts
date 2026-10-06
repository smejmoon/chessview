import type { Lens, Orientation } from './lens.ts';
import type { MaterializeMoveInput, MaterializeMoveResult, Move } from './move-materialization.ts';
import { isObsoleteWork } from './obsolete-work.js';
import type { Route, RouteLedger, ViewMode } from './route-ledger.ts';

export type { Orientation } from './lens.ts';
export type LifecycleStatus = 'idle' | 'loading' | 'ready' | 'failed';
export type RefinementPriority = 'foreground' | 'background';
export type RefinementPhase = 'working' | 'retry-waiting' | 'satisfied' | 'unavailable' | 'failed';
export type RefinementPurpose = 'root-discovery';
export type RefinementActivityPhase = RefinementPhase | 'idle';

export type Lifecycle = Readonly<{
  status: LifecycleStatus;
  value: unknown;
  error: string | null;
}>;

export type WeatherStructuralMeasures = Readonly<{
  working: number;
  retryWaiting: number;
  satisfied: number;
  incorporationPending: number;
  unavailable: number;
  failed: number;
  unplanned: number;
  detached: number;
}>;

export type WeatherMeasures = Readonly<{
  structure: LifecycleStatus;
  frontier: number;
  structural: WeatherStructuralMeasures;
  supplementary: Readonly<{
    active: number;
    total: number;
  }>;
}>;

export type CurrentViewSnapshot = Readonly<{
  center: string;
  mode: ViewMode;
  orientation: Orientation;
  navigation: Readonly<{ canGoBack: boolean }>;
  structure: Lifecycle;
  evidence: Lifecycle;
  rail: Lifecycle;
  settling: boolean;
  weather: WeatherMeasures;
  activities: Readonly<{
    rootDiscovery: RefinementActivityPhase;
  }>;
}>;

export type RecenterRequest =
  | Readonly<{ target: string; move?: never }>
  | Readonly<{ move: Move; target?: never }>;

export type CurrentViewActions = Readonly<{
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

export type RefinementTaskInput = Readonly<{
  signal: AbortSignal;
  priority: () => RefinementPriority;
}>;

export type RefinementOutcome =
  | Readonly<{ refinement: 'satisfied' }>
  | Readonly<{ refinement: 'unavailable' }>
  | Readonly<{ refinement: 'retryable'; retry: PromiseLike<unknown> }>;

export type RefinementTask = Readonly<{
  key: string;
  purpose?: RefinementPurpose;
  modes?: readonly ViewMode[];
  nodusWide?: boolean;
  structuralReading?: string | null;
  run(input: RefinementTaskInput): unknown | Promise<unknown>;
}>;

export type RefinementInput = Readonly<{
  center: string;
  mode: ViewMode;
  structure: unknown | null;
  signal: AbortSignal;
}>;

export type LookaheadInput = Readonly<{
  center: string;
  mode: ViewMode;
  structure: unknown;
  signal: AbortSignal;
}>;

type Contributor<Input> = (input: Input) => unknown | Promise<unknown>;
type RefinementPlanner = (input: RefinementInput) => readonly RefinementTask[];
type LookaheadContributor = (input: LookaheadInput) => unknown | Promise<unknown>;
type MaterializeMove = (input: MaterializeMoveInput) => Promise<MaterializeMoveResult | null>;
type Log = (message: string, detail?: unknown) => void;
type OrientationLens = Pick<Lens, 'orientation' | 'flipOrientation'>;

type Preferences = {
  setView?(view: ViewMode): void;
};

type Presenter = {
  start(view: CurrentViewSnapshot, actions: CurrentViewActions): unknown | Promise<unknown>;
  update(view: CurrentViewSnapshot, actions: CurrentViewActions): unknown | Promise<unknown>;
};

export type CurrentViewControllerOptions = {
  initial?: {
    center?: unknown;
    view?: unknown;
    mode?: unknown;
    orientation?: unknown;
  };
  canonicalize: (value: unknown) => string;
  routeLedger?: Partial<RouteLedger> | null;
  preferences?: Preferences | null;
  lens?: OrientationLens | null;
  structure: Contributor<StructureInput>;
  evidence?: Contributor<EvidenceInput> | null;
  rail?: Contributor<RailInput> | null;
  refine?: RefinementPlanner | null;
  lookahead?: LookaheadContributor | null;
  materializeMove?: MaterializeMove | null;
  presenter: Presenter;
  log?: Log;
};

type AcceptedViewState = {
  nodus: string;
  mode: ViewMode;
  structure: Lifecycle;
  evidence: Lifecycle;
  rail: Lifecycle;
};

type RefinementParticipant = {
  key: string;
  task: RefinementTask;
  purpose: RefinementPurpose | null;
  modes: readonly ViewMode[];
  nodusWide: boolean;
  structuralReading: string | null;
  phase: RefinementPhase;
  controller: AbortController | null;
  retryToken: number;
};

type RefinementRun = {
  revision: number;
  abortController: AbortController;
  lookaheadController: AbortController | null;
  structureTail: Promise<boolean>;
  evidenceTail: Promise<boolean>;
  railTail: Promise<boolean>;
  participants: Map<string, RefinementParticipant>;
  incorporationPending: Set<string>;
  settlementDirty: boolean;
  settlementDraining: boolean;
  settlementReady: boolean;
};

type RestoreRoute = {
  center?: unknown;
  view?: unknown;
  mode?: unknown;
};

function normalizeMode(mode: unknown): ViewMode {
  return mode === 'roots' ? 'roots' : 'lines';
}

function normalizeOrientation(orientation: unknown): Orientation {
  return orientation === 'black' ? 'black' : 'white';
}

function localLens(initialOrientation: unknown): OrientationLens {
  let orientation = normalizeOrientation(initialOrientation);
  return Object.freeze({
    orientation: () => orientation,
    flipOrientation: () => {
      orientation = orientation === 'white' ? 'black' : 'white';
      return orientation;
    },
  });
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

function lifecycle(status: LifecycleStatus, value: unknown = null, error: unknown = null): Lifecycle {
  return Object.freeze({ status, value: immutable(value), error: errorMessage(error) });
}

function readingFrontier(value: unknown): readonly string[] {
  if (!isPlainRecord(value) || !Array.isArray(value.readingFrontier)) return Object.freeze([]);
  return Object.freeze(value.readingFrontier.filter((position): position is string => typeof position === 'string'));
}

function refinementOutcome(value: unknown): RefinementOutcome | null {
  if (!isPlainRecord(value)) return null;
  if (value.refinement === 'satisfied') return value as RefinementOutcome;
  if (value.refinement === 'unavailable') return value as RefinementOutcome;
  if (value.refinement === 'retryable' && value.retry && typeof (value.retry as PromiseLike<unknown>).then === 'function') {
    return value as RefinementOutcome;
  }
  return null;
}

export const refinementSatisfied: RefinementOutcome = Object.freeze({ refinement: 'satisfied' });
export const refinementUnavailable: RefinementOutcome = Object.freeze({ refinement: 'unavailable' });

export function refinementRetryable(retry: PromiseLike<unknown>): RefinementOutcome {
  return Object.freeze({ refinement: 'retryable', retry });
}

export class CurrentViewController {
  #actions: CurrentViewActions;
  #canonicalize: (value: unknown) => string;
  #disposed = false;
  #evidence: Contributor<EvidenceInput> | null;
  #lens: OrientationLens;
  #log: Log;
  #lookahead: LookaheadContributor | null;
  #materializeMove: MaterializeMove | null;
  #preferences: Preferences;
  #presenter: Presenter;
  #rail: Contributor<RailInput> | null;
  #refine: RefinementPlanner | null;
  #revision = 0;
  #routeLedger: Partial<RouteLedger>;
  #run: RefinementRun | null = null;
  #state: AcceptedViewState;
  #stopRouteRestore: (() => void) | null = null;
  #structure: Contributor<StructureInput>;

  constructor({
    initial,
    canonicalize,
    routeLedger,
    preferences,
    lens,
    structure,
    evidence = null,
    rail = null,
    refine = null,
    lookahead = null,
    materializeMove = null,
    presenter,
    log = () => {},
  }: CurrentViewControllerOptions) {
    if (typeof canonicalize !== 'function') throw new TypeError('CurrentViewController requires canonicalize');
    if (typeof structure !== 'function') throw new TypeError('CurrentViewController requires structure');
    if (typeof presenter?.start !== 'function' || typeof presenter?.update !== 'function') {
      throw new TypeError('CurrentViewController requires presenter.start and presenter.update');
    }
    this.#canonicalize = canonicalize;
    this.#routeLedger = routeLedger ?? {};
    this.#preferences = preferences ?? {};
    this.#lens = lens ?? localLens(initial?.orientation);
    this.#structure = structure;
    this.#evidence = evidence;
    this.#rail = rail;
    this.#refine = refine;
    this.#lookahead = lookahead;
    this.#materializeMove = materializeMove;
    this.#presenter = presenter;
    this.#log = log;
    this.#state = {
      nodus: canonicalize(initial?.center),
      mode: normalizeMode(initial?.mode ?? initial?.view),
      structure: lifecycle('idle'),
      evidence: lifecycle('idle'),
      rail: lifecycle('idle'),
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

  get snapshot(): CurrentViewSnapshot {
    const weather = this.#weatherMeasures();
    return Object.freeze({
      center: this.#state.nodus,
      mode: this.#state.mode,
      orientation: this.#lens.orientation(),
      navigation: Object.freeze({ canGoBack: this.#routeLedger.canGoBack?.() ?? false }),
      structure: this.#state.structure,
      evidence: this.#state.evidence,
      rail: this.#state.rail,
      settling: this.#structurallySettling(weather),
      weather,
      activities: Object.freeze({
        rootDiscovery: this.#activityPhase('root-discovery'),
      }),
    });
  }

  async start(): Promise<boolean> {
    if (this.#disposed) return false;
    if (!this.#stopRouteRestore && typeof this.#routeLedger.onRestore === 'function') {
      this.#stopRouteRestore = this.#routeLedger.onRestore((route: Route) => { void this.restore(route); }) ?? null;
    }
    this.#routeLedger.replace?.(this.#route());
    await this.#startRun('start');
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
    const source = this.#state.nodus;
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
      if (this.#isCurrent(run) && this.#state.nodus === source) {
        this.#log('move materialization failed', { source, move, error: errorMessage(error) });
        await this.#presentCurrent('update');
      }
      return false;
    }

    if (!this.#isCurrent(run) || this.#state.nodus !== source) return false;
    if (!result?.target) {
      await this.#presentCurrent('update');
      return false;
    }
    return this.#commitRecenter(result.target);
  }

  async restore(route: RestoreRoute = {}): Promise<boolean> {
    if (this.#disposed) return false;
    const previousNodus = this.#state.nodus;
    const previousMode = this.#state.mode;
    const nextNodus = this.#canonicalize(route.center ?? previousNodus);
    const nextMode = normalizeMode(route.view ?? route.mode ?? previousMode);
    const sameNodus = nextNodus === previousNodus;
    const sameProjection = sameNodus && nextMode === previousMode;
    this.#state.nodus = nextNodus;
    this.#state.mode = nextMode;
    this.#log('history restored', this.#route());
    await this.#startRun('restore', {
      preserveEstablished: sameProjection,
      preserveRail: sameNodus,
    });
    return true;
  }

  async setMode(mode: ViewMode): Promise<boolean> {
    if (this.#disposed) return false;
    const next = normalizeMode(mode);
    if (next === this.#state.mode) return false;
    const run = this.#run;
    if (!this.#isCurrent(run)) return false;

    run.lookaheadController?.abort();
    run.lookaheadController = null;
    this.#state.mode = next;
    this.#state.structure = lifecycle('loading');
    this.#state.evidence = lifecycle('idle');
    this.#preferences.setView?.(next);
    this.#routeLedger.replace?.(this.#route());
    this.#log('view mode changed', { mode: next, center: this.#state.nodus });
    await this.#presentCurrent('update');
    await this.#settleProjection(run, { preserveEstablished: false, publish: true });
    return this.#isCurrent(run);
  }

  async flip(): Promise<boolean> {
    if (this.#disposed) return false;
    this.#lens.flipOrientation();
    await this.#presentCurrent('update');
    return true;
  }

  back(): boolean {
    if (this.#disposed) return false;
    return this.#routeLedger.back?.() ?? false;
  }

  async refresh(): Promise<boolean> {
    if (this.#disposed) return false;
    await this.#startRun('refresh');
    return true;
  }

  async recompose(): Promise<boolean> {
    if (this.#disposed) return false;
    const run = this.#run;
    if (!this.#isCurrent(run)) return false;
    await this.#settleProjection(run, { preserveEstablished: true, publish: true });
    return this.#isCurrent(run);
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
    this.#disposeRun(this.#run);
    this.#run = null;
  }

  #route(): Route {
    return { center: this.#state.nodus, view: this.#state.mode };
  }

  #isCurrent(run: RefinementRun | null): run is RefinementRun {
    return Boolean(
      run
      && !this.#disposed
      && this.#run === run
      && run.revision === this.#revision
      && !run.abortController.signal.aborted,
    );
  }

  #weatherMeasures(): WeatherMeasures {
    const frontier = readingFrontier(this.#state.structure.value);
    const frontierSet = new Set(frontier);
    const structural = {
      working: 0,
      retryWaiting: 0,
      satisfied: 0,
      incorporationPending: 0,
      unavailable: 0,
      failed: 0,
      unplanned: 0,
      detached: 0,
    };
    const byReading = new Map<string, RefinementParticipant>();
    let supplementaryActive = 0;
    let supplementaryTotal = 0;
    const run = this.#run;

    if (run) {
      for (const participant of run.participants.values()) {
        const reading = participant.structuralReading;
        if (reading == null) {
          supplementaryTotal += 1;
          if (participant.phase === 'working' || participant.phase === 'retry-waiting') {
            supplementaryActive += 1;
          }
          continue;
        }
        if (!frontierSet.has(reading)) {
          structural.detached += 1;
          continue;
        }
        if (!byReading.has(reading)) byReading.set(reading, participant);
      }
    }

    for (const position of frontier) {
      const participant = byReading.get(position);
      if (!participant) {
        structural.unplanned += 1;
        continue;
      }
      if (participant.phase === 'working') structural.working += 1;
      else if (participant.phase === 'retry-waiting') structural.retryWaiting += 1;
      else if (participant.phase === 'satisfied') {
        structural.satisfied += 1;
        if (run?.incorporationPending.has(participant.key)) structural.incorporationPending += 1;
      } else if (participant.phase === 'unavailable') structural.unavailable += 1;
      else structural.failed += 1;
    }

    return Object.freeze({
      structure: this.#state.structure.status,
      frontier: frontier.length,
      structural: Object.freeze(structural),
      supplementary: Object.freeze({
        active: supplementaryActive,
        total: supplementaryTotal,
      }),
    });
  }

  #structurallySettling(weather: WeatherMeasures = this.#weatherMeasures()): boolean {
    if (weather.structure !== 'ready' || weather.frontier === 0) return false;
    const structural = weather.structural;
    return structural.working > 0
      || structural.retryWaiting > 0
      || structural.incorporationPending > 0;
  }

  async #commitRecenter(position: unknown): Promise<boolean> {
    const next = this.#canonicalize(position);
    if (next === this.#state.nodus) return false;
    const previous = this.#state.nodus;
    this.#state.nodus = next;
    this.#routeLedger.push?.(this.#route());
    this.#log('recenter', { from: previous, to: next, mode: this.#state.mode });
    await this.#startRun('recenter');
    return true;
  }

  async #presentCurrent(kind: 'start' | 'update'): Promise<boolean> {
    if (this.#disposed) return false;
    await this.#presenter[kind](this.snapshot, this.#actions);
    return true;
  }

  #disposeRun(run: RefinementRun | null): void {
    if (!run) return;
    run.lookaheadController?.abort();
    run.abortController.abort();
    for (const participant of run.participants.values()) participant.controller?.abort();
    run.participants.clear();
    run.incorporationPending.clear();
  }

  async #startRun(
    reason: 'start' | 'restore' | 'recenter' | 'refresh',
    options: { preserveEstablished?: boolean; preserveRail?: boolean } = {},
  ): Promise<void> {
    this.#disposeRun(this.#run);
    this.#revision += 1;
    const run: RefinementRun = {
      revision: this.#revision,
      abortController: new AbortController(),
      lookaheadController: null,
      structureTail: Promise.resolve(false),
      evidenceTail: Promise.resolve(false),
      railTail: Promise.resolve(false),
      participants: new Map(),
      incorporationPending: new Set(),
      settlementDirty: false,
      settlementDraining: false,
      settlementReady: false,
    };
    this.#run = run;

    const preserveEstablished = (options.preserveEstablished ?? reason === 'refresh')
      && this.#state.structure.status === 'ready';
    const preserveRail = (options.preserveRail ?? reason === 'refresh')
      && this.#state.rail.status === 'ready';
    if (!preserveEstablished) {
      this.#state.structure = lifecycle('loading');
      this.#state.evidence = lifecycle('idle');
    }
    if (!preserveRail) {
      this.#state.rail = typeof this.#rail === 'function' ? lifecycle('loading') : lifecycle('idle');
    }
    this.#log('Current View refinement run started', {
      revision: run.revision,
      center: this.#state.nodus,
      mode: this.#state.mode,
      reason,
    });
    if (preserveEstablished) this.#planRefinements(run);
    await this.#presentCurrent('start');

    if (typeof this.#rail === 'function') {
      void this.#queueRail(run, { preserveEstablished: preserveRail, publish: true });
    }

    const ready = await this.#queueStructure(run, { preserveEstablished, publish: false });
    if (!this.#isCurrent(run)) return;

    this.#planRefinements(run);
    if (!this.#isCurrent(run)) return;

    if (ready && typeof this.#evidence === 'function') {
      void this.#queueEvidence(run, { preserveEstablished, publish: true });
    }

    run.settlementReady = true;
    await this.#presentCurrent('update');
    this.#refreshLookahead(run);
    if (run.settlementDirty) this.#queueSettlement(run);
  }

  #refreshLookahead(run: RefinementRun): void {
    run.lookaheadController?.abort();
    run.lookaheadController = null;
    const lookahead = this.#lookahead;
    if (!this.#isCurrent(run) || typeof lookahead !== 'function') return;
    if (this.#state.structure.status !== 'ready') return;

    const center = this.#state.nodus;
    const mode = this.#state.mode;
    const controller = new AbortController();
    run.lookaheadController = controller;
    void Promise.resolve(lookahead(Object.freeze({
      center,
      mode,
      structure: this.#state.structure.value,
      signal: controller.signal,
    }))).catch((error: unknown) => {
      if (controller.signal.aborted || isObsoleteWork(error, controller.signal) || !this.#isCurrent(run)) return;
      this.#log('supplementary lookahead failed', { mode, error: errorMessage(error) });
    });
  }

  #queueStructure(
    run: RefinementRun,
    options: { preserveEstablished?: boolean; publish?: boolean } = {},
  ): Promise<boolean> {
    const tail = run.structureTail
      .catch(() => false)
      .then(() => this.#composeCurrent(run, options));
    run.structureTail = tail;
    return tail;
  }

  #queueEvidence(
    run: RefinementRun,
    options: { preserveEstablished?: boolean; publish?: boolean } = {},
  ): Promise<boolean> {
    const tail = run.evidenceTail
      .catch(() => false)
      .then(() => this.#deriveEvidence(run, options));
    run.evidenceTail = tail;
    return tail;
  }

  #queueRail(
    run: RefinementRun,
    options: { preserveEstablished?: boolean; publish?: boolean } = {},
  ): Promise<boolean> {
    const tail = run.railTail
      .catch(() => false)
      .then(() => this.#deriveRail(run, options));
    run.railTail = tail;
    return tail;
  }

  async #composeCurrent(
    run: RefinementRun,
    { preserveEstablished = false, publish = true }: { preserveEstablished?: boolean; publish?: boolean } = {},
  ): Promise<boolean> {
    if (!this.#isCurrent(run)) return false;
    const center = this.#state.nodus;
    const mode = this.#state.mode;
    const previous = this.#state.structure;
    let value: unknown;
    try {
      value = await this.#structure(Object.freeze({ center, mode, signal: run.abortController.signal }));
    } catch (structureError: unknown) {
      if (!this.#isCurrent(run) || isObsoleteWork(structureError, run.abortController.signal)) return false;
      if (this.#state.nodus !== center || this.#state.mode !== mode) return false;
      if (preserveEstablished && previous.status === 'ready') {
        this.#log('Current View structure refinement failed; keeping established structure', {
          mode,
          error: errorMessage(structureError),
        });
        return false;
      }
      this.#state.structure = lifecycle('failed', null, structureError);
      this.#state.evidence = lifecycle('idle');
      this.#log('Current View structure failed', { mode, error: errorMessage(structureError) });
      if (publish) await this.#presentCurrent('update');
      return false;
    }
    if (!this.#isCurrent(run) || this.#state.nodus !== center || this.#state.mode !== mode) return false;
    this.#state.structure = lifecycle('ready', value);
    if (publish) await this.#presentCurrent('update');
    return true;
  }

  async #deriveEvidence(
    run: RefinementRun,
    { preserveEstablished = false, publish = true }: { preserveEstablished?: boolean; publish?: boolean } = {},
  ): Promise<boolean> {
    if (!this.#isCurrent(run) || typeof this.#evidence !== 'function') return false;
    if (this.#state.structure.status !== 'ready') return false;
    const center = this.#state.nodus;
    const mode = this.#state.mode;
    const structure = this.#state.structure.value;
    const previous = this.#state.evidence;
    try {
      const value = await this.#evidence(Object.freeze({
        center,
        mode,
        structure,
        signal: run.abortController.signal,
      }));
      if (!this.#isCurrent(run) || this.#state.nodus !== center || this.#state.mode !== mode) return false;
      this.#state.evidence = lifecycle('ready', value);
      if (publish) await this.#presentCurrent('update');
      return true;
    } catch (error: unknown) {
      if (!this.#isCurrent(run) || isObsoleteWork(error, run.abortController.signal)) return false;
      if (this.#state.nodus !== center || this.#state.mode !== mode) return false;
      if (preserveEstablished && previous.status === 'ready') {
        this.#log('Current View evidence refinement failed; keeping established evidence', {
          mode,
          error: errorMessage(error),
        });
        return false;
      }
      this.#state.evidence = lifecycle('failed', null, error);
      this.#log('Current View evidence failed', { mode, error: errorMessage(error) });
      if (publish) await this.#presentCurrent('update');
      return false;
    }
  }

  async #deriveRail(
    run: RefinementRun,
    { preserveEstablished = false, publish = true }: { preserveEstablished?: boolean; publish?: boolean } = {},
  ): Promise<boolean> {
    if (!this.#isCurrent(run) || typeof this.#rail !== 'function') return false;
    const center = this.#state.nodus;
    const previous = this.#state.rail;
    try {
      const value = await this.#rail(Object.freeze({ center, signal: run.abortController.signal }));
      if (!this.#isCurrent(run) || this.#state.nodus !== center) return false;
      this.#state.rail = lifecycle('ready', value);
      if (publish) await this.#presentCurrent('update');
      return true;
    } catch (error: unknown) {
      if (!this.#isCurrent(run) || isObsoleteWork(error, run.abortController.signal)) return false;
      if (this.#state.nodus !== center) return false;
      if (preserveEstablished && previous.status === 'ready') {
        this.#log('Current View Rail refinement failed; keeping established Rail', error);
        return false;
      }
      this.#state.rail = lifecycle('failed', null, error);
      this.#log('Current View Rail failed', error);
      if (publish) await this.#presentCurrent('update');
      return false;
    }
  }

  #planRefinements(run: RefinementRun): void {
    if (!this.#isCurrent(run)) return;
    if (typeof this.#refine !== 'function') {
      this.#reconcileParticipants(run, []);
      return;
    }
    let tasks: readonly RefinementTask[];
    try {
      tasks = this.#refine(Object.freeze({
        center: this.#state.nodus,
        mode: this.#state.mode,
        structure: this.#state.structure.status === 'ready' ? this.#state.structure.value : null,
        signal: run.abortController.signal,
      }));
    } catch (error: unknown) {
      if (!this.#isCurrent(run) || isObsoleteWork(error, run.abortController.signal)) return;
      this.#log('Current View refinement planning failed', { error: errorMessage(error) });
      return;
    }
    if (!this.#isCurrent(run)) return;
    this.#reconcileParticipants(run, tasks ?? []);
  }

  #reconcileParticipants(run: RefinementRun, tasks: readonly RefinementTask[]): void {
    if (!this.#isCurrent(run)) return;
    const planned = new Map<string, RefinementTask>();
    for (const task of tasks) {
      if (!task || typeof task.key !== 'string' || !task.key || typeof task.run !== 'function') continue;
      if (!planned.has(task.key)) planned.set(task.key, task);
    }

    for (const [key, participant] of run.participants) {
      if (planned.has(key)) continue;
      participant.retryToken += 1;
      participant.controller?.abort();
      run.incorporationPending.delete(key);
      run.participants.delete(key);
    }

    for (const [key, task] of planned) {
      const modes = Object.freeze([...(task.modes ?? [])]);
      const structuralReading = typeof task.structuralReading === 'string' ? task.structuralReading : null;
      const existing = run.participants.get(key);
      if (!existing) {
        const participant: RefinementParticipant = {
          key,
          task,
          purpose: task.purpose ?? null,
          modes,
          nodusWide: task.nodusWide === true,
          structuralReading,
          phase: 'working',
          controller: null,
          retryToken: 0,
        };
        run.participants.set(key, participant);
        this.#startParticipant(run, participant);
        continue;
      }

      const priorStructuralReading = existing.structuralReading;
      existing.task = task;
      existing.purpose = task.purpose ?? null;
      existing.modes = modes;
      existing.nodusWide = task.nodusWide === true;
      existing.structuralReading = structuralReading;
      if (priorStructuralReading !== structuralReading) run.incorporationPending.delete(key);

      if (existing.phase === 'unavailable' && priorStructuralReading == null && structuralReading != null) {
        existing.phase = 'working';
        this.#startParticipant(run, existing);
      }
    }
  }

  #activityPhase(purpose: RefinementPurpose): RefinementActivityPhase {
    const run = this.#run;
    if (!run) return 'idle';
    for (const participant of run.participants.values()) {
      if (participant.purpose === purpose) return participant.phase;
    }
    return 'idle';
  }

  #participantPriority(participant: RefinementParticipant): RefinementPriority {
    return participant.nodusWide || participant.modes.includes(this.#state.mode) ? 'foreground' : 'background';
  }

  #startParticipant(run: RefinementRun, participant: RefinementParticipant): void {
    if (!this.#isCurrent(run) || run.participants.get(participant.key) !== participant) return;
    participant.controller?.abort();
    run.incorporationPending.delete(participant.key);
    const controller = new AbortController();
    participant.controller = controller;
    participant.phase = 'working';
    const attempt = participant.retryToken + 1;
    participant.retryToken = attempt;

    void Promise.resolve()
      .then(() => participant.task.run(Object.freeze({
        signal: controller.signal,
        priority: () => this.#participantPriority(participant),
      })))
      .then((value) => {
        if (!this.#participantCurrent(run, participant, controller, attempt)) return;
        participant.controller = null;
        const outcome = refinementOutcome(value);
        if (outcome?.refinement === 'retryable') {
          participant.phase = 'retry-waiting';
          run.incorporationPending.delete(participant.key);
          this.#waitForRetry(run, participant, attempt, outcome.retry);
          this.#queueSettlement(run);
          return;
        }
        participant.phase = outcome?.refinement === 'unavailable' ? 'unavailable' : 'satisfied';
        if (participant.phase === 'satisfied' && participant.structuralReading != null) {
          run.incorporationPending.add(participant.key);
        } else {
          run.incorporationPending.delete(participant.key);
        }
        this.#queueSettlement(run);
      })
      .catch((error: unknown) => {
        if (!this.#participantCurrent(run, participant, controller, attempt)) return;
        if (controller.signal.aborted || isObsoleteWork(error, controller.signal)) return;
        participant.controller = null;
        participant.phase = 'failed';
        run.incorporationPending.delete(participant.key);
        this.#log('Current View refinement failed', { key: participant.key, error: errorMessage(error) });
        this.#queueSettlement(run);
      });
  }

  #participantCurrent(
    run: RefinementRun,
    participant: RefinementParticipant,
    controller: AbortController,
    attempt: number,
  ): boolean {
    return Boolean(
      this.#isCurrent(run)
      && run.participants.get(participant.key) === participant
      && participant.controller === controller
      && participant.retryToken === attempt,
    );
  }

  #waitForRetry(
    run: RefinementRun,
    participant: RefinementParticipant,
    attempt: number,
    retry: PromiseLike<unknown>,
  ): void {
    void Promise.resolve(retry)
      .then(() => {
        if (!this.#isCurrent(run)) return;
        if (run.participants.get(participant.key) !== participant) return;
        if (participant.phase !== 'retry-waiting' || participant.retryToken !== attempt) return;
        this.#startParticipant(run, participant);
      })
      .catch((error: unknown) => {
        if (!this.#isCurrent(run)) return;
        if (run.participants.get(participant.key) !== participant) return;
        if (participant.phase !== 'retry-waiting' || participant.retryToken !== attempt) return;
        participant.phase = 'failed';
        run.incorporationPending.delete(participant.key);
        this.#log('Current View refinement retry gate failed', {
          key: participant.key,
          error: errorMessage(error),
        });
        this.#queueSettlement(run);
      });
  }

  #queueSettlement(run: RefinementRun): void {
    if (!this.#isCurrent(run)) return;
    run.settlementDirty = true;
    if (!run.settlementReady || run.settlementDraining) return;
    run.settlementDraining = true;
    void this.#drainSettlement(run).catch((error: unknown) => {
      if (!this.#isCurrent(run)) return;
      this.#log('Current View settlement failed', { error: errorMessage(error) });
    });
  }

  async #drainSettlement(run: RefinementRun): Promise<void> {
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

  async #settle(run: RefinementRun): Promise<void> {
    if (!this.#isCurrent(run)) return;
    const before = this.snapshot;
    const beforeStructure = before.structure.value;
    const pendingIncorporation = [...run.incorporationPending]
      .map((key) => {
        const participant = run.participants.get(key);
        return participant ? Object.freeze({ key, retryToken: participant.retryToken }) : null;
      })
      .filter((item): item is Readonly<{ key: string; retryToken: number }> => item != null);

    await this.#queueStructure(run, { preserveEstablished: true, publish: false });
    if (!this.#isCurrent(run)) return;

    for (const pending of pendingIncorporation) {
      const participant = run.participants.get(pending.key);
      if (participant?.phase === 'satisfied' && participant.retryToken === pending.retryToken) {
        run.incorporationPending.delete(pending.key);
      }
    }

    const refinements: Promise<boolean>[] = [];
    if (this.#state.structure.status === 'ready' && typeof this.#evidence === 'function') {
      refinements.push(this.#queueEvidence(run, { preserveEstablished: true, publish: false }));
    }
    if (typeof this.#rail === 'function') {
      refinements.push(this.#queueRail(run, { preserveEstablished: true, publish: false }));
    }
    await Promise.all(refinements);
    if (!this.#isCurrent(run)) return;

    this.#planRefinements(run);
    if (!this.#isCurrent(run)) return;

    const after = this.snapshot;
    if (!sameValue(beforeStructure, after.structure.value)) this.#refreshLookahead(run);
    if (!sameValue(before, after)) await this.#presentCurrent('update');
  }

  async #settleProjection(
    run: RefinementRun,
    { preserveEstablished, publish }: { preserveEstablished: boolean; publish: boolean },
  ): Promise<void> {
    if (!this.#isCurrent(run)) return;
    const before = this.snapshot;
    const ready = await this.#queueStructure(run, { preserveEstablished, publish: false });
    if (!this.#isCurrent(run)) return;
    if (ready && typeof this.#evidence === 'function') {
      await this.#queueEvidence(run, { preserveEstablished, publish: false });
    }
    if (!this.#isCurrent(run)) return;
    this.#planRefinements(run);
    if (!this.#isCurrent(run)) return;
    this.#refreshLookahead(run);
    const after = this.snapshot;
    if (publish && !sameValue(before, after)) await this.#presentCurrent('update');
  }
}
