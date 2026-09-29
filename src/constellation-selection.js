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

export function selectionCandidate({ edge, frequency = null, engineQuality = null, humanResult = null } = {}) {
  if (!edge) return null;

  if (edge.manual) {
    return Object.freeze({
      edge,
      frequency,
      automatic: false,
      rare: false,
      rescued: false,
      negative: false,
      omitFirst: false,
    });
  }

  if (!frequency || !Number.isFinite(frequency.share)) return null;

  const engine = engineState(engineQuality);
  const human = humanState(humanResult);
  const rare = frequency.share < SELECTION_RARE_SHARE;
  const rescued = engine === 'strong' || engine === 'good' || human === 'favorable';
  const negative = engine === 'bad' || human === 'unfavorable';

  return Object.freeze({
    edge,
    frequency,
    automatic: true,
    rare,
    rescued,
    negative,
    omitFirst: rare && negative && !rescued,
  });
}

export function compareSameSourceCandidates(a, b) {
  const aShare = a?.frequency?.share;
  const bShare = b?.frequency?.share;
  const aHasFrequency = Number.isFinite(aShare);
  const bHasFrequency = Number.isFinite(bShare);
  if (aHasFrequency !== bHasFrequency) return aHasFrequency ? -1 : 1;
  if (aHasFrequency && aShare !== bShare) return bShare - aShare;
  if (Boolean(a?.omitFirst) !== Boolean(b?.omitFirst)) return a?.omitFirst ? 1 : -1;
  return stableEdgeOrder(a?.edge, b?.edge);
}

export function compareCrossSourceCandidates(a, b) {
  if (Boolean(a?.omitFirst) !== Boolean(b?.omitFirst)) return a?.omitFirst ? 1 : -1;
  return stableEdgeOrder(a?.edge, b?.edge);
}

export function rankSameSourceCandidates(candidates = []) {
  return candidates.slice().sort(compareSameSourceCandidates);
}

export function rankCrossSourceCandidates(candidates = []) {
  return candidates.slice().sort(compareCrossSourceCandidates);
}
