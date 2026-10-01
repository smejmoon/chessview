export const SELECTION_RARE_SHARE = 0.05;

export type SelectionEdge = Readonly<{
  source?: string;
  target?: string;
  uci?: string;
  manual?: boolean;
  salienceOrder?: number;
  [field: string]: unknown;
}>;

export type FrequencyEvidence = Readonly<{
  share: number;
  games?: number;
  [field: string]: unknown;
}>;

export type QualityEvidence = Readonly<{
  quality?: string | null;
  [field: string]: unknown;
}>;

export type Salience = Readonly<{
  order: number;
  prevalenceOrder: number;
  evidenceAdjustment: number;
}>;

export type SelectionCandidate = Readonly<{
  edge: SelectionEdge;
  frequency: FrequencyEvidence | null;
  automatic: boolean;
  rare: boolean;
  positive: boolean;
  rescued: boolean;
  negative: boolean;
  omitFirst: boolean;
  salience?: Salience;
}>;

export type RankedSelectionCandidate = SelectionCandidate & Readonly<{
  edge: SelectionEdge & Readonly<{ salienceOrder: number }>;
  salience: Salience;
}>;

type CandidateOptions = Readonly<{
  edge?: SelectionEdge | null;
  frequency?: FrequencyEvidence | null;
  engineQuality?: QualityEvidence | null;
  humanResult?: QualityEvidence | null;
}>;

function stableEdgeOrder(a?: SelectionEdge | null, b?: SelectionEdge | null): number {
  return (a?.uci ?? '').localeCompare(b?.uci ?? '')
    || (a?.target ?? '').localeCompare(b?.target ?? '')
    || (a?.source ?? '').localeCompare(b?.source ?? '');
}

function comparePrevalence(a: SelectionCandidate, b: SelectionCandidate): number {
  const aShare = a?.frequency?.share;
  const bShare = b?.frequency?.share;
  const aHasPrevalence = Number.isFinite(aShare);
  const bHasPrevalence = Number.isFinite(bShare);
  if (aHasPrevalence !== bHasPrevalence) return aHasPrevalence ? -1 : 1;
  if (aHasPrevalence && bHasPrevalence && aShare !== bShare) return bShare - aShare;
  return stableEdgeOrder(a?.edge, b?.edge);
}

function evidenceAdjustment(candidate: SelectionCandidate): number {
  const positive = Boolean(candidate?.positive);
  const negative = Boolean(candidate?.negative);
  if (positive === negative) return 0;
  return positive ? -1 : 1;
}

export function selectionCandidate({
  edge,
  frequency = null,
  engineQuality = null,
  humanResult = null,
}: CandidateOptions = {}): SelectionCandidate | null {
  if (!edge) return null;

  if (edge.manual) {
    return Object.freeze({
      edge,
      frequency,
      automatic: false,
      rare: false,
      positive: false,
      rescued: false,
      negative: false,
      omitFirst: false,
    });
  }

  if (!frequency || !Number.isFinite(frequency.share)) return null;

  const engine = engineQuality?.quality ?? null;
  const human = humanResult?.quality ?? null;
  const rare = frequency.share < SELECTION_RARE_SHARE;
  const positive = engine === 'strong' || human === 'favorable';
  const negative = engine === 'bad' || human === 'unfavorable';

  return Object.freeze({
    edge,
    frequency,
    automatic: true,
    rare,
    positive,
    rescued: positive,
    negative,
    omitFirst: rare && negative && !positive,
  });
}

export function compareSameSourceCandidates(
  a: SelectionCandidate,
  b: SelectionCandidate,
): number {
  const aOrder = a?.salience?.order;
  const bOrder = b?.salience?.order;
  const aHasSalience = Number.isFinite(aOrder);
  const bHasSalience = Number.isFinite(bOrder);
  if (aHasSalience !== bHasSalience) return aHasSalience ? -1 : 1;
  if (aHasSalience && bHasSalience && aOrder !== bOrder) return aOrder - bOrder;
  return comparePrevalence(a, b);
}

export function compareCrossSourceCandidates(
  a: SelectionCandidate,
  b: SelectionCandidate,
): number {
  if (Boolean(a?.omitFirst) !== Boolean(b?.omitFirst)) return a?.omitFirst ? 1 : -1;
  return stableEdgeOrder(a?.edge, b?.edge);
}

export function rankSameSourceCandidates(
  candidates: readonly SelectionCandidate[] = [],
): RankedSelectionCandidate[] {
  const ranked = candidates
    .slice()
    .sort(comparePrevalence)
    .map((candidate, prevalenceOrder) => {
      const adjustment = evidenceAdjustment(candidate);
      return {
        candidate,
        prevalenceOrder,
        evidenceAdjustment: adjustment,
        localCost: prevalenceOrder + adjustment,
      };
    });

  ranked.sort((a, b) => {
    if (Boolean(a.candidate?.omitFirst) !== Boolean(b.candidate?.omitFirst)) {
      return a.candidate?.omitFirst ? 1 : -1;
    }
    return a.localCost - b.localCost
      || a.evidenceAdjustment - b.evidenceAdjustment
      || a.prevalenceOrder - b.prevalenceOrder
      || stableEdgeOrder(a.candidate?.edge, b.candidate?.edge);
  });

  return ranked.map((entry, order) => Object.freeze({
    ...entry.candidate,
    edge: Object.freeze({ ...entry.candidate.edge, salienceOrder: order }),
    salience: Object.freeze({
      order,
      prevalenceOrder: entry.prevalenceOrder,
      evidenceAdjustment: entry.evidenceAdjustment,
    }),
  }));
}

export function rankCrossSourceCandidates(
  candidates: readonly SelectionCandidate[] = [],
): SelectionCandidate[] {
  return candidates.slice().sort(compareCrossSourceCandidates);
}
