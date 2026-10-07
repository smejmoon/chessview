import { edgeId } from './graph.ts';
import { createEvidenceReader } from './evidence-source.ts';
import type {
  EvidenceEdge,
  EvidenceReader,
  MoveEvidence,
  PositionEvidence,
} from './evidence-source.ts';

type PrepareMoveEvidenceOptions = Readonly<{
  signal?: AbortSignal;
  reader?: EvidenceReader;
}>;

export type PreparedConstellationEvidence = Readonly<{
  position: PositionEvidence;
  moves: ReadonlyMap<string, MoveEvidence>;
}>;

export async function prepareMoveEvidence(
  edges: readonly EvidenceEdge[],
  { signal, reader: providedReader }: PrepareMoveEvidenceOptions = {},
): Promise<ReadonlyMap<string, MoveEvidence>> {
  const reader = providedReader ?? createEvidenceReader({ signal });
  const unique = new Map<string, EvidenceEdge>();
  for (const edge of edges) {
    const id = edgeId(edge);
    if (!unique.has(id)) unique.set(id, edge);
  }

  const prepared = await Promise.all([...unique].map(async ([id, edge]) => (
    [id, await reader.move(edge)] as const
  )));
  return new Map(prepared);
}
