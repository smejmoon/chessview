const normalizeMode = (mode) => mode === 'roots' ? 'roots' : 'lines';
const normalizeOrientation = (orientation) => orientation === 'black' ? 'black' : 'white';
const normalizeDepth = (depth) => Number.isFinite(depth) && depth >= 0 ? depth : 0;

function errorMessage(error) {
  if (!error) return null;
  return error?.message ?? String(error);
}

function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, immutable(child)]),
    ));
  }
  return value;
}

function lifecycle(status, value = null, error = null) {
  return Object.freeze({ status, value: immutable(value), error: errorMessage(error) });
}

export class NodusController {
  #actions;
  #canonicalize;
  #discover;
  #disposed = false;
  #evidence;
  #log;
  #materializeMove;
  #preferences;
  #presenter;
  #revision = 0;
  #routeLedger;
  #run = null;
  #state;
  #structure;

  constructor({
    initial,
    canonicalize,
    routeLedger,
    preferences,
    structure,
    evidence = null,
    discover = null,
    materializeMove = null,
    presenter,
    log = () => {},
  }) {
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
    this.#discover = discover;
    this.#materializeMove = materializeMove;
    this.#presenter = presenter;
    this.#log = log;
    this.#state = {
      center: canonicalize(initial?.center),
      mode: normalizeMode(initial?.mode ?? initial?.view),
      orientation: normalizeOrientation(initial?.orientation),
      navDepth: normalizeDepth(initial?.navDepth),
      structure: lifecycle('idle'),
      evidence: lifecycle('idle'),
    };
    this.#actions = Object.freeze({
      recenter: (request) => this.recenter(request),
      setMode: (mode) => this.setMode(mode),
      flip: () => this.flip(),
      back: () => this.back(),
      refresh: () => this.refresh(),
      redraw: () => this.redraw(),
    });
  }

  get snapshot() {
    return Object.freeze({
      center: this.#state.center,
      mode: this.#state.mode,
      orientation: this.#state.orientation,
      navigation: Object.freeze({ canGoBack: this.#state.navDepth > 0 }),
      structure: this.#state.structure,
      evidence: this.#state.evidence,
    });
  }

  async start() {
    if (this.#disposed) return false;
    this.#routeLedger.replace?.(this.#route());
    await this.#startView('start');
    return true;
  }

  async recenter(request) {
    if (this.#disposed) return false;
    const hasTarget = request != null && request.target != null;
    const hasMove = request?.move != null;
    if (hasTarget === hasMove) return false;

    if (hasTarget) return this.#commitRecenter(request.target);
    if (typeof this.#materializeMove !== 'function') return false;

    const run = this.#run;
    const source = this.#state.center;
    const move = Object.freeze({
      from: request.move?.from,
      to: request.move?.to,
      promotion: request.move?.promotion,
    });

    let result = null;
    try {
      result = await this.#materializeMove(Object.freeze({ source, move }));
    } catch (error) {
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

  async restore(route) {
    if (this.#disposed) return false;
    this.#state.center = this.#canonicalize(route?.center ?? this.#state.center);
    this.#state.mode = normalizeMode(route?.view ?? route?.mode ?? this.#state.mode);
    this.#state.navDepth = normalizeDepth(route?.navDepth);
    this.#log('history restored', this.#route());
    await this.#startView('restore');
    return true;
  }

  async setMode(mode) {
    if (this.#disposed) return false;
    const next = normalizeMode(mode);
    if (next === this.#state.mode) return false;
    this.#state.mode = next;
    this.#preferences.setView?.(next);
    this.#routeLedger.replace?.(this.#route());
    this.#log('view mode changed', { mode: next, center: this.#state.center });
    await this.#startView('mode');
    return true;
  }

  async flip() {
    if (this.#disposed) return false;
    this.#state.orientation = this.#state.orientation === 'white' ? 'black' : 'white';
    this.#preferences.setOrientation?.(this.#state.orientation);
    await this.#presentCurrent('update');
    return true;
  }

  back() {
    if (this.#disposed || this.#state.navDepth <= 0) return false;
    this.#routeLedger.back?.();
    return true;
  }

  async refresh() {
    if (this.#disposed) return false;
    await this.#startView('refresh');
    return true;
  }

  async redraw() {
    if (this.#disposed) return false;
    await this.#presentCurrent('update');
    return true;
  }

  dispose() {
    this.#disposed = true;
    this.#run?.abortController.abort();
    this.#run = null;
  }

  #route() {
    return { center: this.#state.center, view: this.#state.mode, navDepth: this.#state.navDepth };
  }

  #isCurrent(run) {
    return Boolean(
      run
      && !this.#disposed
      && this.#run === run
      && run.revision === this.#revision
      && !run.abortController.signal.aborted
    );
  }

  async #commitRecenter(position) {
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

  async #presentCurrent(kind) {
    if (this.#disposed) return false;
    await this.#presenter[kind](this.snapshot, this.#actions);
    return true;
  }

  async #startView(reason) {
    this.#run?.abortController.abort();
    this.#revision += 1;
    const run = {
      revision: this.#revision,
      abortController: new AbortController(),
      composeTail: Promise.resolve(),
    };
    this.#run = run;
    this.#state.structure = lifecycle('loading');
    this.#state.evidence = lifecycle('idle');
    this.#log('Nodus view started', {
      revision: run.revision,
      center: this.#state.center,
      mode: this.#state.mode,
      reason,
    });
    await this.#presentCurrent('start');

    const hasDiscovery = this.#state.mode === 'lines' && typeof this.#discover === 'function';
    const composed = await this.#queueComposition(run, {
      status: hasDiscovery ? 'loading' : 'ready',
    });
    if (!composed || !this.#isCurrent(run)) return;

    if (hasDiscovery) void this.#runDiscovery(run);
    else void this.#hydrateEvidence(run);
  }

  #queueComposition(run, options = {}) {
    run.composeTail = run.composeTail
      .catch(() => false)
      .then(() => this.#composeCurrent(run, options));
    return run.composeTail;
  }

  async #composeCurrent(run, { status = 'ready', error = null } = {}) {
    if (!this.#isCurrent(run)) return false;
    let value;
    try {
      value = await this.#structure(Object.freeze({
        center: this.#state.center,
        mode: this.#state.mode,
        signal: run.abortController.signal,
      }));
    } catch (structureError) {
      if (!this.#isCurrent(run) || structureError?.name === 'AbortError') return false;
      this.#state.structure = lifecycle('failed', null, structureError);
      this.#state.evidence = lifecycle('idle');
      this.#log('Nodus structure failed', structureError);
      await this.#presentCurrent('update');
      return false;
    }
    if (!this.#isCurrent(run)) return false;
    this.#state.structure = lifecycle(status, value, error);
    await this.#presentCurrent('update');
    return true;
  }

  async #runDiscovery(run) {
    if (!this.#isCurrent(run) || typeof this.#discover !== 'function') return;
    let result = null;
    try {
      result = await this.#discover(Object.freeze({
        center: this.#state.center,
        mode: this.#state.mode,
        signal: run.abortController.signal,
        onProgress: () => {
          if (this.#isCurrent(run)) void this.#queueComposition(run, { status: 'loading' });
        },
      }));
    } catch (error) {
      if (!this.#isCurrent(run) || error?.name === 'AbortError') return;
      result = { error, criticalFailure: true };
    }
    if (!this.#isCurrent(run)) return;

    const status = result?.criticalFailure ? 'failed' : 'ready';
    const composed = await this.#queueComposition(run, { status, error: result?.error ?? null });
    if (!composed || !this.#isCurrent(run)) return;
    if (status === 'ready') void this.#hydrateEvidence(run);
  }

  async #hydrateEvidence(run) {
    if (!this.#isCurrent(run) || typeof this.#evidence !== 'function') return;
    this.#state.evidence = lifecycle('loading');
    await this.#presentCurrent('update');
    let value;
    try {
      value = await this.#evidence(Object.freeze({
        center: this.#state.center,
        mode: this.#state.mode,
        structure: this.#state.structure.value,
        signal: run.abortController.signal,
      }));
    } catch (error) {
      if (!this.#isCurrent(run) || error?.name === 'AbortError') return;
      this.#state.evidence = lifecycle('failed', null, error);
      this.#log('Nodus evidence failed', error);
      await this.#presentCurrent('update');
      return;
    }
    if (!this.#isCurrent(run)) return;
    this.#state.evidence = lifecycle('ready', value);
    await this.#presentCurrent('update');
  }
}
