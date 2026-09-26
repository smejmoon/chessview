import { createViewCycleController } from './view-cycle.js';

const normalizeView = (view) => view === 'roots' ? 'roots' : 'lines';
const normalizeOrientation = (orientation) => orientation === 'black' ? 'black' : 'white';
const normalizeDepth = (depth) => Number.isFinite(depth) && depth >= 0 ? depth : 0;

export class NodusController {
  #browser;
  #canonicalize;
  #decorate;
  #discover;
  #disposed = false;
  #evidence;
  #generation = 0;
  #log;
  #prepare;
  #render;
  #run = null;
  #state;
  #viewCycle;

  constructor({ initial, canonicalize, browser, render, prepare = async () => {}, decorate = async () => {}, evidence = async () => {}, discover = null, onPresentation = () => {}, log = () => {}, cycleOptions = {} }) {
    if (typeof canonicalize !== 'function') throw new TypeError('NodusController requires canonicalize');
    if (typeof render !== 'function') throw new TypeError('NodusController requires render');
    this.#canonicalize = canonicalize;
    this.#browser = browser ?? {};
    this.#render = render;
    this.#prepare = prepare;
    this.#decorate = decorate;
    this.#evidence = evidence;
    this.#discover = discover;
    this.#log = log;
    this.#state = {
      center: canonicalize(initial?.center),
      view: normalizeView(initial?.view),
      orientation: normalizeOrientation(initial?.orientation),
      navDepth: normalizeDepth(initial?.navDepth),
      loading: false,
      error: '',
      composition: null,
    };
    this.#viewCycle = createViewCycleController({ ...cycleOptions, onPresentation: () => onPresentation(this.snapshot) });
  }

  get snapshot() {
    return Object.freeze({ ...this.#state, generation: this.#generation, presentation: this.#viewCycle.presentation });
  }

  async start() {
    if (this.#disposed) return false;
    this.#browser.replace?.(this.#route());
    await this.#startView('start');
    return true;
  }

  async navigate(position, { history = 'push' } = {}) {
    if (this.#disposed) return false;
    const next = this.#canonicalize(position);
    if (next === this.#state.center) return false;
    const previous = this.#state.center;
    this.#state.center = next;
    if (history === 'push') this.#state.navDepth += 1;
    this.#state.error = '';
    (history === 'push' ? this.#browser.push : this.#browser.replace)?.(this.#route());
    this.#log('recenter', { from: previous, to: next, view: this.#state.view, navDepth: this.#state.navDepth });
    await this.#startView('navigate');
    return true;
  }

  async restore(route) {
    if (this.#disposed) return false;
    this.#state.center = this.#canonicalize(route?.center ?? this.#state.center);
    this.#state.view = normalizeView(route?.view ?? this.#state.view);
    this.#state.navDepth = normalizeDepth(route?.navDepth);
    this.#state.error = '';
    this.#log('history restored', this.#route());
    await this.#startView('restore');
    return true;
  }

  async setView(view) {
    if (this.#disposed) return false;
    const next = normalizeView(view);
    if (next === this.#state.view) return false;
    this.#state.view = next;
    this.#state.error = '';
    this.#browser.persistView?.(next);
    this.#browser.replace?.(this.#route());
    this.#log('view changed', { view: next, center: this.#state.center });
    await this.#startView('view');
    return true;
  }

  async flip() {
    if (this.#disposed) return false;
    this.#state.orientation = this.#state.orientation === 'white' ? 'black' : 'white';
    this.#browser.persistOrientation?.(this.#state.orientation);
    await this.redraw();
    return true;
  }

  back() {
    if (this.#disposed || this.#state.navDepth <= 0) return false;
    this.#browser.back?.();
    return true;
  }

  async refresh() {
    if (this.#disposed) return false;
    await this.#startView('refresh');
    return true;
  }

  async redraw() {
    const run = this.#run;
    if (!this.#isCurrent(run)) return false;
    await this.#queueRender(run, { hydrateEvidence: !this.#state.loading });
    return true;
  }

  dispose() {
    this.#disposed = true;
    this.#run?.abortController.abort();
    this.#run = null;
  }

  #route() {
    return { center: this.#state.center, view: this.#state.view, navDepth: this.#state.navDepth };
  }

  #isCurrent(run) {
    return Boolean(run && !this.#disposed && this.#run === run && run.generation === this.#generation && run.cycleId === this.#viewCycle.cycleId && !run.abortController.signal.aborted);
  }

  #baseScope(run) {
    const snapshot = this.snapshot;
    return Object.freeze({
      center: snapshot.center,
      view: snapshot.view,
      orientation: snapshot.orientation,
      navDepth: snapshot.navDepth,
      loading: snapshot.loading,
      error: snapshot.error,
      presentation: snapshot.presentation,
      isCurrent: () => this.#isCurrent(run),
    });
  }

  #renderScope(run) {
    return Object.freeze({ ...this.#baseScope(run), actions: Object.freeze({
      navigate: (position) => this.navigate(position),
      setView: (view) => this.setView(view),
      flip: () => this.flip(),
      back: () => this.back(),
      redraw: () => this.redraw(),
    }) });
  }

  #structureScope(run, composition = this.#state.composition) {
    return Object.freeze({ ...this.#baseScope(run), composition, signal: run.abortController.signal });
  }

  #evidenceScope(run, composition = this.#state.composition) {
    return Object.freeze({ ...this.#baseScope(run), composition, navigate: (position) => this.navigate(position) });
  }

  async #startView(reason) {
    this.#run?.abortController.abort();
    this.#generation += 1;
    this.#state.loading = this.#state.view === 'lines' && typeof this.#discover === 'function';
    this.#state.error = '';
    this.#state.composition = null;
    const expected = ['render', 'structure'];
    if (this.#state.loading) expected.push('discovery');
    const run = {
      generation: this.#generation,
      cycleId: this.#viewCycle.start(expected),
      abortController: new AbortController(),
      renderTail: Promise.resolve(),
    };
    this.#run = run;
    this.#log('view cycle started', { cycleId: run.cycleId, generation: run.generation, center: this.#state.center, view: this.#state.view, discovery: this.#state.loading, reason });
    await this.#queueRender(run, { hydrateEvidence: !this.#state.loading });
    if (this.#isCurrent(run) && this.#state.loading) void this.#runDiscovery(run);
  }

  #queueRender(run, options) {
    run.renderTail = run.renderTail.catch(() => {}).then(() => this.#renderCurrent(run, options));
    return run.renderTail;
  }

  async #renderCurrent(run, { hydrateEvidence }) {
    if (!this.#isCurrent(run)) return;
    const structureTask = this.#viewCycle.begin(run.cycleId, 'structure');
    const renderTask = this.#viewCycle.begin(run.cycleId, 'render');
    let preparationError = null;
    try { await this.#prepare(this.#structureScope(run)); }
    catch (error) { preparationError = error; this.#log('structure preparation failed', error); }
    if (!this.#isCurrent(run)) return;

    let rendered;
    try { rendered = await this.#render(this.#renderScope(run)); }
    catch (error) { rendered = { failed: true, error }; }
    if (!this.#isCurrent(run)) return;
    if (rendered?.error && !this.#state.error) this.#state.error = rendered.error?.message ?? String(rendered.error);
    if (rendered?.failed) {
      this.#viewCycle.fail(run.cycleId, 'render', renderTask);
      this.#viewCycle.fail(run.cycleId, 'structure', structureTask);
      return;
    }

    this.#state.composition = rendered?.composition ?? null;
    this.#viewCycle.settle(run.cycleId, 'render', renderTask);
    if (preparationError) {
      this.#state.error ||= preparationError?.message ?? 'Current view structure is unavailable.';
      this.#viewCycle.fail(run.cycleId, 'structure', structureTask);
      return;
    }

    try { await this.#decorate(this.#structureScope(run, this.#state.composition)); }
    catch (error) {
      if (!this.#isCurrent(run)) return;
      this.#state.error ||= error?.message ?? 'Current view structure is unavailable.';
      this.#log('structure decoration failed', error);
      this.#viewCycle.fail(run.cycleId, 'structure', structureTask);
      return;
    }
    if (!this.#isCurrent(run)) return;
    this.#viewCycle.settle(run.cycleId, 'structure', structureTask);
    if (hydrateEvidence) this.#hydrateEvidence(run, this.#state.composition);
  }

  #hydrateEvidence(run, composition) {
    const evidenceTask = this.#viewCycle.begin(run.cycleId, 'evidence');
    void Promise.resolve()
      .then(() => this.#evidence(this.#evidenceScope(run, composition)))
      .then(() => {
        if (this.#isCurrent(run)) this.#viewCycle.settle(run.cycleId, 'evidence', evidenceTask);
      })
      .catch((error) => {
        if (!this.#isCurrent(run)) return;
        this.#log('evidence decoration failed', error);
        this.#viewCycle.fail(run.cycleId, 'evidence', evidenceTask);
      });
  }

  async #runDiscovery(run) {
    if (!this.#isCurrent(run) || typeof this.#discover !== 'function') return;
    const discoveryTask = this.#viewCycle.begin(run.cycleId, 'discovery');
    let result = null;
    try {
      result = await this.#discover(Object.freeze({ ...this.#baseScope(run), signal: run.abortController.signal, onProgress: () => {
        if (this.#isCurrent(run)) void this.#queueRender(run, { hydrateEvidence: false });
      } }));
    } catch (error) {
      result = { error, criticalFailure: true };
    }
    if (!this.#isCurrent(run)) return;
    this.#state.loading = false;
    if (result?.error) this.#state.error = result.error?.message ?? String(result.error);
    await this.#queueRender(run, { hydrateEvidence: true });
    if (!this.#isCurrent(run)) return;
    if (result?.criticalFailure) this.#viewCycle.fail(run.cycleId, 'discovery', discoveryTask);
    else this.#viewCycle.settle(run.cycleId, 'discovery', discoveryTask);
  }
}
