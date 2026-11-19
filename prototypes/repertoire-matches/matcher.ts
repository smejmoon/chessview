import { Chess } from 'chess.js';
import { canonicalPosition, toPlayableFen } from '../../src/graph.ts';

export type Side = 'white' | 'black';
export type SkipReason = 'not-player' | 'not-standard' | 'not-rated' | 'invalid-id' |
  'missing-moves' | 'nonstandard-start' | 'invalid-opening-moves';
export type GameRecord = {
  id?: string;
  variant?: string;
  rated?: boolean;
  initialFen?: string;
  moves?: string;
  players?: {
    white?: { user?: { id?: string; name?: string } };
    black?: { user?: { id?: string; name?: string } };
  };
};
export type PositionChoice = {
  visits: number;
  plyTotal: number;
  route: string[];
  moves: Map<string, { count: number; gameId: string }>;
};
export type GameLine = { choices: { key: string; ply: number; uci: string; route: string[]; gameId: string }[] };
export type Repertoire = {
  player: string;
  games: Record<Side, number>;
  positions: Record<Side, Map<string, PositionChoice>>;
  lines: Record<Side, GameLine[]>;
  accepted: number;
  skipped: number;
  skippedReasons: Record<SkipReason, number>;
};
export type OpeningSeed = {
  side: Side;
  key: string;
  ply: number;
  visits: number;
  route: string;
  originKey?: string;
  originRoute?: string;
};
export type SharedPosition = {
  side: Side;
  key: string;
  route: string;
  ply: number;
  visits: number;
  candidateVisits: number;
  userMove: string;
  candidateMove: string;
  userShare: number;
  candidateShare: number;
  exampleGame: string;
  agreement: number;
  weight: number;
};
export type SideMatch = {
  score: number | null;
  coverage: number | null;
  agreement: number | null;
  sharedPositions: number;
  profilePositions: number;
  userGames: number;
  candidateGames: number;
};
export type RepertoireMatch = {
  score: number;
  coverage: number | null;
  agreement: number | null;
  bySide: Record<Side, SideMatch>;
  shared: SharedPosition[];
  differences: SharedPosition[];
};

const MAX_OPENING_PLIES = 18;
const START = canonicalPosition(new Chess().fen());
const SIDES: Side[] = ['white', 'black'];
const SKIP_REASONS: SkipReason[] = [
  'not-player', 'not-standard', 'not-rated', 'invalid-id', 'missing-moves',
  'nonstandard-start', 'invalid-opening-moves',
];

function sideOf(game: GameRecord, username: string): Side | null {
  const id = username.toLowerCase();
  for (const side of SIDES) {
    const user = game.players?.[side]?.user;
    if (user?.id?.toLowerCase() === id || user?.name?.toLowerCase() === id) return side;
  }
  return null;
}

function depthWeight(ply: number): number {
  // First White/Black decisions count; depth gains weight without dominating coverage.
  return 1 + Math.min(1.5, ply / 10);
}

function excluded(repertoire: Repertoire, reason: SkipReason) {
  repertoire.skipped++;
  repertoire.skippedReasons[reason]++;
}

export function buildRepertoire(player: string, games: readonly GameRecord[]): Repertoire {
  const skippedReasons = Object.fromEntries(SKIP_REASONS.map(k => [k, 0])) as Record<SkipReason, number>;
  const repertoire: Repertoire = {
    player, games: { white: 0, black: 0 },
    positions: { white: new Map(), black: new Map() },
    lines: { white: [], black: [] },
    accepted: 0, skipped: 0, skippedReasons,
  };
  for (const game of games) {
    const side = sideOf(game, player);
    if (!side) { excluded(repertoire, 'not-player'); continue; }
    if (game.variant !== 'standard') { excluded(repertoire, 'not-standard'); continue; }
    if (game.rated !== true) { excluded(repertoire, 'not-rated'); continue; }
    if (!/^[A-Za-z0-9]{8}$/.test(game.id ?? '')) { excluded(repertoire, 'invalid-id'); continue; }
    if (typeof game.moves !== 'string' || !game.moves.trim()) {
      excluded(repertoire, 'missing-moves'); continue;
    }
    try {
      if (game.initialFen && game.initialFen !== 'startpos' &&
          canonicalPosition(game.initialFen) !== START) {
        excluded(repertoire, 'nonstandard-start');
        continue;
      }
    } catch {
      excluded(repertoire, 'nonstandard-start');
      continue;
    }
    try {
      const board = new Chess();
      const choices: GameLine['choices'] = [];
      const sanMoves = game.moves.trim().split(/\s+/);
      const route: string[] = [];
      const seen = new Set<string>();
      for (let ply = 0; ply < Math.min(sanMoves.length, MAX_OPENING_PLIES); ply++) {
        const key = canonicalPosition(board.fen());
        const move = board.move(sanMoves[ply]);
        if (!move) throw new Error('Invalid SAN');
        if ((side === 'white' ? ply % 2 === 0 : ply % 2 === 1) && !seen.has(key)) {
          seen.add(key);
          choices.push({ key, ply, uci: move.from + move.to + (move.promotion ?? ''), route: [...route], gameId: game.id! });
        }
        route.push(move.san);
      }
      // Transactional: malformed opening prefixes never contribute partial counts.
      for (const choice of choices) {
        let item = repertoire.positions[side].get(choice.key);
        if (!item) {
          item = { visits: 0, plyTotal: 0, route: choice.route, moves: new Map() };
          repertoire.positions[side].set(choice.key, item);
        }
        item.visits++;
        item.plyTotal += choice.ply;
        const existing = item.moves.get(choice.uci);
        item.moves.set(choice.uci, { count: (existing?.count ?? 0) + 1, gameId: existing?.gameId ?? game.id! });
      }
      repertoire.lines[side].push({ choices });
      repertoire.games[side]++;
      repertoire.accepted++;
    } catch {
      excluded(repertoire, 'invalid-opening-moves');
    }
  }
  return repertoire;
}

function topMove(choice: PositionChoice) {
  return [...choice.moves.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))[0];
}

function asSan(key: string, uci: string): string {
  try {
    const move = new Chess(toPlayableFen(key)).move({
      from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || undefined,
    });
    return move.san;
  } catch { return uci; }
}

export function openingSeeds(user: Repertoire, perSide = 4): OpeningSeed[] {
  const seeds: OpeningSeed[] = [];
  for (const side of SIDES) {
    const options = [...user.positions[side].entries()]
      .map(([key, p]) => ({
        side, key, ply: p.plyTotal / p.visits, visits: p.visits,
        route: p.route.join(' '), group: p.route.slice(0, 4).join(' '),
      }))
      .filter(p => p.ply >= 4 && p.ply <= 11 && p.visits >= 2)
      .sort((a, b) => b.visits - a.visits || b.ply - a.ply);
    const groups = new Map<string, number>();
    for (const option of options) {
      if ((groups.get(option.group) ?? 0) >= 1) continue;
      seeds.push(option);
      groups.set(option.group, 1);
      if (groups.size === perSide) break;
    }
    // Fill remaining slots from alternate depths of common branches, at most twice per branch.
    let taken = groups.size;
    for (const option of options) {
      if (taken >= perSide) break;
      if (seeds.some(s => s.side === side && s.key === option.key)) continue;
      if ((groups.get(option.group) ?? 0) >= 2) continue;
      seeds.push(option);
      groups.set(option.group, (groups.get(option.group) ?? 0) + 1);
      taken++;
    }
  }
  return seeds;
}


/**
 * One deeper discovery position per scoring branch. This widens the sparse
 * representative-game candidate index without expanding the scoring branches.
 * Parentage follows canonical positions in observed games, not SAN prefixes.
 */
export function openingFollowups(user: Repertoire, roots: OpeningSeed[]): OpeningSeed[] {
  const followups: OpeningSeed[] = [];
  for (const root of roots) {
    const descendants = new Map<string, { visits: number; ply: number; route: string }>();
    for (const line of user.lines[root.side]) {
      const index = line.choices.findIndex(choice => choice.key === root.key);
      if (index < 0) continue;
      for (const choice of line.choices.slice(index + 1)) {
        if (choice.ply <= root.ply + 1 || choice.ply > 11 ||
            roots.some(seed => seed.side === root.side && seed.key === choice.key)) continue;
        const previous = descendants.get(choice.key);
        descendants.set(choice.key, {
          visits: (previous?.visits ?? 0) + 1, ply: choice.ply,
          route: choice.route.join(' '),
        });
      }
    }
    const next = [...descendants.entries()]
      .filter(([, data]) => data.visits >= 3)
      .sort((a, b) => b[1].visits - a[1].visits ||
        b[1].ply - a[1].ply || a[0].localeCompare(b[0]))[0];
    if (!next) continue;
    followups.push({
      side: root.side, key: next[0], route: next[1].route,
      visits: next[1].visits, ply: next[1].ply,
      originKey: root.key, originRoute: root.route,
    });
  }
  return followups;
}

export function compareRepertoires(user: Repertoire, candidate: Repertoire): RepertoireMatch {
  const bySide = {} as Record<Side, SideMatch>;
  const shared: SharedPosition[] = [];
  let totalWeight = 0, coveredWeight = 0, agreedWeight = 0;
  for (const side of SIDES) {
    const own = user.positions[side];
    const theirs = candidate.positions[side];
    let sideWeight = 0, sideCovered = 0, sideAgreed = 0, sharedPositions = 0;
    for (const [key, ownChoice] of own) {
      const ply = ownChoice.plyTotal / ownChoice.visits;
      const weight = ownChoice.visits * depthWeight(ply);
      sideWeight += weight;
      const otherChoice = theirs.get(key);
      if (!otherChoice) continue;
      sharedPositions++;
      sideCovered += weight;
      let probability = 0;
      for (const [uci, move] of ownChoice.moves) {
        probability += (move.count / ownChoice.visits) *
          ((otherChoice.moves.get(uci)?.count ?? 0) / otherChoice.visits);
      }
      sideAgreed += weight * probability;
      const ours = topMove(ownChoice);
      const other = topMove(otherChoice);
      shared.push({
        side, key, route: ownChoice.route.join(' '), ply, visits: ownChoice.visits,
        candidateVisits: otherChoice.visits,
        userMove: asSan(key, ours[0]), candidateMove: asSan(key, other[0]),
        userShare: ours[1].count / ownChoice.visits,
        candidateShare: other[1].count / otherChoice.visits,
        exampleGame: other[1].gameId, agreement: probability, weight,
      });
    }
    bySide[side] = {
      score: sideWeight ? Math.round(100 * (0.7 * sideCovered + 0.3 * sideAgreed) / sideWeight) : null,
      coverage: sideWeight ? sideCovered / sideWeight : null,
      agreement: sideCovered ? sideAgreed / sideCovered : null,
      sharedPositions, profilePositions: own.size,
      userGames: user.games[side], candidateGames: candidate.games[side],
    };
    totalWeight += sideWeight;
    coveredWeight += sideCovered;
    agreedWeight += sideAgreed;
  }
  const coverage = totalWeight ? coveredWeight / totalWeight : null;
  const agreement = coveredWeight ? agreedWeight / coveredWeight : null;
  const score = totalWeight ? Math.round(100 * (0.7 * coveredWeight + 0.3 * agreedWeight) / totalWeight) : 0;
  const byWeight = (a: SharedPosition, b: SharedPosition) =>
    b.weight - a.weight || a.key.localeCompare(b.key);
  return {
    score, coverage, agreement, bySide,
    shared: shared.slice().sort(byWeight).slice(0, 16),
    differences: shared.filter(p => p.userMove !== p.candidateMove)
      .sort((a, b) => b.weight * (1 - b.agreement) - a.weight * (1 - a.agreement))
      .slice(0, 12),
  };
}

/**
 * Branch-specific evidence from at most 18 plies per accepted game.
 * Assign each game to its deepest reached seed (one branch per color/game).
 * All membership and move joins use canonical board positions, not SAN paths.
 */
export type BranchMatch = {
  side: Side;
  key: string;
  route: string;
  userGames: number;
  candidateGames: number;
  candidateSideGames: number;
  userPositions: number;
  observedPositions: number;
  supportedPositions: number;
  coverage: number | null;
  agreement: number | null;
  score: number | null;
  evidence: 'confirmed' | 'sparse' | 'not-observed';
  choices: SharedPosition[];
};
export type BranchComparison = RepertoireMatch & { branches: BranchMatch[] };

const MIN_BRANCH_GAMES = 3;
const MIN_POSITION_GAMES = 3;

function partitionLines(profile: Repertoire, seeds: OpeningSeed[]): Map<string, GameLine[]> {
  const result = new Map<string, GameLine[]>(seeds.map(seed => [seed.key, []]));
  for (const side of SIDES) {
    const roots = seeds.filter(seed => seed.side === side)
      .sort((a, b) => b.ply - a.ply || a.key.localeCompare(b.key));
    for (const line of profile.lines[side]) {
      const chosen = roots.find(seed => line.choices.some(choice => choice.key === seed.key));
      if (!chosen) continue;
      const index = line.choices.findIndex(choice => choice.key === chosen.key);
      result.get(chosen.key)!.push({ choices: line.choices.slice(index) });
    }
  }
  return result;
}

function summarizeLines(lines: GameLine[]): Map<string, PositionChoice> {
  const positions = new Map<string, PositionChoice>();
  for (const line of lines) {
    for (const choice of line.choices) {
      let position = positions.get(choice.key);
      if (!position) {
        position = { visits: 0, plyTotal: 0, route: choice.route, moves: new Map() };
        positions.set(choice.key, position);
      }
      position.visits++;
      position.plyTotal += choice.ply;
      const previous = position.moves.get(choice.uci);
      position.moves.set(choice.uci, {
        count: (previous?.count ?? 0) + 1,
        gameId: previous?.gameId ?? choice.gameId,
      });
    }
  }
  return positions;
}

/**
 * A score is available only after at least three candidate games reach a branch.
 * Choices with fewer than three candidate observations are excluded from the
 * numerator, never presented as precise move agreement. Missing branches remain
 * explicitly unconfirmed (not a claim about the candidate's lifetime repertoire).
 */
export function compareBranchRepertoires(
  user: Repertoire, candidate: Repertoire, seeds: OpeningSeed[] = openingSeeds(user),
): BranchComparison {
  const ownGroups = partitionLines(user, seeds);
  const candidateGroups = partitionLines(candidate, seeds);
  const branches: BranchMatch[] = [];
  const shared: SharedPosition[] = [];
  for (const seed of seeds) {
    const ourLines = ownGroups.get(seed.key) ?? [];
    const theirLines = candidateGroups.get(seed.key) ?? [];
    const ours = summarizeLines(ourLines);
    const theirs = summarizeLines(theirLines);
    const confirmed = ourLines.length >= 2 && theirLines.length >= MIN_BRANCH_GAMES;
    let total = 0, covered = 0, agreed = 0, observed = 0, supported = 0;
    const choices: SharedPosition[] = [];
    for (const [key, ownChoice] of ours) {
      const ply = ownChoice.plyTotal / ownChoice.visits;
      const weight = ownChoice.visits * depthWeight(ply);
      total += weight;
      const otherChoice = theirs.get(key);
      if (!otherChoice) continue;
      observed++;
      if (!confirmed || otherChoice.visits < MIN_POSITION_GAMES) continue;
      supported++;
      covered += weight;
      let probability = 0;
      for (const [uci, move] of ownChoice.moves) {
        probability += (move.count / ownChoice.visits) *
          ((otherChoice.moves.get(uci)?.count ?? 0) / otherChoice.visits);
      }
      agreed += weight * probability;
      const oursTop = topMove(ownChoice);
      const otherTop = topMove(otherChoice);
      const position: SharedPosition = {
        side: seed.side, key, route: ownChoice.route.join(' '), ply,
        visits: ownChoice.visits, candidateVisits: otherChoice.visits,
        userMove: asSan(key, oursTop[0]), candidateMove: asSan(key, otherTop[0]),
        userShare: oursTop[1].count / ownChoice.visits,
        candidateShare: otherTop[1].count / otherChoice.visits,
        exampleGame: otherTop[1].gameId, agreement: probability, weight,
      };
      choices.push(position);
      shared.push(position);
    }
    const coverage = confirmed && total ? covered / total : null;
    const agreement = confirmed && covered ? agreed / covered : null;
    branches.push({
      side: seed.side, key: seed.key, route: seed.route,
      userGames: ourLines.length, candidateGames: theirLines.length,
      candidateSideGames: candidate.games[seed.side],
      userPositions: ours.size, observedPositions: observed, supportedPositions: supported,
      coverage, agreement,
      score: confirmed && total ? Math.round(100 * (0.65 * covered + 0.35 * agreed) / total) : null,
      evidence: confirmed ? 'confirmed' : theirLines.length ? 'sparse' : 'not-observed',
      choices: choices.sort((a, b) => b.weight - a.weight).slice(0, 8),
    });
  }
  const bySide = {} as Record<Side, SideMatch>;
  let totalWeight = 0, totalCovered = 0, totalAgreed = 0, anyConfirmed = false;
  for (const side of SIDES) {
    const ownBranches = branches.filter(b => b.side === side);
    const weight = ownBranches.reduce((sum, b) => sum + b.userGames, 0);
    const confirmed = ownBranches.filter(b => b.evidence === 'confirmed');
    let covered = 0, agreed = 0;
    for (const branch of confirmed) {
      covered += branch.userGames * (branch.coverage ?? 0);
      agreed += branch.userGames * (branch.coverage ?? 0) * (branch.agreement ?? 0);
    }
    if (confirmed.length) anyConfirmed = true;
    bySide[side] = {
      score: confirmed.length && weight ?
        Math.round(100 * (0.65 * covered + 0.35 * agreed) / weight) : null,
      coverage: confirmed.length && weight ? covered / weight : null,
      agreement: covered ? agreed / covered : null,
      sharedPositions: confirmed.reduce((sum, b) => sum + b.supportedPositions, 0),
      profilePositions: ownBranches.reduce((sum, b) => sum + b.userPositions, 0),
      userGames: user.games[side], candidateGames: candidate.games[side],
    };
    totalWeight += weight;
    totalCovered += covered;
    totalAgreed += agreed;
  }
  const sortByWeight = (a: SharedPosition, b: SharedPosition) =>
    b.weight - a.weight || a.key.localeCompare(b.key);
  return {
    branches, bySide,
    score: anyConfirmed && totalWeight ?
      Math.round(100 * (0.65 * totalCovered + 0.35 * totalAgreed) / totalWeight) : 0,
    coverage: anyConfirmed && totalWeight ? totalCovered / totalWeight : null,
    agreement: totalCovered ? totalAgreed / totalCovered : null,
    shared: shared.slice().sort(sortByWeight).slice(0, 16),
    differences: shared.filter(p => p.userMove !== p.candidateMove)
      .sort((a, b) => b.weight * (1 - b.agreement) - a.weight * (1 - a.agreement))
      .slice(0, 12),
  };
}
