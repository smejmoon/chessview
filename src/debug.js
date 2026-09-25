const STORAGE_KEY = 'chessview.debug';
const MAX_ENTRIES = 160;
const entries = [];

const storage = globalThis.localStorage;
let enabled = storage?.getItem(STORAGE_KEY) === '1';

function normalizeDetail(detail) {
  if (detail == null) return null;
  if (detail instanceof Error) {
    return { name: detail.name, message: detail.message, stack: detail.stack };
  }
  if (detail instanceof URL) return detail.toString();
  if (typeof detail === 'string' || typeof detail === 'number' || typeof detail === 'boolean') return detail;
  try {
    return JSON.parse(JSON.stringify(detail));
  } catch {
    return String(detail);
  }
}

export function debugLog(event, detail = null, level = 'info') {
  const entry = {
    at: new Date().toISOString(),
    level,
    event,
    detail: normalizeDetail(detail),
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);

  if (enabled) {
    const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[method](`[Chessview] ${event}`, entry.detail ?? '');
  }
  return entry;
}

export function isDebugEnabled() {
  return enabled;
}

export function setDebugEnabled(value) {
  enabled = Boolean(value);
  storage?.setItem(STORAGE_KEY, enabled ? '1' : '0');
  debugLog(enabled ? 'debug enabled' : 'debug disabled');
  return enabled;
}

export function clearDebugLog() {
  entries.length = 0;
  debugLog('debug log cleared');
}

export function getDebugEntries() {
  return entries.slice();
}

export function debugText() {
  return entries.map((entry) => {
    const detail = entry.detail == null ? '' : ` ${JSON.stringify(entry.detail)}`;
    return `${entry.at} [${entry.level}] ${entry.event}${detail}`;
  }).join('\n');
}

if (typeof window !== 'undefined') {
  window.chessviewDebug = {
    get enabled() { return enabled; },
    entries: getDebugEntries,
    text: debugText,
    clear: clearDebugLog,
  };
}
