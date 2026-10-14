import { Chess } from 'chess.js';
import type { Color, Square } from 'chess.js';

export type HoleSide = Color;
export type HoleMode = 'undefended' | 'pawn-holes';

// Deliberately bounded exercise: six central files and three ranks per side.
export function trainingZone(side: HoleSide): Square[] {
  const ranks = side === 'w' ? [3, 4, 5] : [4, 5, 6];
  return ranks.flatMap((rank) => [...'bcdefg'].map((file) => (file + rank) as Square));
}

// Conservative structural weakness: any surviving pawn that could attack the
// target after progressing on its present file counts, even if blocked now.
export function canEverBeGuardedByPawn(chess: Chess, side: HoleSide, square: Square): boolean {
  const targetFile = square.charCodeAt(0);
  const targetRank = Number(square[1]);
  for (let rank = 1; rank <= 8; rank += 1) {
    for (const file of 'abcdefgh') {
      if (Math.abs(file.charCodeAt(0) - targetFile) !== 1) continue;
      const piece = chess.get((file + rank) as Square);
      if (piece?.type === 'p' && piece.color === side
        && (side === 'w' ? targetRank > rank : targetRank < rank)) return true;
    }
  }
  return false;
}

export function findHoles(fen: string, side: HoleSide, mode: HoleMode): Set<Square> {
  const chess = new Chess(fen);
  const enemy: HoleSide = side === 'w' ? 'b' : 'w';
  return new Set(trainingZone(side).filter((square) => {
    if (chess.get(square)) return false;
    return mode === 'undefended'
      ? chess.isAttacked(square, enemy) && !chess.isAttacked(square, side)
      : !canEverBeGuardedByPawn(chess, side, square);
  }));
}

export function gradeHoles(marks: ReadonlySet<string>, answers: ReadonlySet<string>) {
  return {
    correct: [...marks].filter((square) => answers.has(square)),
    incorrect: [...marks].filter((square) => !answers.has(square)),
    missed: [...answers].filter((square) => !marks.has(square)),
  };
}
