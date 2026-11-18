import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { canonicalPosition } from '../src/graph.ts';
import { buildRepertoire, compareRepertoires, openingSeeds } from '../prototypes/repertoire-matches/matcher.ts';

function game(id: string, white: string, black: string, moves: string) {
  return { id, rated: true, variant: 'standard', moves,
    players: { white: { user: { id: white } }, black: { user: { id: black } } } };
}

test('builds separate color profiles and counts the very first White and Black decisions', () => {
  const games = [
    game('abcd1234', 'alice', 'bob', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6'),
    game('abcd5678', 'carol', 'alice', 'd4 Nf6 c4 e6 Nc3 Bb4'),
  ];
  const profile = buildRepertoire('Alice', games);
  assert.deepEqual(profile.games, { white: 1, black: 1 });
  const start = canonicalPosition(new Chess().fen());
  assert.equal(profile.positions.white.get(start)?.visits, 1);
  const afterD4 = new Chess();
  afterD4.move('d4');
  assert.equal(profile.positions.black.get(canonicalPosition(afterD4.fen()))?.visits, 1);
  assert.equal(profile.accepted, 2);
});

test('identical openings score higher than divergent openings', () => {
  const user = buildRepertoire('alice', [
    game('abcd1234','alice','opponent','e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7'),
  ]);
  const similar = buildRepertoire('grandmaster', [
    game('abcd5678','grandmaster','opponent','e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7'),
  ]);
  const different = buildRepertoire('other', [
    game('abcd9012','other','opponent','d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7'),
  ]);
  assert.ok(compareRepertoires(user, similar).score > compareRepertoires(user, different).score);
  assert.equal(compareRepertoires(user, similar).coverage, 1);
  assert.equal(compareRepertoires(user, similar).agreement, 1);
});

test('move-choice differences appear as learning opportunities', () => {
  const user = buildRepertoire('alice', [
    game('abcd1234','alice','opponent','e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6'),
  ]);
  const candidate = buildRepertoire('strong', [
    game('abcd5678','strong','opponent','e4 e5 Nc3 Nc6 Bc4 Bc5'),
  ]);
  const match = compareRepertoires(user, candidate);
  assert.ok(match.coverage !== null && match.coverage > 0);
  assert.ok(match.agreement !== null && match.agreement < 1);
  assert.ok(match.differences.some(d => d.userMove === 'Nf3' && d.candidateMove === 'Nc3'));
});

test('color-specific scores separate matching White from divergent Black', () => {
  const own = buildRepertoire('alice', [
    game('abcd1234','alice','bob','e4 e5 Nf3 Nc6 Bb5 a6'),
    game('abcd5678','bob','alice','e4 c5 Nf3 d6 d4 cxd4'),
  ]);
  const their = buildRepertoire('titled', [
    game('abcd9012','titled','bob','e4 e5 Nf3 Nc6 Bb5 a6'),
    game('abcd3456','bob','titled','d4 d5 c4 e6 Nc3 Nf6'),
  ]);
  const match = compareRepertoires(own, their);
  assert.ok((match.bySide.white.score ?? 0) > (match.bySide.black.score ?? 0));
  assert.ok(match.bySide.white.sharedPositions > 0);
});

test('opening-first discovery seeds are frequent, real user-side positions with routes', () => {
  const games = Array.from({ length: 6 }, (_, i) =>
    game('abcdef' + String(i).padStart(2, '0'), 'alice', 'bob', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6'));
  const profile = buildRepertoire('alice', games);
  const seeds = openingSeeds(profile);
  assert.ok(seeds.length >= 1);
  assert.ok(seeds.every(s => s.side === 'white' && s.visits === 6 && s.ply >= 4 && s.ply <= 11));
  assert.ok(seeds.every(s => s.route.startsWith('e4 c5')));
});

test('invalid and excluded games have distinct diagnostic reasons and no partial positions', () => {
  const profile = buildRepertoire('alice', [
    game('abcd1234','alice','bob','e4 e5 Nf3 impossible'),
    { ...game('abcd5678','alice','bob','e4 e5 Nf3 Nc6'), rated: false },
    game('abcd9012','bob','carol','e4 e5'),
    { ...game('abcd3456','alice','bob','e4 e5'), initialFen: 'invalid-fen' },
  ]);
  assert.equal(profile.accepted, 0);
  assert.equal(profile.skipped, 4);
  assert.equal(profile.skippedReasons['invalid-opening-moves'], 1);
  assert.equal(profile.skippedReasons['not-rated'], 1);
  assert.equal(profile.skippedReasons['not-player'], 1);
  assert.equal(profile.skippedReasons['nonstandard-start'], 1);
  assert.equal(profile.positions.white.size, 0);
});

test('transposed move orders share canonical positions', () => {
  const a = new Chess();
  for (const move of ['Nf3','Nf6','g3','g6']) a.move(move);
  const b = new Chess();
  for (const move of ['g3','g6','Nf3','Nf6']) b.move(move);
  assert.equal(canonicalPosition(a.fen()), canonicalPosition(b.fen()));
});

test('empty profiles have no manufactured coverage or agreement', () => {
  const a = buildRepertoire('alice', []);
  const b = buildRepertoire('bob', []);
  const result = compareRepertoires(a, b);
  assert.equal(result.coverage, null);
  assert.equal(result.agreement, null);
  assert.equal(result.bySide.white.score, null);
  assert.equal(result.score, 0);
});
