import { debugLog } from './debug.js';
import { acquireExplorerReading } from './knowledge-acquisition.js';
import type { AcquisitionPriorityInput } from './knowledge-acquisition.ts';

export type ReadingFrontierStructure = Readonly<{
  readingFrontier?: readonly string[];
  [field: string]: unknown;
}>;

export type DiscoveryOptions = Readonly<{
  signal?: AbortSignal;
  priority?: AcquisitionPriorityInput;
}>;

export type DiscoveryProgress<T extends ReadingFrontierStructure> = () => (
  Promise<T | null | undefined>
  | T
  | null
  | undefined
);

export async function discoverSelectedLines<T extends ReadingFrontierStructure>(
  center: string,
  structure: T,
  onProgress?: DiscoveryProgress<T>,
  { signal, priority = 'foreground' }: DiscoveryOptions = {},
): Promise<T> {
  const inspected = new Set<string>();
  let current = structure;

  while (!signal?.aborted) {
    const frontier = current?.readingFrontier ?? [];
    const next = frontier.find((key) => key && !inspected.has(key));
    if (!next) break;

    inspected.add(next);
    debugLog('structural Line frontier requests Explorer Reading', {
      center,
      position: next,
      frontier: frontier.length,
    });

    await acquireExplorerReading(next, { signal, priority });
    if (signal?.aborted) break;
    const recomposed = await onProgress?.();
    if (recomposed) current = recomposed;
  }

  debugLog(signal?.aborted ? 'selected Line acquisition cancelled' : 'selected Line acquisition complete', {
    center,
    readings: inspected.size,
  });
  return current;
}
