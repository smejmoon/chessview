import { getIncoming, getOutgoing, mutateEdge } from './edge-store.ts';
import type { EdgeMutation, StoredEdge } from './edge-store.ts';
import { canonicalPosition, edgeId, resolveMove } from './graph.js';

export type GraphEdge = StoredEdge & Readonly<{
  uci: string;
  san: string;
  manual?: boolean;
  derived?: boolean;
}>;

export type GraphEdgeInput = Readonly<Record<string, unknown> & {
  source: string;
  target: string;
  from?: string;
  to?: string;
  promotion?: string;
  uci?: string;
  manual?: boolean;
  derived?: boolean;
}>;

export type EdgeProvenance = Readonly<{
  manual?: boolean;
  derived?: boolean;
}>;

export type EdgeUpdateOptions = Readonly<{
  create?: boolean;
}>;

export interface PositionGraph {
  outgoing(position: string): Promise<GraphEdge[]>;
  incoming(position: string): Promise<GraphEdge[]>;
  ensureEdge(edge: GraphEdgeInput, provenance?: EdgeProvenance): Promise<GraphEdge>;
  updateEdge(edge: GraphEdgeInput, options?: EdgeUpdateOptions): Promise<GraphEdge | null>;
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
  return edge as GraphEdge;
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
  return asGraphEdge(normalized, 'normalization');
}

/**
 * Application-level boundary for durable graph-edge access and mutation.
 *
 * PositionGraph owns canonical edge identity, legal source/move/target validation,
 * durable incoming/outgoing edge access, monotonic topology, and accumulation of
 * independent manual/derived provenance.
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
    { manual = false, derived = false }: EdgeProvenance = {},
  ): Promise<GraphEdge> {
    const normalized = normalizeEdge(edge);
    const stored = await mutateStoredEdge(normalized.id, (existing) => ({
      ...normalized,
      manual: Boolean(existing?.manual || edge.manual || manual),
      derived: Boolean(existing?.derived || edge.derived || derived),
    }));
    return asGraphEdge(stored, 'ensureEdge');
  }

  async function updateEdge(
    edge: GraphEdgeInput,
    { create = false }: EdgeUpdateOptions = {},
  ): Promise<GraphEdge | null> {
    const normalized = normalizeEdge(edge);
    const stored = await mutateStoredEdge(normalized.id, (existing) => {
      if (!existing && !create) return null;
      return {
        ...normalized,
        manual: Boolean(existing?.manual),
        derived: Boolean(existing?.derived),
      };
    });
    return stored == null ? null : asGraphEdge(stored, 'updateEdge');
  }

  return Object.freeze({ outgoing, incoming, ensureEdge, updateEdge });
}

export const positionGraph = createPositionGraph();
