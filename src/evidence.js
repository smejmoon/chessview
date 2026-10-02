import {
  ENGINE_BAD_CP,
  ENGINE_DUBIOUS_CP,
  HUMAN_FAVORABLE_DELTA,
  HUMAN_MISMATCH_DELTA,
  HUMAN_MISMATCH_SAMPLE_FLOOR,
  HUMAN_RESULT_SAMPLE_FLOOR,
  HUMAN_UNFAVORABLE_DELTA,
  ROOT_RARE_SHARE,
  ROOT_RARITY_SAMPLE_FLOOR,
  ROOT_VERY_RARE_SHARE,
} from './config.ts';
import { canonicalPosition } from './graph.js';

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

function humanMoveStats(explorer, uci, sideToMove) {
  const move = explorer?.moves?.find((candidate) => candidate.uci === uci);
  const games = moveGames(move);
  if (!move || !games) return null;
  return Object.freeze({
    games,
    score: scoreForSide(move, sideToMove),
  });
}

function bestHumanScore(explorer, sideToMove, minGames) {
  let best = null;
  for (const move of explorer?.moves ?? []) {
    const stats = humanMoveStats(explorer, move.uci, sideToMove);
    if (!stats || stats.games < minGames) continue;
    if (best == null || stats.score > best) best = stats.score;
  }
  return best;
}

function pvNumeric(pv) {
  if (!pv) return null;
  if (Number.isFinite(pv.cp)) return pv.cp;
  if (Number.isFinite(pv.mate)) {
    const sign = Math.sign(pv.mate) || 1;
    return sign * (100000 - Math.min(9999, Math.abs(pv.mate) * 100));
  }
  return null;
}

function firstMove(pv) {
  return pv?.moves?.trim().split(/\s+/)[0] ?? '';
}

function engineQuality(lossCp) {
  if (lossCp >= ENGINE_BAD_CP) return 'bad';
  if (lossCp >= ENGINE_DUBIOUS_CP) return 'dubious';
  return 'strong';
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

export function positionEvaluation(cloudEval) {
  const pv = cloudEval?.pvs?.[0];
  if (!pv) return null;
  const cp = Number.isFinite(pv.cp) ? pv.cp : null;
  const mate = Number.isFinite(pv.mate) ? pv.mate : null;
  if (cp == null && mate == null) return null;
  return Object.freeze({ cp, mate, depth: cloudEval.depth ?? null });
}

export function moveEvaluation(sourceKey, edge, sourceEval, targetEval = null) {
  if (!edge || !sourceEval?.pvs?.length) return null;
  const best = sourceEval.pvs[0];
  const matching = sourceEval.pvs.find((pv) => firstMove(pv) === edge.uci);
  if (!matching && !targetEval?.pvs?.length) return null;
  const movePv = matching ?? targetEval.pvs[0];
  const bestValue = pvNumeric(best);
  const moveValue = pvNumeric(movePv);
  if (!Number.isFinite(bestValue) || !Number.isFinite(moveValue)) return null;

  const turn = canonicalPosition(sourceKey).split(' ')[1];
  const rawLoss = turn === 'w' ? bestValue - moveValue : moveValue - bestValue;
  const lossCp = Math.max(0, rawLoss);
  return Object.freeze({ lossCp, quality: engineQuality(lossCp) });
}

export function humanResultQuality(explorer, edge, sourceKey, {
  minGames = HUMAN_RESULT_SAMPLE_FLOOR,
  favorableDelta = HUMAN_FAVORABLE_DELTA,
  unfavorableDelta = HUMAN_UNFAVORABLE_DELTA,
} = {}) {
  if (!edge || !explorer) return null;
  const side = canonicalPosition(sourceKey).split(' ')[1];
  const stats = humanMoveStats(explorer, edge.uci, side);
  if (!stats || stats.games < minGames || stats.score == null) return null;
  const best = bestHumanScore(explorer, side, minGames);
  if (best == null) return null;

  const deficit = best - stats.score;
  let quality = null;
  if (deficit <= favorableDelta) quality = 'favorable';
  else if (deficit >= unfavorableDelta) quality = 'unfavorable';
  if (!quality) return null;
  return Object.freeze({ quality, games: stats.games, score: stats.score, deficit });
}

export function humanMismatch(
  explorer,
  edge,
  sourceKey,
  moveQuality,
  minGames = HUMAN_MISMATCH_SAMPLE_FLOOR,
) {
  if (!moveQuality || !edge) return null;
  const side = canonicalPosition(sourceKey).split(' ')[1];
  const stats = humanMoveStats(explorer, edge.uci, side);
  const best = bestHumanScore(explorer, side, minGames);
  if (!stats || stats.games < minGames || best == null) return null;
  const deficit = best - stats.score;

  if (moveQuality.lossCp >= ENGINE_DUBIOUS_CP && deficit <= HUMAN_FAVORABLE_DELTA) {
    return Object.freeze({ direction: 'up', stats, deficit });
  }
  if (moveQuality.lossCp < ENGINE_DUBIOUS_CP && deficit >= HUMAN_MISMATCH_DELTA) {
    return Object.freeze({ direction: 'down', stats, deficit });
  }
  return null;
}

export function rootRarityFromFrequency(frequency) {
  if (!frequency || frequency.sourceGames < ROOT_RARITY_SAMPLE_FLOOR) return null;
  if (!(frequency.games > 0) || !Number.isFinite(frequency.share) || frequency.share <= 0) return null;
  if (frequency.share < ROOT_VERY_RARE_SHARE) return 'very-rare';
  if (frequency.share < ROOT_RARE_SHARE) return 'rare';
  return null;
}
