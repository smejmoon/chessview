export const NOTABLE_LINE_SAMPLE_FLOOR = 100;
export const NOTABLE_LINE_POPULAR_SHARE = 0.05;

export function isNotableLine({ edge, frequency, engineQuality, humanResult } = {}) {
  if (!edge) return false;

  const games = frequency?.games ?? 0;
  const share = frequency?.share;
  const common = Number.isFinite(share) && share >= NOTABLE_LINE_POPULAR_SHARE;
  if (games < NOTABLE_LINE_SAMPLE_FLOOR) return common;

  const engineBad = engineQuality?.quality === 'bad';
  const humanBad = humanResult?.quality === 'unfavorable';
  if (engineBad || humanBad) return common;
  return true;
}
