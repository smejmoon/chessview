import { getIncoming, getOutgoing, putEdges } from './db.js';
import { canonicalPosition, edgeId, resolveMove } from './graph.js';

/**
 * Application-level boundary for durable graph-edge access and creation.
 *
 * PositionGraph owns canonical edge identity, legal source/move/target validation,
 * durable incoming/outgoing edge access, and accumulation of independent
 * manual/derived provenance.
 *
 * It does not own position records or facet hydration, Explorer freshness or
 * reconciliation policy, evidence interpretation, Constellation selection,
 * current-view state, or graph-neighborhood caching.
 */

/**
 * Canonicalize and validate one graph edge before persistence.
 *
 * The edge id is always recomputed from canonical source + normalized UCI +
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
    san: edge?.san ?? resolved.san,
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
 * @param {(edges: Array<Object>) => Promise<unknown>} [options.writeEdges]
 */
export function createPositionGraph({
  readOutgoing = getOutgoing,
  readIncoming = getIncoming,
  writeEdges = putEdges,
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
   * Before persistence, source and target are canonicalized, the move is legally
   * resolved from source, UCI is normalized, target identity is verified, and the
   * edge id is recomputed.
   *
   * If the edge already exists, its statistical and evidence fields are kept and
   * requested manual/derived provenance is added. If it does not exist, the
   * normalized supplied edge is persisted with the requested provenance.
   *
   * @param {Object} edge
   * @param {Object} [provenance]
   * @param {boolean} [provenance.manual=false]
   * @param {boolean} [provenance.derived=false]
   * @returns {Promise<Object>}
   */
  async function ensureEdge(edge, { manual = false, derived = false } = {}) {
    const normalized = normalizeEdge(edge);
    const existing = (await readOutgoing(normalized.source))
      .find((candidate) => candidate.id === normalized.id);

    if (existing) {
      const nextManual = Boolean(existing.manual || edge?.manual || manual);
      const nextDerived = Boolean(existing.derived || edge?.derived || derived);
      if (nextManual === Boolean(existing.manual) && nextDerived === Boolean(existing.derived)) {
        return existing;
      }
      const stored = {
        ...existing,
        manual: nextManual,
        derived: nextDerived,
      };
      await writeEdges([stored]);
      return stored;
    }

    const stored = {
      ...normalized,
      manual: Boolean(edge?.manual || manual),
      derived: Boolean(edge?.derived || derived),
    };
    await writeEdges([stored]);
    return stored;
  }

  return Object.freeze({ outgoing, incoming, ensureEdge });
}

export const positionGraph = createPositionGraph();
