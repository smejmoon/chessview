import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { canonicalPosition } from '../src/graph.ts';
import { buildRepertoire, compareRepertoires, compareBranchRepertoires, openingSeeds } from '../prototypes/repertoire-matches/matcher.ts';
import { discoverCandidates, exportGames } from '../prototypes/repertoire-matches/lichess-source.ts';

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

test('opening-first discovery uses authenticated requests for Explorer and user details', async () => {
  const controller = new AbortController();
  const calls: { url: string; method: string }[] = [];
  const authenticated: typeof import('../src/lichess-session.ts').lichessSession.authorizedRequest =
    async (input, init) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? 'GET' });
      if (url.startsWith('https://explorer.lichess.org/lichess')) {
        assert.equal(init?.signal, controller.signal);
        return new Response(JSON.stringify({
          white: 40, draws: 20, black: 40,
          topGames: [{ id: 'abcd1234', white: { name: 'GMChess', title: 'GM', rating: 2600 },
            black: { name: 'Someone', rating: 2200 } }],
          recentGames: [],
        }), { status: 200 });
      }
      if (url.startsWith('https://lichess.org/api/users')) {
        assert.equal(init?.method, 'POST');
        return new Response(JSON.stringify([
          { id: 'gmchess', username: 'GMChess', title: 'GM', perfs: { blitz: { rating: 2660 } } },
        ]), { status: 200 });
      }
      throw new Error('Unexpected API request: ' + url);
    };
  const logs: string[] = [];
  let funnel: import('../prototypes/repertoire-matches/lichess-source.ts').DiscoveryBranch[] = [];
  const result = await discoverCandidates('alice', [{
    side: 'white', key: canonicalPosition(new Chess().fen()), route: '',
    ply: 4, visits: 12,
  }], 1, (area, event) => logs.push(area + ':' + event), controller.signal, authenticated,
    stats => { funnel = stats; });
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'GMChess');
  assert.equal(result[0].source, 'opening-explorer');
  assert.equal(funnel[0].discoveredAccounts, 1);
  assert.equal(funnel[0].titledAccounts, 1);
  assert.equal(funnel[0].selectedAccounts, 1);
  assert.deepEqual(calls.map(c => c.method), ['GET', 'POST']);
  assert.ok(logs.includes('network:opening explorer response'));
  assert.ok(calls[0].url.startsWith('https://explorer.lichess.org/lichess'));
});

test('branch matching excludes generic starting positions and unrelated openings', () => {
  const own = buildRepertoire('alice', Array.from({ length: 4 }, (_, i) =>
    game('ab12340' + i, 'alice', 'opponent', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6')));
  const other = buildRepertoire('master', Array.from({ length: 4 }, (_, i) =>
    game('cd12340' + i, 'master', 'opponent', 'e4 c5 Nf3 Nc6 Bb5 d6')));
  const seeds = openingSeeds(own);
  const result = compareBranchRepertoires(own, other, seeds);
  assert.equal(result.bySide.white.score, null);
  assert.equal(result.shared.length, 0);
  assert.equal(result.branches[0].candidateGames, 0);
  assert.equal(result.branches[0].evidence, 'not-observed');
});

test('repeated matching branch games yield supported choice agreement', () => {
  const own = buildRepertoire('alice', Array.from({ length: 4 }, (_, i) =>
    game('ab45670' + i, 'alice', 'opponent', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6')));
  const theirs = buildRepertoire('master', Array.from({ length: 3 }, (_, i) =>
    game('cd45670' + i, 'master', 'opponent', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6')));
  const result = compareBranchRepertoires(own, theirs);
  assert.equal(result.branches[0].evidence, 'confirmed');
  assert.equal(result.branches[0].candidateGames, 3);
  assert.equal(result.branches[0].coverage, 1);
  assert.equal(result.branches[0].agreement, 1);
  assert.equal(result.branches[0].score, 100);
  assert.ok(result.shared.every(choice => choice.ply >= 4));
});

test('sparse candidate branches remain unknown instead of displaying a false percentage', () => {
  const own = buildRepertoire('alice', Array.from({ length: 4 }, (_, i) =>
    game('ab78900' + i, 'alice', 'opponent', 'e4 e5 Nf3 Nc6 Bb5 a6')));
  const theirs = buildRepertoire('master', [
    game('cd789000', 'master', 'opponent', 'e4 e5 Nf3 Nc6 Bb5 a6'),
  ]);
  const result = compareBranchRepertoires(own, theirs);
  assert.equal(result.branches[0].candidateGames, 1);
  assert.equal(result.branches[0].evidence, 'sparse');
  assert.equal(result.branches[0].coverage, null);
  assert.equal(result.branches[0].agreement, null);
  assert.equal(result.bySide.white.score, null);
});

test('branch roots converge across transposed opening routes', () => {
  const own = buildRepertoire('alice', Array.from({ length: 4 }, (_, i) =>
    game('ab90120' + i, 'alice', 'opponent', 'Nf3 Nf6 g3 g6 Bg2 Bg7')));
  const theirs = buildRepertoire('master', Array.from({ length: 3 }, (_, i) =>
    game('cd90120' + i, 'master', 'opponent', 'g3 g6 Nf3 Nf6 Bg2 Bg7')));
  const result = compareBranchRepertoires(own, theirs);
  assert.equal(result.branches[0].candidateGames, 3);
  assert.equal(result.branches[0].evidence, 'confirmed');
  assert.equal(result.branches[0].agreement, 1);
});

test('candidate export stops at the bounded NDJSON sample without waiting for EOF', async () => {
  const logEvents: string[] = [];
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (let i = 0; i < 140; i++) controller.enqueue(encoder.encode(
        JSON.stringify(game('ab' + String(i).padStart(6, '0'), 'master', 'other', 'e4 e5')) + '\\n'));
      // Intentionally never close: the application must cancel at its sample cap.
    },
    cancel() { cancelled = true; },
  });
  const request: typeof import('../src/lichess-session.ts').lichessSession.authorizedRequest =
    async () => new Response(stream, { status: 200 });
  const result = await exportGames('master', 140, 12,
    (_area, event) => logEvents.push(event), new AbortController().signal, request);
  assert.equal(result.games.length, 140);
  assert.equal(result.received, 140);
  assert.equal(result.streamStoppedAtLimit, true);
  assert.equal(result.overflow, 0);
  assert.equal(cancelled, true);
  assert.ok(logEvents.includes('export parsed'));
});

test('branch position examples retain candidate game IDs', () => {
  const own = buildRepertoire('alice', Array.from({ length: 4 }, (_, i) =>
    game('ab76540' + i, 'alice', 'other', 'e4 e5 Nf3 Nc6 Bb5 a6')));
  const theirs = buildRepertoire('master', Array.from({ length: 3 }, (_, i) =>
    game('cd76540' + i, 'master', 'other', 'e4 e5 Nf3 Nc6 Bb5 a6')));
  const positions = compareBranchRepertoires(own, theirs).shared;
  assert.equal(positions[0].exampleGame, 'cd765400');
});
