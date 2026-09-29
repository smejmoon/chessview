import { canonicalPosition } from './graph.js';

export const HUMAN_RESULT_SAMPLE_FLOOR = 200;
export const HUMAN_FAVORABLE_DELTA = 0.02;
export const HUMAN_UNFAVORABLE_DELTA = 0.08;
export const ROOT_RARE_SHARE = 0.05;
export const ROOT_VERY_RARE_SHARE = 0.01;
export const ROOT_RARITY_SAMPLE_FLOOR = 100;

function moveGames(move) {
  return (move?.white ?? 0) + (move?.draws ?? 0) + (move?.black ?? 0);
}

function totalGames(explorer) {
  return (explorer?.white ?? 0) + (explorer?.draws ?? 0) + (explorer?.black ?? 0);
}

function scoreForSide(move, sideToMove) {
  const games = moveGames(move);
  if (!games) return null;
  const whiteScore = ((move.white ?? 0) + 0.5 * (move.draws ?? 0)) / games;
  return sideToMove === 'w' ? whiteScore : 1 - whiteScore;
}

export function moveFrequency(explorer, edge) {
  if (!edge || !explorer) return null;
  const sourceGames = totalGames(explorer);
  if (!(sourceGames > 0)) return null;
  const move = explorer.moves?.find((candidate) => candidate.uci === edge.uci);
  const games = moveGames(move);
  if (!move || !(games > 0)) return null;
  return Object.freeze({ games, sourceGames, share: games / sourceGames });
}

export function humanResultQuality(explorer, edge, sourceKey, {
  minGames = HUMAN_RESULT_SAMPLE_FLOOR,
  favorableDelta = HUMAN_FAVORABLE_DELTA,
  unfavorableDelta = HUMAN_UNFAVORABLE_DELTA,
} = {}) {
  if (!edge || !explorer) return null;
  const side = canonicalPosition(sourceKey).split(' ')[1];
  const move = explorer.moves?.find((candidate) => candidate.uci === edge.uci);
  const games = moveGames(move);
  const score = scoreForSide(move, side);
  if (!(games >= minGames) || score == null) return null;

  let best = null;
  for (const candidate of explorer.moves ?? []) {
    if (moveGames(candidate) < minGames) continue;
    const candidateScore = scoreForSide(candidate, side);
    if (candidateScore == null) continue;
    if (best == null || candidateScore > best) best = candidateScore;
  }
  if (best == null) return null;

  const deficit = best - score;
  let quality = null;
  if (deficit <= favorableDelta) quality = 'favorable';
  else if (deficit >= unfavorableDelta) quality = 'unfavorable';
  if (!quality) return null;
  return Object.freeze({ quality, games, score, deficit });
}

export function rootRarityFromFrequency(frequency) {
  if (!frequency || frequency.sourceGames < ROOT_RARITY_SAMPLE_FLOOR) return null;
  if (!(frequency.games > 0) || !Number.isFinite(frequency.share) || frequency.share <= 0) return null;
  if (frequency.share < ROOT_VERY_RARE_SHARE) return 'very-rare';
  if (frequency.share < ROOT_RARE_SHARE) return 'rare';
  return null;
}
