import { debugLog } from './debug.js';
import { loadExplorer } from './explorer.js';

export async function discoverSelectedLines(center, structure, onProgress, { signal } = {}) {
  const inspected = new Set();
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

    await loadExplorer(next, { signal });
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
