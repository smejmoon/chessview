export class ObsoleteWork extends Error {
  constructor(message = 'Work became obsolete', options = undefined) {
    super(message, options);
    // Preserve the platform cancellation shape for callers that only display the
    // error; semantic classification must use isObsoleteWork().
    this.name = 'AbortError';
  }
}

function isAbortShaped(error) {
  return typeof error === 'object'
    && error !== null
    && 'name' in error
    && error.name === 'AbortError';
}

export function obsoleteWork(message = 'Work became obsolete', cause = undefined) {
  return cause === undefined
    ? new ObsoleteWork(message)
    : new ObsoleteWork(message, { cause });
}

/**
 * @param {unknown} error
 * @param {AbortSignal | undefined} [signal]
 */
export function isObsoleteWork(error, signal = undefined) {
  if (error instanceof ObsoleteWork) return true;
  return Boolean(signal?.aborted && isAbortShaped(error));
}

/**
 * @param {AbortSignal | undefined} signal
 * @param {string} [message]
 */
export function throwIfObsolete(signal, message = 'Work became obsolete') {
  if (!signal?.aborted) return;
  throw obsoleteWork(message, signal.reason);
}
