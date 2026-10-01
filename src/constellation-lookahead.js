const DEFAULT_LOOKAHEAD_LIMIT = 4;

function limitValue(value) {
  if (!Number.isFinite(value)) return DEFAULT_LOOKAHEAD_LIMIT;
  return Math.max(0, Math.floor(value));
}

/**
 * @param {{
 *   center?: string,
 *   structure?: { composition?: { nodes?: Array<{ key?: string }> } },
 *   max?: number,
 * }} [options]
 */
export function nominateConstellationLookahead({ center, structure, max = DEFAULT_LOOKAHEAD_LIMIT } = {}) {
  const limit = limitValue(max);
  if (limit === 0) return Object.freeze([]);

  const nodes = Array.isArray(structure?.composition?.nodes)
    ? structure.composition.nodes
    : [];
  const seen = new Set(typeof center === 'string' && center ? [center] : []);
  const nominations = [];

  for (const node of nodes) {
    const key = node?.key;
    if (typeof key !== 'string' || !key || seen.has(key)) continue;
    seen.add(key);
    nominations.push(key);
    if (nominations.length >= limit) break;
  }

  return Object.freeze(nominations);
}
