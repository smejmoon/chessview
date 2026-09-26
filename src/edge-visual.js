export const LINE_EDGE_MIN_WIDTH = 1.5;
export const LINE_EDGE_MAX_WIDTH = 4;

export function lineStrokeWidth(share) {
  const numeric = Number.isFinite(share) ? share : 0;
  const normalized = Math.min(1, Math.max(0, numeric));
  return LINE_EDGE_MIN_WIDTH
    + (LINE_EDGE_MAX_WIDTH - LINE_EDGE_MIN_WIDTH) * Math.sqrt(normalized);
}
