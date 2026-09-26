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

  function paint() {
    const element = globalThis.document?.querySelector?.('#view-status');
    if (!element) return;
    const spec = statusSpec(presentation);
    element.className = `view-status is-${presentation}`;
    element.title = spec.title;
    element.setAttribute('aria-label', spec.title);
    const mark = element.querySelector('.view-status-mark');
    const label = element.querySelector('.view-status-label');
    if (mark) mark.textContent = spec.mark;
    if (label) label.textContent = spec.label;
  }

  function present(next) {
    presentation = next;
    paint();
  }

  function update(view) {
    const next = view?.structure?.status ?? 'idle';
    if (next !== structuralStatus) {
      structuralStatus = next;
      transition += 1;
      const id = transition;
      clearTimers();
      if (next === 'loading') {
        presentation = 'hidden';
        updatingTimer = setTimeoutFn(() => {
          updatingTimer = null;
          if (id === transition && structuralStatus === 'loading') present('updating');
        }, updatingDelayMs);
      } else if (next === 'ready') {
        presentation = 'ready';
        readyTimer = setTimeoutFn(() => {
          readyTimer = null;
          if (id === transition && structuralStatus === 'ready') present('check');
        }, readyHoldMs);
      } else if (next === 'failed') {
        presentation = 'failed';
      } else {
        presentation = 'hidden';
      }
    }
    paint();
    return presentation;
  }

  function dispose() {
    clearTimers();
  }

  return Object.freeze({
    update,
    paint,
    dispose,
    get presentation() { return presentation; },
  });
}

export { statusSpec as viewStatusSpec };
