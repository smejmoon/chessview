import './root-ui.css';
import { drawVisibleEdges } from './map-render.js';

function markRootStructure(root, composition) {
  const satellites = new Map(
    [...(root.querySelectorAll?.('.satellite[data-key]') ?? [])]
      .filter((element) => element.dataset.key)
      .map((element) => [element.dataset.key, element]),
  );
  for (const node of composition?.nodes ?? []) {
    const satellite = satellites.get(node.key);
    if (!satellite) continue;
    satellite.classList.toggle('is-transposition-merge', node.merge === true);
    satellite.classList.toggle('is-shared-root-ancestry', (node.families?.length ?? 0) > 1);
  }
}

function relationshipGames(view) {
  const result = new Map();
  for (const item of view?.evidence?.value?.relationships ?? []) {
    const games = item?.frequency?.games;
    if (item?.id && Number.isFinite(games) && games > 0) result.set(item.id, games);
  }
  return result;
}

export function decorateRootPresentation(root, view) {
  const composition = view?.structure?.value?.composition;
  const map = root?.querySelector?.('.map');
  if (!map || !composition) return;
  markRootStructure(root, composition);
  drawVisibleEdges(map, composition, {
    direction: 'mixed',
    gamesByRelationship: relationshipGames(view),
  });
}
