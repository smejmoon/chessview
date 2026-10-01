import { getIncoming, getOutgoing, mutateEdge } from './edge-store.js';
import { canonicalPosition, edgeId, resolveMove } from './graph.js';

/**
 * Application-level boundary for durable graph-edge access and mutation.
 *
 * PositionGraph owns canonical edge identity, legal source/move/target validation,
 * durable incoming/outgoing edge access, monotonic topology, and accumulation of
 * independent manual/derived provenance.
 *
 * It does not own position records or facet hydration, Explorer freshness or
 * admission policy, evidence interpretation, Constellation selection,
 * current-view state, or graph-neighborhood caching.
 */

/**
 * Canonicalize and validate one graph edge before persistence.
 *
 * The edge id and SAN/UCI are always recomputed from canonical source + move +
 * canonical target. A supplied target that does not match the legal move result
 * is rejected rather than persisted as graph state.
 *
 * @param {Object} edge
 * @returns {Object}
 */
function normalizeEdge(edge) {
  const source = canonicalPosition(edge?.source);
  const target = canonicalPosition(edge?.target);
  const resolved = resolveMove(source, edge ?? {});
  if (resolved.target !== target) {
    throw new Error('Graph edge target does not match the legal move result');
  }

  const normalized = {
    ...edge,
    source,
    target,
    uci: resolved.uci,
    san: resolved.san,
  };
  normalized.id = edgeId(normalized);
  return normalized;
}

/**
 * Create a PositionGraph over edge persistence operations.
 *
 * Persistence functions are injectable so deterministic tests can exercise the
 * boundary without introducing a second graph implementation or in-memory cache.
 *
 * @param {Object} [options]
 * @param {(position: string) => Promise<Array<Object>>} [options.readOutgoing]
 * @param {(position: string) => Promise<Array<Object>>} [options.readIncoming]
 * @param {(id: string, update: (existing: Object | null) => Object | null) => Promise<Object | null>} [options.mutateStoredEdge]
 */
export function createPositionGraph({
  readOutgoing = getOutgoing,
  readIncoming = getIncoming,
  mutateStoredEdge = mutateEdge,
} = {}) {
  /**
   * Return all durable edges whose source is `position`.
   *
   * The position is canonicalized at the boundary.
   *
   * @param {string} position
   * @returns {Promise<Array<Object>>}
   */
  async function outgoing(position) {
    return readOutgoing(canonicalPosition(position));
  }

  /**
   * Return all durable edges whose target is `position`.
   *
   * The position is canonicalized at the boundary.
   *
   * @param {string} position
   * @returns {Promise<Array<Object>>}
   */
  async function incoming(position) {
    return readIncoming(canonicalPosition(position));
  }

  /**
   * Ensure exactly one durable edge exists for the supplied legal identity.
   *
   * Existing mutable/statistical fields are preserved. Requested manual/derived
   * provenance is OR-added atomically so concurrent discovery paths cannot lose
   * already-established provenance. Source-observation freshness and ordering are
   * owned by the acquisition/projection layer, not inferred here.
   *
   * @param {Object} edge
   * @param {Object} [provenance]
   * @param {boolean} [provenance.manual=false]
   * @param {boolean} [provenance.derived=false]
   * @returns {Promise<Object>}
   */
  async function ensureEdge(edge, { manual = false, derived = false } = {}) {
    const normalized = normalizeEdge(edge);
    return mutateStoredEdge(normalized.id, (existing) => {
      if (existing) {
        return {
          ...existing,
          manual: Boolean(existing.manual || edge?.manual || manual),
          derived: Boolean(existing.derived || edge?.derived || derived),
        };
      }

      return {
        ...normalized,
        manual: Boolean(edge?.manual || manual),
        derived: Boolean(edge?.derived || derived),
      };
    });
  }

  /**
   * Replace mutable fields for one legal edge while preserving graph identity and
   * already-established manual/derived provenance.
   *
   * Unknown topology is left untouched unless the caller explicitly permits first
   * admission with `create: true`. PositionGraph validates that decision but does
   * not decide whether a newly observed relationship is useful enough to admit.
   * Retention provenance is established only through `ensureEdge()`; mutable
   * evidence updates cannot add it accidentally.
   *
   * @param {Object} edge
   * @param {Object} [options]
   * @param {boolean} [options.create=false]
   * @returns {Promise<Object | null>}
   */
  async function updateEdge(edge, { create = false } = {}) {
    const normalized = normalizeEdge(edge);
    return mutateStoredEdge(normalized.id, (existing) => {
      if (!existing && !create) return null;
      return {
        ...normalized,
        manual: Boolean(existing?.manual),
        derived: Boolean(existing?.derived),
      };
    });
  }

  return Object.freeze({ outgoing, incoming, ensureEdge, updateEdge });
}

export const positionGraph = createPositionGraph();
