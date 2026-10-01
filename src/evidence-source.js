import {
  humanMismatch,
  humanResultQuality,
  moveEvaluation,
  moveFrequency,
  positionEvaluation,
  rootRarityFromFrequency,
} from './evidence.js';
import { lichessEval } from './lichess-eval.js';
import { loadMasters } from './masters.js';
import { positionRepository } from './position-repository.js';

function abortError() {
  const error = new Error('Evidence view became obsolete');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, immutable(child)]),
    ));
  }
  return value;
}

async function moveEngineEvidence(source, edge, signal, priority) {
  const sourceEval = await lichessEval.get(source, { signal, priority });
  throwIfAborted(signal);
  let moveEval = moveEvaluation(source, edge, sourceEval);
  if (!moveEval && sourceEval) {
    const targetEval = await lichessEval.get(edge.target, { signal, priority });
    throwIfAborted(signal);
    moveEval = moveEvaluation(source, edge, sourceEval, targetEval);
  }
  return moveEval;
}

async function relationshipEvidence(relationship, mode, signal, priority) {
  const edge = relationship.edge;
  const sourceNode = await positionRepository.get(edge.source);
  throwIfAborted(signal);
  const [moveEval, masters] = await Promise.all([
    moveEngineEvidence(edge.source, edge, signal, priority),
    loadMasters(edge.source, { signal, priority }),
  ]);
  throwIfAborted(signal);
  const lichess = sourceNode?.explorer ?? null;
  const frequency = moveFrequency(lichess, edge);
  const humanResult = humanResultQuality(lichess, edge, edge.source);
  return immutable({
    id: relationship.id,
    edge,
    frequency,
    moveEval,
    humanResult,
    mastersMismatch: humanMismatch(masters, edge, edge.source, moveEval),
    lichessMismatch: humanMismatch(lichess, edge, edge.source, moveEval),
    rarity: mode === 'roots' ? rootRarityFromFrequency(frequency) : null,
  });
}

async function visibleRelationshipEvidence(composition, mode, signal, priority) {
  const result = [];
  for (const relationship of composition.relationships ?? []) {
    throwIfAborted(signal);
    result.push(await relationshipEvidence(relationship, mode, signal, priority));
  }
  return immutable(result);
}

export async function loadNodusEvidence({ center, mode, structure, signal, priority = 'foreground' } = {}) {
  throwIfAborted(signal);
  const composition = structure?.composition;
  if (!composition) return immutable({ center: null, relationships: [] });

  const [centerCloud, relationships] = await Promise.all([
    lichessEval.get(center, { signal, priority }),
    visibleRelationshipEvidence(composition, mode, signal, priority),
  ]);
  throwIfAborted(signal);

  return immutable({
    center: { evaluation: positionEvaluation(centerCloud) },
    relationships,
  });
}
