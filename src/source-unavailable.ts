export class SourceUnavailable extends Error {
  constructor(message = 'Source unavailable', options?: ErrorOptions) {
    super(message, options);
    this.name = 'SourceUnavailable';
  }
}

export function sourceUnavailable(message = 'Source unavailable', cause?: unknown) {
  return cause === undefined
    ? new SourceUnavailable(message)
    : new SourceUnavailable(message, { cause });
}

export function isSourceUnavailable(error: unknown): error is SourceUnavailable {
  return error instanceof SourceUnavailable;
}
