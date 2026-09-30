export const RAIL_SAMPLE_FLOOR = 100;
export const POPULAR_BAD_SHARE = 0.05;

export function railWorthy({ edge, frequency, engineQuality, humanResult } = {}) {
  if (!edge) return false;
  if (edge.manual) return true;

  const games = frequency?.games ?? 0;
  const share = frequency?.share;
  const popular = Number.isFinite(share) && share >= POPULAR_BAD_SHARE;
  if (games < RAIL_SAMPLE_FLOOR) return popular;

  const engineBad = engineQuality?.quality === 'bad';
  const humanBad = humanResult?.quality === 'unfavorable';
  if (engineBad || humanBad) return popular;
  return true;
}
