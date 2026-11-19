import { Chess } from 'chess.js';
import { toPlayableFen } from '../../src/graph.ts';
import type { OpeningSeed, Repertoire, SharedPosition, Side } from './matcher.ts';
import type { PlayerBranchProbe } from './lichess-source.ts';

export type PositionEvidence = {
  side: Side;
  key: string;
  route: string;
  ply: number;
  userGames: number;
  candidateGames: number | null;
  status: 'confirmed' | 'rare' | 'absent' | 'partial' | 'timeout' | 'unavailable' | 'not-checked';
  agreement: number | null;
  userMove: string | null;
  candidateMove: string | null;
  checked: boolean;
};
export type PositionSideMatch = {
  score: number | null;
  coverage: number | null;
  overlap: number | null;
  agreement: number | null;
  userGames: number;
  selectedPositions: number;
  checkedPositions: number;
  confirmedPositions: number;
  partialPositions: number;
  observedGames: number;
};
export type PositionComparison = {
  score: number;
  coverage: number | null;
  overlap: number | null;
  agreement: number | null;
  bySide: Record<Side, PositionSideMatch>;
  positions: PositionEvidence[];
  shared: SharedPosition[];
  differences: SharedPosition[];
};

/** Fixed-depth, color-to-move canonical positions; opening labels are routes, not identities. */
export function frequentPositions(user: Repertoire, perDepth = 5): OpeningSeed[] {
  const selected: OpeningSeed[] = [];
  for (const side of ['white', 'black'] as Side[]) {
    // At 8/10 plies of opening development the player must be next to move.
    // White moves at even zero-based ply indices 8 and 10; Black at 7 and 9.
    for (const ply of (side === 'white' ? [8, 10] : [7, 9])) {
      const options = [...user.positions[side].entries()]
        .filter(([, p]) => p.visits >= 3 && p.plyTotal === ply * p.visits)
        .sort((a, b) => b[1].visits - a[1].visits || a[0].localeCompare(b[0]));
      for (const [key, p] of options.slice(0, perDepth)) {
        if (!selected.some(s => s.side === side && s.key === key)) {
          selected.push({ side, key, route: p.route.join(' '), visits: p.visits, ply });
        }
      }
    }
  }
  return selected;
}
const weightOf = (visits: number, ply: number) => visits * (1 + Math.min(1.5, ply / 10));
const MIN_GAMES = 3;

function sanOf(key: string, uci: string): string {
  try {
    const move = new Chess(toPlayableFen(key)).move({
      from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || undefined,
    });
    return move.san;
  } catch { return uci; }
}

/**
 * Only complete Player Explorer snapshots count. Missing checks are unknown,
 * not observed zeros. Score is conservative supporting evidence across ALL
 * selected user positions. 'coverage' = share actually checked (not overlap);
 * supported positions and move agreement are independent reported evidence.
 */
export function comparePositionStats(
  user: Repertoire, seeds: OpeningSeed[], probes: PlayerBranchProbe[],
): PositionComparison {
  const results: PositionEvidence[] = [];
  const shared: SharedPosition[] = [];
  const bySide = {} as Record<Side, PositionSideMatch>;
  let allWeight = 0, checkedWeight = 0, supportedWeight = 0, agreementWeight = 0;
  for (const side of ['white', 'black'] as Side[]) {
    const ownSeeds = seeds.filter(s => s.side === side);
    let total = 0, checked = 0, supported = 0, agreed = 0, checkedPositions = 0;
    let confirmedPositions = 0, partialPositions = 0, observedGames = 0;
    for (const seed of ownSeeds) {
      const choice = user.positions[side].get(seed.key);
      if (!choice) continue;
      const weight = weightOf(choice.visits, seed.ply);
      total += weight;
      const probe = probes.find(p => p.side === side && p.key === seed.key);
      const complete = probe?.status === 'complete' && probe.snapshotGames !== null;
      const n = probe?.snapshotGames ?? null;
      if (complete) { checked += weight; checkedPositions++; }
      else if (probe && probe.status !== 'unavailable') partialPositions++;
      const result: PositionEvidence = {
        side, key: seed.key, route: seed.route, ply: seed.ply,
        userGames: choice.visits, candidateGames: n,
        status: !probe ? 'not-checked' : !complete ?
          (probe.status === 'complete' ? 'partial' : probe.status) :
          n! >= MIN_GAMES ? 'confirmed' : n! ? 'rare' : 'absent',
        agreement: null, userMove: null, candidateMove: null, checked: complete,
      };
      if (complete && n! >= MIN_GAMES) {
        supported += weight;
        confirmedPositions++;
        observedGames += n!;
        let agreement = 0;
        const candidateMoves = new Map(probe!.moves.map(m => [m.uci, m.games]));
        for (const [uci, ownMove] of choice.moves) {
          agreement += (ownMove.count / choice.visits) * ((candidateMoves.get(uci) ?? 0) / n!);
        }
        result.agreement = agreement;
        agreed += weight * agreement;
        const ownTop = [...choice.moves].sort((a, b) => b[1].count - a[1].count)[0];
        const otherTop = [...probe!.moves].sort((a, b) => b.games - a.games)[0];
        if (ownTop && otherTop) {
          result.userMove = sanOf(seed.key, ownTop[0]);
          result.candidateMove = otherTop.san;
          shared.push({
            side, key: seed.key, route: seed.route, ply: seed.ply,
            visits: choice.visits, candidateVisits: n!,
            userMove: result.userMove, candidateMove: result.candidateMove,
            userShare: ownTop[1].count / choice.visits, candidateShare: otherTop.games / n!,
            exampleGame: '', agreement, weight,
          });
        }
      }
      results.push(result);
    }
    bySide[side] = {
      score: checkedPositions && total ?
        Math.round(100 * (0.65 * supported + 0.35 * agreed) / total) : null,
      coverage: checkedPositions && total ? checked / total : null,
      overlap: checked ? supported / checked : null,
      agreement: supported ? agreed / supported : null,
      userGames: user.games[side], selectedPositions: ownSeeds.length,
      checkedPositions, confirmedPositions, partialPositions, observedGames,
    };
    allWeight += total;
    checkedWeight += checked;
    supportedWeight += supported;
    agreementWeight += agreed;
  }
  const sorted = shared.sort((a, b) => b.weight - a.weight);
  return {
    score: checkedWeight && allWeight ?
      Math.round(100 * (0.65 * supportedWeight + 0.35 * agreementWeight) / allWeight) : 0,
    coverage: allWeight ? checkedWeight / allWeight : null,
    overlap: checkedWeight ? supportedWeight / checkedWeight : null,
    agreement: supportedWeight ? agreementWeight / supportedWeight : null,
    bySide, positions: results, shared: sorted.slice(0, 16),
    differences: sorted.filter(p => p.userMove !== p.candidateMove).slice(0, 12),
  };
}
