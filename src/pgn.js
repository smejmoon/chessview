function edgeOrder(a, b) {
  return (b.games ?? 0) - (a.games ?? 0)
    || (b.share ?? 0) - (a.share ?? 0)
    || (a.uci ?? '').localeCompare(b.uci ?? '')
    || a.source.localeCompare(b.source);
}

export function formatPgnMoves(edges, startPly = 0) {
  return edges.map((edge, index) => {
    const san = edge.san ?? edge.uci ?? '';
    const ply = startPly + index;
    const moveNumber = Math.floor(ply / 2) + 1;
    if (ply % 2 === 0) return `${moveNumber}. ${san}`;
    if (index === 0) return `${moveNumber}... ${san}`;
    return san;
  }).join(' ');
}

export function formatPgnSuffix(edges, maxPlies = 6) {
  const startPly = Math.max(0, edges.length - Math.max(1, maxPlies));
  const suffix = formatPgnMoves(edges.slice(startPly), startPly);
  return startPly ? `… ${suffix}` : suffix;
}

export function reconstructPgnPath(target, incomingByTarget, start, maxDepth = 64) {
  if (!target || !start) return null;
  if (target === start) return [];

  const queue = [{ key: target, path: [] }];
  const seen = new Set([target]);

  while (queue.length) {
    const current = queue.shift();
    if (current.path.length >= maxDepth) continue;

    const incoming = (incomingByTarget.get(current.key) ?? [])
      .slice()
      .sort(edgeOrder);

    for (const edge of incoming) {
      const path = [edge, ...current.path];
      if (edge.source === start) return path;
      if (seen.has(edge.source)) continue;
      seen.add(edge.source);
      queue.push({ key: edge.source, path });
    }
  }

  return null;
}

export function reconstructPgn(target, incomingByTarget, start, maxDepth = 64) {
  const path = reconstructPgnPath(target, incomingByTarget, start, maxDepth);
  return path == null ? null : formatPgnMoves(path);
}
