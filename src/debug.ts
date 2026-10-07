import { preferenceStore } from './preference-store.ts';

const MAX_ENTRIES = 160;
export type DebugLevel = 'info' | 'warn' | 'error';
export type DebugEntry = Readonly<{ at: string; level: DebugLevel; event: string; detail: unknown }>;

const entries: DebugEntry[] = [];
let enabled = preferenceStore.getDebug();

function normalizeDetail(detail: unknown): unknown {
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

export function debugLog(event: string, detail: unknown = null, level: DebugLevel = 'info'): DebugEntry {
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

export function setDebugEnabled(value: unknown) {
  enabled = preferenceStore.setDebug(Boolean(value));
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
  (window as Window & typeof globalThis & { chessviewDebug: unknown }).chessviewDebug = {
    get enabled() { return enabled; },
    entries: getDebugEntries,
    text: debugText,
    clear: clearDebugLog,
  };
}
