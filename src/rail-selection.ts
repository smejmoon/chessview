export const NOTABLE_LINE_SAMPLE_FLOOR = 100;
export const NOTABLE_LINE_POPULAR_SHARE = 0.05;

export type RailFrequency = Readonly<{
  games?: number;
  share?: number | null;
  [field: string]: unknown;
}>;

export type RailQuality = Readonly<{
  quality?: string | null;
  [field: string]: unknown;
}>;

export type NotableLineOptions = Readonly<{
  edge?: unknown;
  frequency?: RailFrequency | null;
  engineQuality?: RailQuality | null;
  humanResult?: RailQuality | null;
}>;

export function isNotableLine({
  edge,
  frequency,
  engineQuality,
  humanResult,
}: NotableLineOptions = {}): boolean {
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
