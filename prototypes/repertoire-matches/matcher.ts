import { Chess } from 'chess.js';
import { canonicalPosition } from '../../src/graph.ts';

export type Side = 'white' | 'black';
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
  moves: Map<string, { count: number; gameId: string }>;
};
export type Repertoire = {
  player: string;
  games: Record<Side, number>;
  positions: Record<Side, Map<string, PositionChoice>>;
  accepted: number;
  skipped: number;
};
export type SharedPosition = {
  side: Side;
  key: string;
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
};

const MAX_OPENING_PLIES = 24;
const MIN_DECISION_PLY = 2;
const START = canonicalPosition(new Chess().fen());

function sideOf(game: GameRecord, username: string): Side | null {
  const id = username.toLowerCase();
  if (game.players?.white?.user?.id?.toLowerCase() === id ||
      game.players?.white?.user?.name?.toLowerCase() === id) return 'white';
  if (game.players?.black?.user?.id?.toLowerCase() === id ||
      game.players?.black?.user?.name?.toLowerCase() === id) return 'black';
  return null;
}

function weightForPly(ply: number): number {
  return 1 + Math.min(2.5, Math.max(0, (ply - 4) / 6));
}

export function buildRepertoire(player: string, games: readonly GameRecord[]): Repertoire {
  const repertoire: Repertoire = {
    player, games: { white: 0, black: 0 },
    positions: { white: new Map(), black: new Map() },
    accepted: 0, skipped: 0,
  };
  for (const game of games) {
    const side = sideOf(game, player);
    if (!side || game.variant !== 'standard' || game.rated !== true ||
        !/^[A-Za-z0-9]{8}$/.test(game.id ?? '') || typeof game.moves !== 'string') {
      repertoire.skipped++;
      continue;
    }
    try {
      if (game.initialFen && game.initialFen !== 'startpos' &&
          canonicalPosition(game.initialFen) !== START) {
        repertoire.skipped++;
        continue;
      }
      const board = new Chess();
      const choices: { key: string; ply: number; uci: string }[] = [];
      const sanMoves = game.moves.trim().split(/\s+/);
      const seen = new Set<string>();
      for (let ply = 0; ply < Math.min(sanMoves.length, MAX_OPENING_PLIES); ply++) {
        const key = canonicalPosition(board.fen());
        const move = board.move(sanMoves[ply]);
        if (!move) throw new Error('Invalid SAN');
        if (ply >= MIN_DECISION_PLY &&
            (side === 'white' ? ply % 2 === 0 : ply % 2 === 1) && !seen.has(key)) {
          seen.add(key);
          choices.push({ key, ply, uci: move.from + move.to + (move.promotion ?? '') });
        }
      }
      // Commit only a completely validated opening prefix: malformed games never contribute partial data.
      for (const choice of choices) {
        let item = repertoire.positions[side].get(choice.key);
        if (!item) {
          item = { visits: 0, plyTotal: 0, moves: new Map() };
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
      repertoire.skipped++;
    }
  }
  return repertoire;
}

function topMove(choice: PositionChoice) {
  return [...choice.moves.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))[0];
}

export function compareRepertoires(user: Repertoire, candidate: Repertoire): RepertoireMatch {
  const bySide = {} as Record<Side, SideMatch>;
  const shared: SharedPosition[] = [];
  let totalWeight = 0, coveredWeight = 0, agreedWeight = 0;
  for (const side of ['white', 'black'] as const) {
    const own = user.positions[side];
    const theirs = candidate.positions[side];
    let sideWeight = 0, sideCovered = 0, sideAgreed = 0, sharedPositions = 0;
    for (const [key, ownChoice] of own) {
      const ply = ownChoice.plyTotal / ownChoice.visits;
      const weight = ownChoice.visits * weightForPly(ply);
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
        side, key, ply, visits: ownChoice.visits, candidateVisits: otherChoice.visits,
        userMove: ours[0], candidateMove: other[0],
        userShare: ours[1].count / ownChoice.visits,
        candidateShare: other[1].count / otherChoice.visits,
        exampleGame: other[1].gameId,
        agreement: probability, weight,
      });
    }
    bySide[side] = {
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
  shared.sort((a, b) => b.weight * (0.5 + b.agreement) - a.weight * (0.5 + a.agreement) ||
    a.key.localeCompare(b.key));
  // A player cannot score highly from agreement in just one rarely reached position.
  const score = totalWeight ? Math.round(100 * (0.7 * coveredWeight + 0.3 * agreedWeight) / totalWeight) : 0;
  return { score, coverage, agreement, bySide, shared: shared.slice(0, 12) };
}
