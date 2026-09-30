export const SELECTION_RARE_SHARE = 0.05;

function engineState(value) {
  return value?.quality ?? value ?? null;
}

function humanState(value) {
  return value?.quality ?? value ?? null;
}

function stableEdgeOrder(a, b) {
  return (a?.uci ?? '').localeCompare(b?.uci ?? '')
    || (a?.target ?? '').localeCompare(b?.target ?? '')
    || (a?.source ?? '').localeCompare(b?.source ?? '');
}

function comparePrevalence(a, b) {
  const aShare = a?.frequency?.share;
  const bShare = b?.frequency?.share;
  const aHasPrevalence = Number.isFinite(aShare);
  const bHasPrevalence = Number.isFinite(bShare);
  if (aHasPrevalence !== bHasPrevalence) return aHasPrevalence ? -1 : 1;
  if (aHasPrevalence && aShare !== bShare) return bShare - aShare;
  return stableEdgeOrder(a?.edge, b?.edge);
}

function evidenceAdjustment(candidate) {
  const positive = Boolean(candidate?.positive);
  const negative = Boolean(candidate?.negative);
  if (positive === negative) return 0;
  return positive ? -1 : 1;
}

export function selectionCandidate({ edge, frequency = null, engineQuality = null, humanResult = null } = {}) {
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

  const engine = engineState(engineQuality);
  const human = humanState(humanResult);
  const rare = frequency.share < SELECTION_RARE_SHARE;
  const positive = engine === 'strong' || engine === 'good' || human === 'favorable';
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

export function compareSameSourceCandidates(a, b) {
  const aOrder = a?.salience?.order;
  const bOrder = b?.salience?.order;
  const aHasSalience = Number.isFinite(aOrder);
  const bHasSalience = Number.isFinite(bOrder);
  if (aHasSalience !== bHasSalience) return aHasSalience ? -1 : 1;
  if (aHasSalience && aOrder !== bOrder) return aOrder - bOrder;
  return comparePrevalence(a, b);
}

export function compareCrossSourceCandidates(a, b) {
  if (Boolean(a?.omitFirst) !== Boolean(b?.omitFirst)) return a?.omitFirst ? 1 : -1;
  return stableEdgeOrder(a?.edge, b?.edge);
}

export function rankSameSourceCandidates(candidates = []) {
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

export function rankCrossSourceCandidates(candidates = []) {
  return candidates.slice().sort(compareCrossSourceCandidates);
}
