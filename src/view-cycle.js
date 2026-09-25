export const VIEW_RENDERED_EVENT = 'chessview:view-rendered';
export const VIEW_WORK_SETTLED_EVENT = 'chessview:view-work-settled';
export const VIEW_REFRESH_REQUESTED_EVENT = 'chessview:view-refresh-requested';

export function announceViewRendered(detail) {
  window.dispatchEvent(new CustomEvent(VIEW_RENDERED_EVENT, { detail }));
}

export function reportViewWorkSettled(detail) {
  window.dispatchEvent(new CustomEvent(VIEW_WORK_SETTLED_EVENT, { detail }));
}

export function requestViewRefresh(detail) {
  window.dispatchEvent(new CustomEvent(VIEW_REFRESH_REQUESTED_EVENT, { detail }));
}

export function createViewCycleController({
  onPresentation = () => {},
  setTimeoutFn = (...args) => setTimeout(...args),
  clearTimeoutFn = (id) => clearTimeout(id),
  updatingDelayMs = 180,
  readyHoldMs = 1_200,
} = {}) {
  let cycleId = 0;
  let taskSerial = 0;
  let pending = new Map();
  let presentation = 'hidden';
  let hasSettled = false;
  let updatingTimer = null;
  let readyTimer = null;

  function clearTimers() {
    if (updatingTimer != null) clearTimeoutFn(updatingTimer);
    if (readyTimer != null) clearTimeoutFn(readyTimer);
    updatingTimer = null;
    readyTimer = null;
  }

  function snapshot() {
    return {
      cycleId,
      presentation,
      pending: [...pending.keys()],
      hasSettled,
    };
  }

  function present(next) {
    if (presentation === next) return;
    presentation = next;
    onPresentation(snapshot());
  }

  function scheduleUpdating(id) {
    if (updatingTimer != null) clearTimeoutFn(updatingTimer);
    updatingTimer = setTimeoutFn(() => {
      updatingTimer = null;
      if (id === cycleId && pending.size) present('updating');
    }, updatingDelayMs);
  }

  function assign(label) {
    const token = `${cycleId}:${++taskSerial}`;
    pending.set(label, token);
    return token;
  }

  function finish(id) {
    if (id !== cycleId || pending.size) return false;
    if (updatingTimer != null) {
      clearTimeoutFn(updatingTimer);
      updatingTimer = null;
    }
    hasSettled = true;
    present('ready');
    readyTimer = setTimeoutFn(() => {
      readyTimer = null;
      if (id === cycleId && pending.size === 0) present('check');
    }, readyHoldMs);
    return true;
  }

  function begin(id, label) {
    if (id !== cycleId || !label) return null;
    if (pending.size === 0 && hasSettled) {
      if (readyTimer != null) {
        clearTimeoutFn(readyTimer);
        readyTimer = null;
      }
      present('check');
      scheduleUpdating(id);
    }
    return assign(label);
  }

  function start(expected = []) {
    clearTimers();
    cycleId += 1;
    pending = new Map();
    present(hasSettled ? 'check' : 'hidden');
    for (const label of expected) assign(label);
    if (pending.size) scheduleUpdating(cycleId);
    else finish(cycleId);
    return cycleId;
  }

  function settle(id, label, token) {
    if (id !== cycleId || pending.get(label) !== token) return false;
    pending.delete(label);
    finish(id);
    return true;
  }

  return {
    start,
    begin,
    settle,
    get cycleId() {
      return cycleId;
    },
    get presentation() {
      return presentation;
    },
    snapshot,
  };
}
