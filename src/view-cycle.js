export const VIEW_RENDERED_EVENT = 'chessview:view-rendered';
export const VIEW_WORK_SETTLED_EVENT = 'chessview:view-work-settled';
export const VIEW_REFRESH_REQUESTED_EVENT = 'chessview:view-refresh-requested';

const SUPPLEMENTARY_WORK = new Set(['evidence']);

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
  let supplementary = new Map();
  let failed = new Set();
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
      presentation,
      pending: [...pending.keys()],
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
    if (SUPPLEMENTARY_WORK.has(label)) {
      supplementary.set(label, token);
    } else {
      failed.delete(label);
      pending.set(label, token);
    }
    return token;
  }

  function finish(id) {
    if (id !== cycleId || pending.size) return false;
    if (updatingTimer != null) {
      clearTimeoutFn(updatingTimer);
      updatingTimer = null;
    }
    if (readyTimer != null) {
      clearTimeoutFn(readyTimer);
      readyTimer = null;
    }
    hasSettled = true;
    if (failed.size) {
      present('failed');
      return true;
    }
    present('ready');
    readyTimer = setTimeoutFn(() => {
      readyTimer = null;
      if (id === cycleId && pending.size === 0 && failed.size === 0) present('check');
    }, readyHoldMs);
    return true;
  }

  function begin(id, label) {
    if (id !== cycleId || !label) return null;
    if (SUPPLEMENTARY_WORK.has(label)) return assign(label);
    if (pending.size === 0 && hasSettled) {
      if (readyTimer != null) {
        clearTimeoutFn(readyTimer);
        readyTimer = null;
      }
      present('hidden');
      scheduleUpdating(id);
    }
    return assign(label);
  }

  function start(expected = []) {
    clearTimers();
    cycleId += 1;
    pending = new Map();
    supplementary = new Map();
    failed = new Set();
    hasSettled = false;
    present('hidden');
    for (const label of expected) assign(label);
    if (pending.size) scheduleUpdating(cycleId);
    else finish(cycleId);
    return cycleId;
  }

  function settle(id, label, token) {
    const target = SUPPLEMENTARY_WORK.has(label) ? supplementary : pending;
    if (id !== cycleId || target.get(label) !== token) return false;
    target.delete(label);
    if (!SUPPLEMENTARY_WORK.has(label)) {
      failed.delete(label);
      finish(id);
    }
    return true;
  }

  function fail(id, label, token) {
    const target = SUPPLEMENTARY_WORK.has(label) ? supplementary : pending;
    if (id !== cycleId || target.get(label) !== token) return false;
    target.delete(label);
    if (!SUPPLEMENTARY_WORK.has(label)) {
      failed.add(label);
      finish(id);
    }
    return true;
  }

  return {
    start,
    begin,
    settle,
    fail,
    get cycleId() {
      return cycleId;
    },
    get presentation() {
      return presentation;
    },
    snapshot,
  };
}
