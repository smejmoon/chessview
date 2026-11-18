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
export type Repertoire = {
  player: string;
  games: Record<Side, number>;
  positions: Record<Side, Map<string, PositionChoice>>;
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
      const choices: { key: string; ply: number; uci: string; route: string[] }[] = [];
      const sanMoves = game.moves.trim().split(/\s+/);
      const route: string[] = [];
      const seen = new Set<string>();
      for (let ply = 0; ply < Math.min(sanMoves.length, MAX_OPENING_PLIES); ply++) {
        const key = canonicalPosition(board.fen());
        const move = board.move(sanMoves[ply]);
        if (!move) throw new Error('Invalid SAN');
        if ((side === 'white' ? ply % 2 === 0 : ply % 2 === 1) && !seen.has(key)) {
          seen.add(key);
          choices.push({ key, ply, uci: move.from + move.to + (move.promotion ?? ''), route: [...route] });
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
