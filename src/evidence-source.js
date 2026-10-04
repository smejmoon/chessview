import {
  humanMismatch,
  humanResultQuality,
  moveEvaluation,
  moveFrequency,
  positionEvaluation,
  rootRarityFromFrequency,
} from './evidence.js';
import { currentExplorerReading, readCachedExplorerReading } from './explorer.js';
import { lichessEval } from './lichess-eval.js';
import { mastersProvider } from './masters.js';

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

async function availableExplorer(position) {
  return currentExplorerReading(position) ?? await readCachedExplorerReading(position);
}

async function relationshipEvidence(relationship, mode, signal) {
  const edge = relationship.edge;
  const [sourceEval, targetEval, masters, lichess] = await Promise.all([
    lichessEval.available(edge.source),
    lichessEval.available(edge.target),
    mastersProvider.available(edge.source),
    availableExplorer(edge.source),
  ]);
  throwIfAborted(signal);
  const moveEval = moveEvaluation(edge.source, edge, sourceEval, targetEval);
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

async function visibleRelationshipEvidence(composition, mode, signal) {
  const result = [];
  for (const relationship of composition.relationships ?? []) {
    throwIfAborted(signal);
    result.push(await relationshipEvidence(relationship, mode, signal));
  }
  return immutable(result);
}

/**
 * Derive the best evidence already available for one accepted projection.
 * This function does not start source acquisition; run-owned refinement does that.
 */
export async function loadNodusEvidence({ center, mode, structure, signal } = {}) {
  throwIfAborted(signal);
  const composition = structure?.composition;
  if (!composition) return immutable({ center: null, relationships: [] });

  const [centerCloud, relationships] = await Promise.all([
    lichessEval.available(center),
    visibleRelationshipEvidence(composition, mode, signal),
  ]);
  throwIfAborted(signal);

  return immutable({
    center: { evaluation: positionEvaluation(centerCloud) },
    relationships,
  });
}
