import { CONSTELLATION_RARE_SHARE } from './config.ts';
import type { GraphEdge } from './position-graph.ts';

export type SelectionEdge = GraphEdge;

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
  frequency: FrequencyEvidence;
  rare: boolean;
  positive: boolean;
  rescued: boolean;
  negative: boolean;
  omitFirst: boolean;
  salience?: Salience;
}>;

export type RankedSelectionCandidate = SelectionCandidate & Readonly<{
  salience: Salience;
}>;

type CandidateOptions = Readonly<{
  edge?: SelectionEdge | null;
  frequency?: FrequencyEvidence | null;
  engineQuality?: QualityEvidence | null;
  humanResult?: QualityEvidence | null;
}>;

type SameSourceRankEntry = Readonly<{
  candidate: SelectionCandidate;
  prevalenceOrder: number;
  evidenceAdjustment: number;
  localCost: number;
}>;

function stableEdgeOrder(a?: SelectionEdge | null, b?: SelectionEdge | null): number {
  return (a?.uci ?? '').localeCompare(b?.uci ?? '')
    || (a?.target ?? '').localeCompare(b?.target ?? '')
    || (a?.source ?? '').localeCompare(b?.source ?? '');
}

function comparePrevalence(a: SelectionCandidate, b: SelectionCandidate): number {
  const aShare = a.frequency.share;
  const bShare = b.frequency.share;
  const aHasPrevalence = typeof aShare === 'number' && Number.isFinite(aShare);
  const bHasPrevalence = typeof bShare === 'number' && Number.isFinite(bShare);
  if (aHasPrevalence !== bHasPrevalence) return aHasPrevalence ? -1 : 1;
  if (aHasPrevalence && bHasPrevalence && aShare !== bShare) return bShare - aShare;
  return stableEdgeOrder(a.edge, b.edge);
}

function evidenceAdjustment(candidate: SelectionCandidate): number {
  return candidate.positive && !candidate.negative ? -1 : 0;
}

function compareOrdinarySalience(a: SameSourceRankEntry, b: SameSourceRankEntry): number {
  return a.localCost - b.localCost
    || a.evidenceAdjustment - b.evidenceAdjustment
    || a.prevalenceOrder - b.prevalenceOrder
    || stableEdgeOrder(a.candidate.edge, b.candidate.edge);
}

export function selectionCandidate({
  edge,
  frequency = null,
  engineQuality = null,
  humanResult = null,
}: CandidateOptions = {}): SelectionCandidate | null {
  if (!edge || !frequency || !Number.isFinite(frequency.share)) return null;

  const engine = engineQuality?.quality ?? null;
  const human = humanResult?.quality ?? null;
  const rare = frequency.share < CONSTELLATION_RARE_SHARE;
  const positive = engine === 'strong' || human === 'favorable';
  const negative = engine === 'bad' || human === 'unfavorable';

  return Object.freeze({
    edge,
    frequency,
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
  const aOrder = a.salience?.order;
  const bOrder = b.salience?.order;
  const aHasSalience = typeof aOrder === 'number' && Number.isFinite(aOrder);
  const bHasSalience = typeof bOrder === 'number' && Number.isFinite(bOrder);
  if (aHasSalience !== bHasSalience) return aHasSalience ? -1 : 1;
  if (aHasSalience && bHasSalience && aOrder !== bOrder) return aOrder - bOrder;
  return comparePrevalence(a, b);
}

export function compareCrossSourceCandidates(
  a: SelectionCandidate,
  b: SelectionCandidate,
): number {
  if (a.omitFirst !== b.omitFirst) return a.omitFirst ? 1 : -1;
  return stableEdgeOrder(a.edge, b.edge);
}

export function rankSameSourceCandidates(
  candidates: readonly SelectionCandidate[] = [],
): RankedSelectionCandidate[] {
  const ranked = candidates
    .slice()
    .sort(comparePrevalence)
    .map((candidate, prevalenceOrder): SameSourceRankEntry => {
      const adjustment = evidenceAdjustment(candidate);
      return {
        candidate,
        prevalenceOrder,
        evidenceAdjustment: adjustment,
        localCost: prevalenceOrder + adjustment,
      };
    });

  const ordinary = ranked
    .filter((entry) => !entry.candidate.omitFirst)
    .sort(compareOrdinarySalience);
  const firstOmission = ranked
    .filter((entry) => entry.candidate.omitFirst)
    .sort((a, b) => a.prevalenceOrder - b.prevalenceOrder
      || stableEdgeOrder(a.candidate.edge, b.candidate.edge));

  return [...ordinary, ...firstOmission].map((entry, order) => Object.freeze({
    ...entry.candidate,
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
