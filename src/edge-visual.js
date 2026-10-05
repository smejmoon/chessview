export const EDGE_MIN_WIDTH = 1.5;
export const EDGE_MAX_WIDTH = 9;

export function edgeStrokeWidth(games, maxGames) {
  const numericGames = Number.isFinite(games) ? Math.max(0, games) : 0;
  const numericMax = Number.isFinite(maxGames) ? Math.max(0, maxGames) : 0;
  if (!(numericGames > 0) || !(numericMax > 0)) return EDGE_MIN_WIDTH;
  const ratio = Math.min(1, numericGames / numericMax);
  return Math.max(EDGE_MIN_WIDTH, EDGE_MAX_WIDTH * ratio);
}

// Compatibility aliases while connector callers move to the generic naming.
export const LINE_EDGE_MIN_WIDTH = EDGE_MIN_WIDTH;
export const LINE_EDGE_MAX_WIDTH = EDGE_MAX_WIDTH;
export function lineStrokeWidth(games, maxGames) {
  return edgeStrokeWidth(games, maxGames);
}
