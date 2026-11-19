import { Chess } from 'chess.js';
import { toPlayableFen } from '../../src/graph.ts';
import type { Repertoire, Side } from './matcher.ts';

export type PositionExportFilter = {
  side: Side | 'both';
  depth: number | null;
  minGames: number;
};

type ExportPosition = {
  side: Side;
  key: string;
  route: string;
  plies: number[];
  games: number;
  shareOfColorGames: number;
  moves: { uci: string; san: string; games: number; share: number; exampleGameId: string }[];
};

type Aggregate = {
  side: Side;
  key: string;
  route: string;
  plies: Set<number>;
  games: number;
  moves: Map<string, { games: number; exampleGameId: string }>;
};

function sanAt(key: string, uci: string): string {
  try {
    return new Chess(toPlayableFen(key)).move({
      from: uci.slice(0, 2), to: uci.slice(2, 4),
      promotion: uci.slice(4) || undefined,
    }).san;
  } catch {
    return uci;
  }
}

/**
 * Aggregate only recorded opening decisions. Position identity is canonical:
 * transposed move orders contribute to the same key within a color.
 * Depth N means White's decision at ply N and Black's decision at ply N-1,
 * placing the decisions at approximately the same point of development.
 */
export function createPositionExport(
  profile: Repertoire, filter: PositionExportFilter,
  context: { months: number; gameLimit: number; exportedAt: string },
) {
  if (filter.depth !== null &&
      (!Number.isInteger(filter.depth) || filter.depth < 2 ||
        filter.depth > 16 || filter.depth % 2 !== 0)) {
    throw new Error('Depth must be an even ply from 2 to 16, or All');
  }
  if (!Number.isInteger(filter.minGames) || filter.minGames < 1) {
    throw new Error('Minimum games must be a positive integer');
  }
  const groups = new Map<string, Aggregate>();
  for (const side of ['white', 'black'] as Side[]) {
    if (filter.side !== 'both' && filter.side !== side) continue;
    const targetPly = filter.depth === null ? null :
      filter.depth - (side === 'black' ? 1 : 0);
    for (const line of profile.lines[side]) {
      for (const choice of line.choices) {
        if (targetPly !== null && choice.ply !== targetPly) continue;
        const id = side + ':' + choice.key;
        let aggregate = groups.get(id);
        if (!aggregate) {
          aggregate = {
            side, key: choice.key, route: choice.route.join(' '),
            plies: new Set<number>(), games: 0, moves: new Map(),
          };
          groups.set(id, aggregate);
        }
        aggregate.games++;
        aggregate.plies.add(choice.ply);
        const item = aggregate.moves.get(choice.uci);
        aggregate.moves.set(choice.uci, {
          games: (item?.games ?? 0) + 1,
          exampleGameId: item?.exampleGameId ?? choice.gameId,
        });
      }
    }
  }
  const positions: ExportPosition[] = [...groups.values()]
    .filter(item => item.games >= filter.minGames)
    .map(item => ({
      side: item.side, key: item.key, route: item.route,
      plies: [...item.plies].sort((a, b) => a - b),
      games: item.games,
      shareOfColorGames: profile.games[item.side] ?
        item.games / profile.games[item.side] : 0,
      moves: [...item.moves.entries()]
        .map(([uci, move]) => ({
          uci, san: sanAt(item.key, uci), games: move.games,
          share: move.games / item.games, exampleGameId: move.exampleGameId,
        }))
        .sort((a, b) => b.games - a.games || a.uci.localeCompare(b.uci)),
    }))
    .sort((a, b) => b.games - a.games ||
      a.side.localeCompare(b.side) || a.key.localeCompare(b.key));
  return {
    schemaVersion: 'repertoire-positions-1',
    exportedAt: context.exportedAt,
    player: profile.player,
    source: {
      historyMonths: context.months, maxExportedGames: context.gameLimit,
      acceptedGames: profile.accepted, skippedGames: profile.skipped,
      colorGames: { ...profile.games },
    },
    filter: {
      ...filter,
      whitePly: filter.depth,
      blackPly: filter.depth === null ? null : filter.depth - 1,
    },
    summary: {
      positions: positions.length,
      white: positions.filter(p => p.side === 'white').length,
      black: positions.filter(p => p.side === 'black').length,
    },
    positions,
  };
}

/** Produce strict JSON with an actual trailing newline, not a literal \n token. */
export function serializePositionExport(report: ReturnType<typeof createPositionExport>): string {
  return JSON.stringify(report, null, 2) + '\n';
}
