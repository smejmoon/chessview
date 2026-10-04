import { createEvidenceReader } from './evidence-source.js';

function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, immutable(child)]),
    ));
  }
  return value;
}

/**
 * Join independently addressable Evidence onto one visible presentation.
 * Evidence itself never receives or depends on Constellation structure.
 */
export async function projectVisibleEvidence({ center, mode, structure, signal } = {}) {
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
        rarity: mode === 'roots' ? evidence.rarity : null,
      });
    })),
  ]);

  return immutable({
    center: { evaluation: centerEvidence.evaluation },
    relationships,
  });
}
