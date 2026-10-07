import assert from 'node:assert/strict';
import test from 'node:test';
import { edgeId } from '../src/graph.ts';
import { prepareMoveEvidence } from '../src/evidence-presentation.ts';
import type { EvidenceEdge, EvidenceReader, MoveEvidence } from '../src/evidence-source.ts';
import { isObsoleteWork } from '../src/obsolete-work.ts';

function moveEvidence(label: string): MoveEvidence {
  return Object.freeze({
    frequency: Object.freeze({ games: 10, sourceGames: 100, share: 0.1 }),
    moveEval: Object.freeze({ lossCp: 12, quality: label }),
    humanResult: null,
    mastersMismatch: null,
    lichessMismatch: null,
    rarity: null,
  });
}

test('prepareMoveEvidence batches unique Graph Edges into an edge-keyed lookup', async () => {
  const first: EvidenceEdge = Object.freeze({
    source: 'source',
    target: 'first-target',
    uci: 'e2e4',
    san: 'e4',
  });
  const duplicate: EvidenceEdge = Object.freeze({ ...first });
  const second: EvidenceEdge = Object.freeze({
    source: 'source',
    target: 'second-target',
    uci: 'd2d4',
    san: 'd4',
  });
  const calls: EvidenceEdge[] = [];
  const firstEvidence = moveEvidence('first');
  const secondEvidence = moveEvidence('second');
  const reader: EvidenceReader = Object.freeze({
    ratedReadingAvailable: async () => false,
    position: async () => Object.freeze({ evaluation: null }),
    move: async (edge) => {
      calls.push(edge);
      return edge.uci === first.uci ? firstEvidence : secondEvidence;
    },
  });

  const prepared = await prepareMoveEvidence([first, duplicate, second], { reader });

  assert.deepEqual(calls, [first, second]);
  assert.equal(prepared.size, 2);
  assert.equal(prepared.get(edgeId(first)), firstEvidence);
  assert.equal(prepared.get(edgeId(second)), secondEvidence);
});

test('prepareMoveEvidence forwards cancellation to its Evidence reader', async () => {
  const edge: EvidenceEdge = Object.freeze({
    source: 'source',
    target: 'target',
    uci: 'e2e4',
  });
  const controller = new AbortController();
  controller.abort('obsolete presentation');

  await assert.rejects(
    prepareMoveEvidence([edge], { signal: controller.signal }),
    (error) => isObsoleteWork(error, controller.signal),
  );
});
