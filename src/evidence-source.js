import { getNode, getOutgoing } from './db.js';
import {
  ENGINE_MIN_DEPTH,
  HUMAN_SAMPLE_FLOOR,
  POPULAR_BAD_SHARE,
  humanMismatch,
  loadCloudEval,
  loadMasters,
  moveEvaluation,
  positionEvaluation,
  railWorthy,
  rootRarity,
} from './eval.js';

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

async function relationshipEvidence(relationship, mode, signal) {
  const edge = relationship.edge;
  const sourceNode = await getNode(edge.source);
  throwIfAborted(signal);
  // Do not bind the shared evidence request to this view's AbortSignal. The
  // evidence-request-lifetime outcome owns independent subscriber cancellation.
  const [sourceEval, targetEval, masters] = await Promise.all([
    loadCloudEval(edge.source),
    loadCloudEval(edge.target),
    loadMasters(edge.source),
  ]);
  throwIfAborted(signal);
  const moveEval = moveEvaluation(edge.source, edge, sourceEval, targetEval);
  const lichess = sourceNode?.explorer ?? null;
  return immutable({
    id: relationship.id,
    edge,
    sourceEval,
    targetEval,
    moveEval,
    masters,
    mastersMismatch: humanMismatch(masters, edge, edge.source, moveEval),
    lichessMismatch: humanMismatch(lichess, edge, edge.source, moveEval),
    rarity: mode === 'roots' ? rootRarity(edge, sourceNode) : null,
  });
}

async function lineRailEvidence(center, signal) {
  const [node, outgoing, sourceEval, masters] = await Promise.all([
    getNode(center),
    getOutgoing(center),
    loadCloudEval(center),
    loadMasters(center),
  ]);
  throwIfAborted(signal);
  const lichess = node?.explorer ?? null;
  const candidates = outgoing
    .slice()
    .sort((a, b) => (b.share ?? 0) - (a.share ?? 0) || (a.uci ?? '').localeCompare(b.uci ?? ''))
    .filter((edge) => edge.manual || (edge.games ?? 0) >= HUMAN_SAMPLE_FLOOR || (edge.share ?? 0) > POPULAR_BAD_SHARE);
  const rows = [];
  for (const edge of candidates) {
    throwIfAborted(signal);
    let targetEval = null;
    let moveEval = moveEvaluation(center, edge, sourceEval, null);
    const fallback = Boolean(sourceEval?.pvs?.length)
      && Number.isFinite(sourceEval?.depth)
      && sourceEval.depth >= ENGINE_MIN_DEPTH;
    if (!moveEval && fallback) {
      targetEval = await loadCloudEval(edge.target);
      throwIfAborted(signal);
      moveEval = moveEvaluation(center, edge, sourceEval, targetEval);
    }
    if (!railWorthy({ edge, sourceKey: center, lichessExplorer: lichess, moveQuality: moveEval })) continue;
    rows.push(immutable({
      edge,
      sourceEval,
      targetEval,
      moveEval,
      masters,
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

  const centerCloudPromise = loadCloudEval(center);
  const relationshipPromise = Promise.all(
    (composition.relationships ?? []).map((relationship) => relationshipEvidence(relationship, mode, signal)),
  );
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
    center: {
      cloud: centerCloud,
      evaluation: positionEvaluation(centerCloud),
    },
    relationships,
    rail,
  });
}
