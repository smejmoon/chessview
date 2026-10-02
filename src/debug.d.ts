export type DebugLevel = 'info' | 'warn' | 'error';

export type DebugEntry = Readonly<{
  at: string;
  level: DebugLevel;
  event: string;
  detail: unknown;
}>;

export function debugLog(event: string, detail?: unknown, level?: DebugLevel): DebugEntry;
export function isDebugEnabled(): boolean;
export function setDebugEnabled(value: unknown): boolean;
export function clearDebugLog(): void;
export function getDebugEntries(): DebugEntry[];
export function debugText(): string;
