export class ObsoleteWork extends Error {
  constructor(message = 'Work became obsolete', options?: ErrorOptions) {
    super(message, options);
    // Preserve the platform cancellation shape for callers that only display the
    // error; semantic classification must use isObsoleteWork().
    this.name = 'AbortError';
  }
}

function isAbortShaped(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'name' in error
    && error.name === 'AbortError';
}

export function obsoleteWork(message = 'Work became obsolete', cause?: unknown) {
  return cause === undefined
    ? new ObsoleteWork(message)
    : new ObsoleteWork(message, { cause });
}

/**
 * @param {unknown} error
 * @param {AbortSignal | undefined} [_signal]
 */
export function isObsoleteWork(error: unknown, _signal?: AbortSignal) {
  return error instanceof ObsoleteWork;
}

/**
 * @param {unknown} error
 * @param {AbortSignal | undefined} signal
 * @param {string} [message]
 */
export function obsoleteFromAbort(error: unknown, signal?: AbortSignal, message = 'Work became obsolete') {
  if (error instanceof ObsoleteWork) return error;
  if (!signal?.aborted || !isAbortShaped(error)) return null;
  return obsoleteWork(message, error);
}

/**
 * @param {AbortSignal | undefined} signal
 * @param {string} [message]
 */
export function throwIfObsolete(signal?: AbortSignal, message = 'Work became obsolete') {
  if (!signal?.aborted) return;
  throw obsoleteWork(message, signal.reason);
}
