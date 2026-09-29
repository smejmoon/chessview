import { debugLog } from './debug.js';
import { loadExplorer } from './explorer.js';

export async function discoverSelectedLines(center, structure, onProgress, { signal } = {}) {
  const inspected = new Set([center]);
  let current = structure;

  while (!signal?.aborted) {
    const selected = current?.composition?.nodes ?? [];
    const next = selected.find((node) => node?.key && !inspected.has(node.key));
    if (!next) break;

    inspected.add(next.key);
    debugLog('selected Line requests Explorer Reading', {
      center,
      position: next.key,
      selected: selected.length,
    });

    await loadExplorer(next.key, { signal });
    if (signal?.aborted) break;
    const recomposed = await onProgress?.();
    if (recomposed) current = recomposed;
  }

  debugLog(signal?.aborted ? 'selected Line acquisition cancelled' : 'selected Line acquisition complete', {
    center,
    readings: Math.max(0, inspected.size - 1),
  });
  return current;
}
