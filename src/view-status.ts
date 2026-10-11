function statusSpec(presentation: string) {
  if (presentation === 'updating') return { mark: '●', label: 'Updating…', title: 'Current view is updating' };
  if (presentation === 'ready') return { mark: '✓', label: 'Ready', title: 'Current view finished updating' };
  if (presentation === 'ready-limited') return { mark: '✓', label: 'Ready · Limited data', title: 'Current map is usable; some opening data could not be loaded. Refresh or revisit to try again.' };
  if (presentation === 'check-limited') return { mark: '✓', label: 'Limited data', title: 'Current map is usable; some opening data could not be loaded. Refresh or revisit to try again.' };
  if (presentation === 'check') return { mark: '✓', label: '', title: 'Current view finished updating' };
  if (presentation === 'failed') return { mark: '!', label: 'Unavailable', title: 'Current view could not finish updating' };
  return { mark: '', label: '', title: '' };
}

function currentStatus(view: any) {
  const structural = view?.structure?.status ?? 'idle';
  if (structural === 'failed') return 'failed';
  if (structural === 'loading') return 'loading';
  if (view?.settling === true) return 'loading';
  if (structural === 'ready' && (view?.weather?.structural?.unavailable ?? 0) > 0) return 'ready-limited';
  return structural;
}

export function createViewStatusPresenter({
  updatingDelayMs = 180,
  readyHoldMs = 1_200,
  setTimeoutFn = (callback: () => void, delay: number) => setTimeout(callback, delay),
  clearTimeoutFn = (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
  onPresentation = (_presentation: string) => {},
}: {
  updatingDelayMs?: number;
  readyHoldMs?: number;
  setTimeoutFn?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (id: ReturnType<typeof setTimeout>) => void;
  onPresentation?: (presentation: string) => unknown;
} = {}) {
  let structuralStatus = 'idle';
  let presentation = 'hidden';
  let transition = 0;
  let updatingTimer: ReturnType<typeof setTimeout> | null = null;
  let readyTimer: ReturnType<typeof setTimeout> | null = null;

  function clearTimers() {
    if (updatingTimer != null) clearTimeoutFn(updatingTimer);
    if (readyTimer != null) clearTimeoutFn(readyTimer);
    updatingTimer = null;
    readyTimer = null;
  }

  function present(next: string) {
    presentation = next;
    onPresentation(presentation);
    return presentation;
  }

  function transitionTo(next: string, { force = false }: { force?: boolean } = {}) {
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
    } else if (next === 'ready' || next === 'ready-limited') {
      present(next);
      readyTimer = setTimeoutFn(() => {
        readyTimer = null;
        if (id === transition && structuralStatus === next) present(next === 'ready' ? 'check' : 'check-limited');
      }, readyHoldMs);
    } else if (next === 'failed') {
      present('failed');
    } else {
      present('hidden');
    }
    return presentation;
  }

  function start(view: any) {
    return transitionTo(currentStatus(view), { force: true });
  }

  function update(view: any) {
    return transitionTo(currentStatus(view));
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
