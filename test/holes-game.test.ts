import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { canEverBeGuardedByPawn, findHoles, gradeHoles, trainingZone } from '../src/holes-rules.ts';
import { getRandomLichessPosition, sampleTvPosition } from '../src/holes-source.ts';

test('training zone is deliberately bounded for each defender', () => {
  assert.equal(trainingZone('w').length, 18);
  assert.ok(trainingZone('w').includes('c3'));
  assert.ok(!trainingZone('w').includes('c6'));
  assert.ok(trainingZone('b').includes('c6'));
});

test('undefended holes require enemy attack and no friendly defense', () => {
  const fen = '4k3/8/8/3p4/8/8/8/4K3 w - - 0 1';
  assert.ok(findHoles(fen, 'w', 'undefended').has('c4'));
  assert.ok(findHoles(fen, 'w', 'undefended').has('e4'));
  assert.ok(!findHoles(fen, 'w', 'undefended').has('d4'));
  const guarded = '4k3/8/8/3p4/8/2N5/8/4K3 w - - 0 1';
  assert.ok(!findHoles(guarded, 'w', 'undefended').has('e4'));
});

test('pawn holes include future forward pawn defense, but not occupied squares', () => {
  const chess = new Chess('4k3/8/8/8/4P3/8/8/4K3 w - - 0 1');
  assert.ok(canEverBeGuardedByPawn(chess, 'w', 'd5'));
  assert.ok(!canEverBeGuardedByPawn(chess, 'w', 'd4'));
  assert.ok(!findHoles(chess.fen(), 'w', 'pawn-holes').has('d5'));
  assert.ok(findHoles(chess.fen(), 'w', 'pawn-holes').has('d4'));
  assert.ok(!findHoles(chess.fen(), 'w', 'pawn-holes').has('e4'));
});

test('correct, extra and missed answers are separate', () => {
  assert.deepEqual(gradeHoles(new Set(['c4','d4']),new Set(['c4','e4'])),{
    correct:['c4'],incorrect:['d4'],missed:['e4'],
  });
});

const MOVES = 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8 d4 Nbd7';

test('sample uses a replayed real standard-game intermediate position', () => {
  const data = JSON.stringify({id:'AbCd1234',variant:'standard',moves:MOVES});
  const sample = sampleTvPosition('invalid\n'+data,()=>0);
  assert.ok(sample);
  assert.equal(sample.gameId,'AbCd1234');
  assert.equal(sample.ply,18);
  const chess = new Chess();
  for(const san of MOVES.split(' ').slice(0,18)) chess.move(san);
  assert.equal(sample.fen,chess.fen());
  assert.equal(sampleTvPosition(JSON.stringify({id:'AbCd1234',variant:'crazyhouse',moves:MOVES})),null);
});

test('fetch uses the serialized Lichess gateway boundary', async () => {
  const calls=[];
  const gateway={async request(url,init,work){
    calls.push({url,init,work});
    return new Response(JSON.stringify({id:'XyZz9876',variant:'standard',moves:MOVES}),{status:200});
  }};
  assert.equal((await getRandomLichessPosition(gateway,()=>0)).gameId,'XyZz9876');
  assert.match(calls[0].url,/\/api\/tv\/blitz/);
  assert.equal(calls[0].init.headers.Accept,'application/x-ndjson');
  assert.equal(calls[0].work.urgency,'foreground');
});
