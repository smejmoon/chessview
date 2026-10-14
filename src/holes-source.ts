import { Chess } from 'chess.js';
import { lichessGateway } from './lichess-gateway.ts';
import type { LichessGateway } from './lichess-gateway.ts';

export type TvPosition = Readonly<{ fen: string; ply: number; gameId: string; white: string; black: string }>;
type TvGame = { id?: unknown; variant?: unknown; initialFen?: unknown; moves?: unknown; players?: {
  white?: { user?: { name?: string } }; black?: { user?: { name?: string } };
} };
const CHANNELS = ['blitz', 'rapid', 'classical'] as const;
const pick = (count: number, random: () => number): number =>
  Math.floor(Math.max(0, Math.min(random(), 0.999999999)) * count);

export function sampleTvPosition(data: string, random: () => number = Math.random): TvPosition | null {
  const games: TvGame[] = [];
  for (const line of data.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const game = JSON.parse(line) as TvGame;
      if (game.variant === 'standard' && typeof game.id === 'string'
        && /^[a-zA-Z0-9]{8}$/.test(game.id) && typeof game.moves === 'string'
        && (!game.initialFen || game.initialFen === 'startpos')
        && game.moves.trim().split(/\s+/).length >= 18) games.push(game);
    } catch { /* Skip malformed records. */ }
  }
  if (!games.length) return null;
  const first = pick(games.length, random);
  for (let index = 0; index < games.length; index += 1) {
    const game = games[(first + index) % games.length];
    const moves = (game.moves as string).trim().split(/\s+/);
    const ply = 18 + pick(Math.min(moves.length, 70) - 17, random);
    const chess = new Chess();
    try {
      for (const san of moves.slice(0, ply)) chess.move(san);
      if (chess.isGameOver()) continue;
    } catch { continue; }
    return {
      fen: chess.fen(), ply, gameId: game.id as string,
      white: game.players?.white?.user?.name || 'White',
      black: game.players?.black?.user?.name || 'Black',
    };
  }
  return null;
}

export async function getRandomLichessPosition(
  gateway: LichessGateway = lichessGateway, random: () => number = Math.random,
): Promise<TvPosition> {
  const first = pick(CHANNELS.length, random);
  let lastFailure: unknown = null;
  for (let index = 0; index < CHANNELS.length; index += 1) {
    const channel = CHANNELS[(first + index) % CHANNELS.length];
    try {
      const response = await gateway.request(
        'https://lichess.org/api/tv/' + channel + '?nb=20&moves=true&clocks=false',
        { headers: { Accept: 'application/x-ndjson' } }, { urgency: 'foreground' },
      );
      if (!response.ok) throw new Error('Lichess TV returned HTTP ' + response.status);
      const sample = sampleTvPosition(await response.text(), random);
      if (sample) return sample;
      lastFailure = new Error('No standard game with enough moves on Lichess ' + channel + ' TV');
    } catch (error) { lastFailure = error; }
  }
  throw lastFailure instanceof Error ? lastFailure : new Error('No Lichess position available');
}
