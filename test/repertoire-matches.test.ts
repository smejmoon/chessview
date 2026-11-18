import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { canonicalPosition } from '../src/graph.ts';
import { buildRepertoire, compareRepertoires } from '../prototypes/repertoire-matches/matcher.ts';

function game(id: string, white: string, black: string, moves: string) {
  return { id, rated: true, variant: 'standard', moves,
    players: { white: { user: { id: white } }, black: { user: { id: black } } } };
}

test('constructs separate white and black repertoires from signed-in player games', () => {
  const games = [
    game('abcd1234', 'alice', 'bob', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6'),
    game('abcd5678', 'carol', 'alice', 'd4 Nf6 c4 e6 Nc3 Bb4'),
  ];
  const profile = buildRepertoire('Alice', games);
  assert.deepEqual(profile.games, { white: 1, black: 1 });
  assert.ok(profile.positions.white.size > 0);
  assert.ok(profile.positions.black.size > 0);
});

test('similar openings score higher than divergent ones', () => {
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

test('move-choice differences reduce agreement without removing position overlap', () => {
  const user = buildRepertoire('alice', [
    game('abcd1234','alice','opponent','e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6'),
  ]);
  const candidate = buildRepertoire('strong', [
    game('abcd5678','strong','opponent','e4 e5 Nc3 Nc6 Bc4 Bc5'),
  ]);
  const match = compareRepertoires(user, candidate);
  assert.ok(match.coverage !== null && match.coverage > 0);
  assert.ok(match.agreement !== null && match.agreement < 1);
});

test('rejects malformed games without admitting partial positions', () => {
  const profile = buildRepertoire('alice', [
    game('abcd1234','alice','bob','e4 e5 Nf3 impossible'),
    { ...game('abcd5678','alice','bob','e4 e5 Nf3 Nc6'), rated: false },
  ]);
  assert.equal(profile.accepted, 0);
  assert.equal(profile.skipped, 2);
  assert.equal(profile.positions.white.size, 0);
});

test('transpositions share canonical position keys', () => {
  const a = new Chess();
  for (const move of ['Nf3','Nf6','g3','g6']) a.move(move);
  const b = new Chess();
  for (const move of ['g3','g6','Nf3','Nf6']) b.move(move);
  assert.equal(canonicalPosition(a.fen()), canonicalPosition(b.fen()));
});

test('empty profiles report missing coverage instead of fabricated agreement', () => {
  const a = buildRepertoire('alice',[]);
  const b = buildRepertoire('bob',[]);
  const result = compareRepertoires(a,b);
  assert.equal(result.coverage, null);
  assert.equal(result.agreement, null);
  assert.equal(result.score, 0);
});
