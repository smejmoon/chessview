function statusSpec(presentation) {
  if (presentation === 'updating') return { mark: '●', label: 'Updating…', title: 'Current view is updating' };
  if (presentation === 'ready') return { mark: '✓', label: 'Ready', title: 'Current view finished updating' };
  if (presentation === 'check') return { mark: '✓', label: '', title: 'Current view finished updating' };
  if (presentation === 'failed') return { mark: '!', label: 'Unavailable', title: 'Current view could not finish updating' };
  return { mark: '', label: '', title: '' };
}

export function createViewStatusPresenter({
  updatingDelayMs = 180,
  readyHoldMs = 1_200,
  setTimeoutFn = (...args) => setTimeout(...args),
  clearTimeoutFn = (id) => clearTimeout(id),
  onPresentation = () => {},
} = {}) {
  let structuralStatus = 'idle';
  let presentation = 'hidden';
  let transition = 0;
  let updatingTimer = null;
  let readyTimer = null;

  function clearTimers() {
    if (updatingTimer != null) clearTimeoutFn(updatingTimer);
    if (readyTimer != null) clearTimeoutFn(readyTimer);
    updatingTimer = null;
    readyTimer = null;
  }

  function present(next) {
    presentation = next;
    onPresentation(presentation);
    return presentation;
  }

  function transitionTo(next, { force = false } = {}) {
    if (!force && next === structuralStatus) return presentation;
    structuralStatus = next;
    transition += 1;
    const id = transition;
    clearTimers();
    if (next === 'loading') {
      present('hidden');
      updatingTimer = setTimeoutFn(() => {
        updatingTimer = null;
        if (id === transition && structuralStatus === 'loading') present('updating');
      }, updatingDelayMs);
    } else if (next === 'ready') {
      present('ready');
      readyTimer = setTimeoutFn(() => {
        readyTimer = null;
        if (id === transition && structuralStatus === 'ready') present('check');
      }, readyHoldMs);
    } else if (next === 'failed') {
      present('failed');
    } else {
      present('hidden');
    }
    return presentation;
  }

  function start(view) {
    return transitionTo(view?.structure?.status ?? 'idle', { force: true });
  }

  function update(view) {
    return transitionTo(view?.structure?.status ?? 'idle');
  }

  function fail() {
    transition += 1;
    clearTimers();
    structuralStatus = 'idle';
    return present('failed');
  }

  function dispose() {
    clearTimers();
  }

  return Object.freeze({
    start,
    update,
    fail,
    dispose,
    get presentation() { return presentation; },
  });
}

export { statusSpec as viewStatusSpec };
