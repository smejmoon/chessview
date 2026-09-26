import { canonicalPosition, toPlayableFen } from './graph.js';
import { getNode, putNode } from './db.js';
import { lichessGateway } from './lichess-gateway.js';

export const ENGINE_MIN_DEPTH = 18;
export const ENGINE_DUBIOUS_CP = 50;
export const ENGINE_BAD_CP = 100;
export const HUMAN_SAMPLE_FLOOR = 100;
export const HUMAN_BAD_SAMPLE_FLOOR = 200;
export const HUMAN_BAD_DELTA = 0.08;
export const HUMAN_MISMATCH_DELTA = 0.05;
export const POPULAR_BAD_SHARE = 0.05;
export const ROOT_RARE_SHARE = 0.05;
export const ROOT_VERY_RARE_SHARE = 0.01;
export const EVAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const CLOUD_ENDPOINT = 'https://lichess.org/api/cloud-eval';
const MASTERS_ENDPOINT = 'https://explorer.lichess.org/masters';
const cloudInFlight = new Map();
const mastersInFlight = new Map();

function moveGames(move) {
  return (move?.white ?? 0) + (move?.draws ?? 0) + (move?.black ?? 0);
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

function displayPv(pv) {
  if (!pv) return null;
  if (Number.isFinite(pv.cp)) {
    const pawns = pv.cp / 100;
    return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`;
  }
  if (Number.isFinite(pv.mate)) return `#${pv.mate}`;
  return null;
}

function usableDepth(value) {
  return Number.isFinite(value?.depth) && value.depth >= ENGINE_MIN_DEPTH;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requestFailure(error) {
  return {
    requestFailed: true,
    status: Number.isFinite(error?.status) ? error.status : null,
    message: error?.message ?? String(error),
  };
}

export function isEvidenceRequestFailure(value) {
  return value?.requestFailed === true;
}

function staleOrFailure(error, cachedValue) {
  if (error?.name === 'AbortError') throw error;
  if (cachedValue != null) return cachedValue;
  return requestFailure(error);
}

async function mergeNodeFields(key, fields) {
  const current = await getNode(key);
  await putNode({ ...(current ?? {}), key, fen: current?.fen ?? toPlayableFen(key), ...fields });
}

export async function loadCloudEval(positionKey, { signal } = {}) {
  const key = canonicalPosition(positionKey);
  if (cloudInFlight.has(key)) return cloudInFlight.get(key);

  const promise = (async () => {
    const cached = await getNode(key);
    if (cached?.cloudEvalFetchedAt && Date.now() - cached.cloudEvalFetchedAt < EVAL_TTL_MS) {
      return cached.cloudEval ?? null;
    }

    const url = new URL(CLOUD_ENDPOINT);
    url.searchParams.set('fen', toPlayableFen(key));
    url.searchParams.set('variant', 'standard');
    url.searchParams.set('multiPv', '5');

    try {
      const response = await lichessGateway.request(url, { signal, headers: { Accept: 'application/json' } });
      if (response.status === 404) {
        await mergeNodeFields(key, { cloudEval: null, cloudEvalFetchedAt: Date.now() });
        return null;
      }
      if (!response.ok) throw httpError(response.status, `Lichess cloud eval returned ${response.status}`);
      const value = await response.json();
      await mergeNodeFields(key, { cloudEval: value, cloudEvalFetchedAt: Date.now() });
      return value;
    } catch (error) {
      return staleOrFailure(error, cached?.cloudEval);
    }
  })().finally(() => cloudInFlight.delete(key));

  cloudInFlight.set(key, promise);
  return promise;
}

export async function loadMasters(positionKey, { signal } = {}) {
  const key = canonicalPosition(positionKey);
  if (mastersInFlight.has(key)) return mastersInFlight.get(key);

  const promise = (async () => {
    const cached = await getNode(key);
    if (cached?.mastersFetchedAt && Date.now() - cached.mastersFetchedAt < EVAL_TTL_MS) {
      return cached.mastersExplorer ?? null;
    }

    const url = new URL(MASTERS_ENDPOINT);
    url.searchParams.set('fen', toPlayableFen(key));
    url.searchParams.set('moves', '30');
    url.searchParams.set('topGames', '0');

    try {
      const response = await lichessGateway.request(url, { signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw httpError(response.status, `Lichess masters explorer returned ${response.status}`);
      const value = await response.json();
      await mergeNodeFields(key, { mastersExplorer: value, mastersFetchedAt: Date.now() });
      return value;
    } catch (error) {
      return staleOrFailure(error, cached?.mastersExplorer);
    }
  })().finally(() => mastersInFlight.delete(key));

  mastersInFlight.set(key, promise);
  return promise;
}

export function positionEvaluation(cloudEval) {
  if (!usableDepth(cloudEval)) return null;
  const pv = cloudEval?.pvs?.[0];
  if (!pv) return null;
  return {
    cp: Number.isFinite(pv.cp) ? pv.cp : null,
    mate: Number.isFinite(pv.mate) ? pv.mate : null,
    label: displayPv(pv),
    depth: cloudEval.depth ?? null,
  };
}

export function qualityClass(lossCp) {
  if (!Number.isFinite(lossCp)) return 'unknown';
  if (lossCp >= ENGINE_BAD_CP) return 'bad';
  if (lossCp >= ENGINE_DUBIOUS_CP) return 'dubious';
  return 'good';
}

export function moveEvaluation(sourceKey, edge, sourceEval, targetEval = null) {
  if (!edge || !sourceEval?.pvs?.length || !usableDepth(sourceEval)) return null;
  const best = sourceEval.pvs[0];
  const matching = sourceEval.pvs.find((pv) => firstMove(pv) === edge.uci);
  if (!matching && !usableDepth(targetEval)) return null;
  const movePv = matching ?? targetEval?.pvs?.[0];
  const bestValue = pvNumeric(best);
  const moveValue = pvNumeric(movePv);
  if (!Number.isFinite(bestValue) || !Number.isFinite(moveValue)) return null;

  const turn = canonicalPosition(sourceKey).split(' ')[1];
  const rawLoss = turn === 'w' ? bestValue - moveValue : moveValue - bestValue;
  const lossCp = Math.max(0, rawLoss);
  return {
    lossCp,
    quality: qualityClass(lossCp),
    label: displayPv(movePv),
    cp: Number.isFinite(movePv?.cp) ? movePv.cp : null,
    mate: Number.isFinite(movePv?.mate) ? movePv.mate : null,
    depth: matching ? sourceEval.depth ?? null : targetEval?.depth ?? null,
    fromMultiPv: Boolean(matching),
  };
}

export function rootRarity(edge, sourceNode) {
  const sourceGames = Number(sourceNode?.games ?? 0);
  const moveGames = Number(edge?.games ?? 0);
  const share = edge?.share;
  if (sourceGames < HUMAN_SAMPLE_FLOOR || moveGames <= 0 || !Number.isFinite(share) || share <= 0) return null;
  if (share < ROOT_VERY_RARE_SHARE) return 'very-rare';
  if (share < ROOT_RARE_SHARE) return 'rare';
  return null;
}

export function humanMoveStats(explorer, uci, sideToMove = 'w') {
  const move = explorer?.moves?.find((candidate) => candidate.uci === uci);
  const games = moveGames(move);
  if (!move || !games) return null;
  const whiteScore = ((move.white ?? 0) + 0.5 * (move.draws ?? 0)) / games;
  return {
    games,
    score: sideToMove === 'w' ? whiteScore : 1 - whiteScore,
    white: move.white ?? 0,
    draws: move.draws ?? 0,
    black: move.black ?? 0,
  };
}

export function bestHumanScore(explorer, sideToMove = 'w', minGames = HUMAN_SAMPLE_FLOOR) {
  let best = null;
  for (const move of explorer?.moves ?? []) {
    const stats = humanMoveStats(explorer, move.uci, sideToMove);
    if (!stats || stats.games < minGames) continue;
    if (best == null || stats.score > best) best = stats.score;
  }
  return best;
}

export function humanMismatch(explorer, edge, sourceKey, moveQuality, minGames = HUMAN_SAMPLE_FLOOR) {
  if (!moveQuality || !edge) return null;
  const side = canonicalPosition(sourceKey).split(' ')[1];
  const stats = humanMoveStats(explorer, edge.uci, side);
  const best = bestHumanScore(explorer, side, minGames);
  if (!stats || stats.games < minGames || best == null) return null;
  const deficit = best - stats.score;

  if (moveQuality.lossCp >= ENGINE_DUBIOUS_CP && deficit <= 0.02) {
    return { direction: 'up', stats, deficit };
  }
  if (moveQuality.lossCp < ENGINE_DUBIOUS_CP && deficit >= HUMAN_MISMATCH_DELTA) {
    return { direction: 'down', stats, deficit };
  }
  return null;
}

export function humanBadness(explorer, edge, sourceKey) {
  if (!edge) return null;
  const side = canonicalPosition(sourceKey).split(' ')[1];
  const stats = humanMoveStats(explorer, edge.uci, side);
  const best = bestHumanScore(explorer, side, HUMAN_BAD_SAMPLE_FLOOR);
  if (!stats || stats.games < HUMAN_BAD_SAMPLE_FLOOR || best == null) return null;
  const deficit = best - stats.score;
  return { bad: deficit >= HUMAN_BAD_DELTA, deficit, stats };
}

export function railWorthy({ edge, sourceKey, lichessExplorer, moveQuality }) {
  if (!edge) return false;
  if (edge.manual) return true;
  const popular = (edge.share ?? 0) > POPULAR_BAD_SHARE;
  const games = edge.games ?? humanMoveStats(lichessExplorer, edge.uci, canonicalPosition(sourceKey).split(' ')[1])?.games ?? 0;
  if (games < HUMAN_SAMPLE_FLOOR) return popular;

  const engineBad = (moveQuality?.lossCp ?? -Infinity) >= ENGINE_BAD_CP;
  const humanBad = humanBadness(lichessExplorer, edge, sourceKey)?.bad ?? false;
  if (engineBad || humanBad) return popular;
  return true;
}
