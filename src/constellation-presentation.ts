import './constellation-presentation.css';
import { edgeId } from './graph.ts';
import type { PreparedConstellationEvidence } from './evidence-presentation.ts';
import { drawVisibleEdges } from './map-render.ts';

function markConstellationStructure(root: any, composition: any) {
  const satellites = new Map(
    [...(root.querySelectorAll?.('.satellite[data-key]') ?? [])]
      .filter((element) => element.dataset.key)
      .map((element) => [element.dataset.key, element]),
  );
  for (const node of composition?.nodes ?? []) {
    const satellite = satellites.get(node.key);
    if (!satellite) continue;
    satellite.classList.toggle('is-transposition-merge', node.merge === true);
    satellite.classList.toggle('is-shared-family', (node.families?.length ?? 0) > 1);
  }
}

function relationshipGames(composition: any, evidence?: PreparedConstellationEvidence | null) {
  const result = new Map();
  if (!evidence) return result;
  for (const relationship of composition?.relationships ?? []) {
    const games = evidence.moves.get(edgeId(relationship.edge))?.frequency?.games;
    if (relationship?.id && Number.isFinite(games) && (games ?? 0) > 0) {
      result.set(relationship.id, games);
    }
  }
  return result;
}

export function decorateConstellationPresentation(
  root: any,
  view: any,
  evidence: PreparedConstellationEvidence | null = null,
) {
  const composition = view?.structure?.value?.composition;
  const map = root?.querySelector?.('.map');
  if (!map || !composition) return;
  markConstellationStructure(root, composition);
  drawVisibleEdges(map, composition, {
    gamesByRelationship: relationshipGames(composition, evidence),
  });
}
