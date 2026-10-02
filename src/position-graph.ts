import { getIncoming, getOutgoing, mutateEdge } from './edge-store.ts';
import type { EdgeMutation, StoredEdge } from './edge-store.ts';
import { canonicalPosition, edgeId, resolveMove } from './graph.js';

export type GraphEdge = StoredEdge;

export type GraphEdgeInput = Readonly<{
  source: string;
  target: string;
  from?: string;
  to?: string;
  promotion?: string;
  uci?: string;
  san?: string;
}>;

export type EdgeOptions = Readonly<{
  explicit?: boolean;
}>;

export interface PositionGraph {
  outgoing(position: string): Promise<GraphEdge[]>;
  incoming(position: string): Promise<GraphEdge[]>;
  ensureEdge(edge: GraphEdgeInput, options?: EdgeOptions): Promise<GraphEdge>;
}

type EdgeReader = (position: string) => Promise<StoredEdge[]>;
type EdgeMutator = (id: string, update: EdgeMutation) => Promise<StoredEdge | null>;

export type PositionGraphOptions = Readonly<{
  readOutgoing?: EdgeReader;
  readIncoming?: EdgeReader;
  mutateStoredEdge?: EdgeMutator;
}>;

type ResolvedMove = Readonly<{
  target: string;
  uci: string;
  san: string;
}>;

function asGraphEdge(edge: StoredEdge | null, operation: string): GraphEdge {
  if (
    edge == null
    || typeof edge.uci !== 'string'
    || typeof edge.san !== 'string'
  ) {
    throw new Error(`PositionGraph ${operation} did not produce a valid graph edge`);
  }
  return edge;
}

function asGraphEdges(edges: readonly StoredEdge[]): GraphEdge[] {
  return edges.map((edge) => asGraphEdge(edge, 'read'));
}

/**
 * Canonicalize and validate one graph edge before persistence.
 *
 * The edge id and SAN/UCI are always recomputed from canonical source + move +
 * canonical target. Only durable graph fields are copied into the normalized
 * value, so caller evidence/view annotations cannot leak into persistence.
 */
function normalizeEdge(edge: GraphEdgeInput): GraphEdge {
  const source = canonicalPosition(edge.source);
  const target = canonicalPosition(edge.target);
  const resolved = resolveMove(source, edge) as ResolvedMove;
  if (resolved.target !== target) {
    throw new Error('Graph edge target does not match the legal move result');
  }

  const normalized: StoredEdge = {
    id: '',
    source,
    target,
    uci: resolved.uci,
    san: resolved.san,
  };
  normalized.id = edgeId(normalized);
  return normalized;
}

/**
 * Application-level boundary for durable graph-edge access and mutation.
 *
 * PositionGraph owns canonical edge identity, legal source/move/target validation,
 * durable incoming/outgoing edge access, monotonic topology, and the durable
 * explicit-materialization distinction used by navigation/selection behavior.
 */
export function createPositionGraph({
  readOutgoing = getOutgoing,
  readIncoming = getIncoming,
  mutateStoredEdge = mutateEdge,
}: PositionGraphOptions = {}): PositionGraph {
  async function outgoing(position: string): Promise<GraphEdge[]> {
    return asGraphEdges(await readOutgoing(canonicalPosition(position)));
  }

  async function incoming(position: string): Promise<GraphEdge[]> {
    return asGraphEdges(await readIncoming(canonicalPosition(position)));
  }

  async function ensureEdge(
    edge: GraphEdgeInput,
    { explicit = false }: EdgeOptions = {},
  ): Promise<GraphEdge> {
    const normalized = normalizeEdge(edge);
    const stored = await mutateStoredEdge(normalized.id, (existing) => ({
      ...normalized,
      explicit: Boolean(existing?.explicit || explicit),
    }));
    return asGraphEdge(stored, 'ensureEdge');
  }

  return Object.freeze({ outgoing, incoming, ensureEdge });
}

export const positionGraph = createPositionGraph();
