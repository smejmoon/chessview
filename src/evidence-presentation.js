import { createEvidenceReader } from './evidence-source.js';

function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, immutable(child)])));
  }
  return value;
}

function nodeRecord(composition, key) {
  return composition?.nodes?.find?.((node) => node.key === key) ?? null;
}

function isImmediateRootRelationship(composition, relationship) {
  const source = nodeRecord(composition, relationship.source);
  const target = nodeRecord(composition, relationship.target);
  return source?.relation === 'root' && target == null;
}

export async function projectVisibleEvidence({ center, structure, signal } = {}) {
  const reader = createEvidenceReader({ signal });
  const composition = structure?.composition;
  const [centerEvidence, relationships] = await Promise.all([
    reader.position(center),
    Promise.all((composition?.relationships ?? []).map(async (relationship) => {
      const evidence = await reader.move(relationship.edge);
      return immutable({
        id: relationship.id,
        edge: relationship.edge,
        frequency: evidence.frequency,
        moveEval: evidence.moveEval,
        humanResult: evidence.humanResult,
        mastersMismatch: evidence.mastersMismatch,
        lichessMismatch: evidence.lichessMismatch,
        rarity: isImmediateRootRelationship(composition, relationship) ? evidence.rarity : null,
      });
    })),
  ]);
  return immutable({ center: { evaluation: centerEvidence.evaluation }, relationships });
}
