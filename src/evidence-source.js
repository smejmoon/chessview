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
import { positionGraph } from './position-graph.js';
import { positionRepository } from './position-repository.js';
import { POPULAR_BAD_SHARE, RAIL_SAMPLE_FLOOR, railWorthy } from './rail-selection.js';

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

async function moveEngineEvidence(source, edge, signal) {
  const sourceEval = await lichessEval.get(source, { signal });
  throwIfAborted(signal);
  let moveEval = moveEvaluation(source, edge, sourceEval);
  if (!moveEval && sourceEval) {
    const targetEval = await lichessEval.get(edge.target, { signal });
    throwIfAborted(signal);
    moveEval = moveEvaluation(source, edge, sourceEval, targetEval);
  }
  return moveEval;
}

async function relationshipEvidence(relationship, mode, signal) {
  const edge = relationship.edge;
  const sourceNode = await positionRepository.get(edge.source);
  throwIfAborted(signal);
  const [moveEval, masters] = await Promise.all([
    moveEngineEvidence(edge.source, edge, signal),
    loadMasters(edge.source, { signal }),
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

async function visibleRelationshipEvidence(composition, mode, signal) {
  const result = [];
  for (const relationship of composition.relationships ?? []) {
    throwIfAborted(signal);
    result.push(await relationshipEvidence(relationship, mode, signal));
  }
  return immutable(result);
}

function railCandidate(edge, explorer, source) {
  return {
    edge,
    frequency: moveFrequency(explorer, edge),
    humanResult: humanResultQuality(explorer, edge, source),
  };
}

function compareRailCandidates(a, b) {
  const aShare = a.frequency?.share;
  const bShare = b.frequency?.share;
  const aHasShare = Number.isFinite(aShare);
  const bHasShare = Number.isFinite(bShare);
  if (aHasShare !== bHasShare) return aHasShare ? -1 : 1;
  if (aHasShare && aShare !== bShare) return bShare - aShare;
  return (a.edge?.uci ?? '').localeCompare(b.edge?.uci ?? '');
}

function canEnterAutomaticRail(candidate) {
  if (candidate.edge?.manual) return true;
  const games = candidate.frequency?.games ?? 0;
  const share = candidate.frequency?.share;
  return games >= RAIL_SAMPLE_FLOOR
    || (Number.isFinite(share) && share >= POPULAR_BAD_SHARE);
}

async function lineRailEvidence(center, signal) {
  const [node, outgoing, sourceEval, masters] = await Promise.all([
    positionRepository.get(center),
    positionGraph.outgoing(center),
    lichessEval.get(center, { signal }),
    loadMasters(center, { signal }),
  ]);
  throwIfAborted(signal);
  const lichess = node?.explorer ?? null;
  const candidates = outgoing
    .map((edge) => railCandidate(edge, lichess, center))
    .filter(canEnterAutomaticRail)
    .sort(compareRailCandidates);
  const rows = [];

  for (const candidate of candidates) {
    throwIfAborted(signal);
    const { edge, frequency, humanResult } = candidate;
    let moveEval = moveEvaluation(center, edge, sourceEval);
    if (!moveEval && sourceEval) {
      const targetEval = await lichessEval.get(edge.target, { signal });
      throwIfAborted(signal);
      moveEval = moveEvaluation(center, edge, sourceEval, targetEval);
    }
    if (!railWorthy({ edge, frequency, engineQuality: moveEval, humanResult })) continue;
    rows.push(immutable({
      edge,
      frequency,
      moveEval,
      humanResult,
      mastersMismatch: humanMismatch(masters, edge, center, moveEval),
      lichessMismatch: humanMismatch(lichess, edge, center, moveEval),
    }));
  }
  return immutable({ rows, masters });
}

export async function loadNodusEvidence({ center, mode, structure, signal } = {}) {
  throwIfAborted(signal);
  const composition = structure?.composition;
  if (!composition) return immutable({ center: null, relationships: [], rail: { rows: [], masters: null } });

  const centerCloudPromise = lichessEval.get(center, { signal });
  const relationshipPromise = visibleRelationshipEvidence(composition, mode, signal);
  const railPromise = mode === 'lines'
    ? lineRailEvidence(center, signal)
    : Promise.resolve(immutable({ rows: [], masters: null }));

  const [centerCloud, relationships, rail] = await Promise.all([
    centerCloudPromise,
    relationshipPromise,
    railPromise,
  ]);
  throwIfAborted(signal);

  return immutable({
    center: { evaluation: positionEvaluation(centerCloud) },
    relationships,
    rail,
  });
}
