import { edgeStrokeWidth } from './edge-visual.ts';

function familyRecord(composition: any, id: any) {
  if (!id) return null;
  return composition?.families?.find?.((family: any) => family.id === id) ?? null;
}

function nodeRecord(composition: any, key: any) {
  return composition?.nodes?.find?.((node: any) => node.key === key) ?? null;
}

function gameCount(gamesByRelationship: any, relationshipId: any) {
  const games = gamesByRelationship?.get?.(relationshipId);
  return Number.isFinite(games) && games > 0 ? games : 0;
}

export function visibleConnectors(composition: any, { gamesByRelationship = new Map() }: any = {}) {
  const relationships = Array.isArray(composition?.relationships) ? composition.relationships : [];
  const maxGames = Math.max(0, ...relationships.map((relationship: any) => gameCount(gamesByRelationship, relationship.id)));
  return relationships.flatMap((relationship: any) => {
    const familyIds = relationship.families?.length ? relationship.families : [null];
    const games = gameCount(gamesByRelationship, relationship.id);
    const strokeWidth = edgeStrokeWidth(games, maxGames);
    const sourceNode = nodeRecord(composition, relationship.source);
    const targetNode = nodeRecord(composition, relationship.target);
    const merge = sourceNode?.merge === true || targetNode?.merge === true;
    return familyIds.map((familyId: any, index: any) => {
      const family = familyRecord(composition, familyId);
      return {
        id: familyId ? `${relationship.id}::${familyId}` : relationship.id,
        relationshipId: relationship.id,
        familyId,
        familyIndex: index,
        familyCount: familyIds.length,
        familyOffset: index - (familyIds.length - 1) / 2,
        source: relationship.source,
        target: relationship.target,
        edge: relationship.edge,
        className: [
          'edge',
          familyIds.length > 1 ? 'edge-shared-family' : '',
          merge ? 'edge-merge' : '',
        ].filter(Boolean).join(' '),
        lineShare: family?.lineShare ?? null,
        games,
        strokeWidth,
      };
    });
  });
}

function elementMap(map: any) {
  return new Map([...map.querySelectorAll('.position[data-key]')]
    .filter((element) => element.dataset.key)
    .map((element) => [element.dataset.key, element]));
}

function connectorPath(source: any, target: any, mapRect: any, familyOffset = 0) {
  const a = source.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const x1 = a.left + a.width / 2 - mapRect.left;
  const y1 = a.top + a.height / 2 - mapRect.top;
  const x2 = b.left + b.width / 2 - mapRect.left;
  const y2 = b.top + b.height / 2 - mapRect.top;
  const horizontal = x2 >= x1 ? 1 : -1;
  const bend = Math.max(28, Math.abs(x2 - x1) * 0.36);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const offset = familyOffset * 8;
  const offsetX = (-dy / length) * offset;
  const offsetY = (dx / length) * offset;
  return `M ${x1} ${y1} C ${x1 + horizontal * bend + offsetX} ${y1 + offsetY}, ${x2 - horizontal * bend + offsetX} ${y2 + offsetY}, ${x2} ${y2}`;
}

function retainedEvidenceClasses(svg: any) {
  const result = new Map();
  for (const path of svg.querySelectorAll('path[data-relationship-id]')) {
    const id = path.dataset.relationshipId;
    if (!id) continue;
    const classes = [...path.classList].filter((className) => className.startsWith('edge-quality-') || className.startsWith('edge-rarity-'));
    if (!classes.length) continue;
    const current = result.get(id) ?? [];
    result.set(id, [...new Set([...current, ...classes])]);
  }
  return result;
}

export function drawVisibleEdges(map: any, composition: any, { gamesByRelationship = new Map() } = {}) {
  const svg = map?.querySelector('#edges');
  if (!map || !svg) return [];
  const mapRect = map.getBoundingClientRect();
  const elements = elementMap(map);
  const paths = [];
  for (const connector of visibleConnectors(composition, { gamesByRelationship })) {
    const source = elements.get(connector.source);
    const target = elements.get(connector.target);
    if (!source || !target) continue;
    paths.push({ ...connector, d: connectorPath(source, target, mapRect, connector.familyOffset) });
  }
  const signature = `${mapRect.width}x${mapRect.height}|${paths.map((item) => [item.id, item.className, item.strokeWidth ?? '', item.games ?? '', item.d].join(':')).join('|')}`;
  if (svg.dataset.visibleEdgesSignature === signature) return paths;
  const evidenceClasses = retainedEvidenceClasses(svg);
  svg.dataset.visibleEdgesSignature = signature;
  svg.setAttribute('viewBox', `0 0 ${mapRect.width} ${mapRect.height}`);
  svg.innerHTML = '';
  const document = svg.ownerDocument ?? globalThis.document;
  for (const item of paths) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', item.d);
    path.setAttribute('class', [item.className, ...(evidenceClasses.get(item.relationshipId) ?? [])].join(' '));
    path.dataset.relationshipId = item.relationshipId;
    path.dataset.edgeSource = item.source;
    path.dataset.edgeTarget = item.target;
    if (item.familyId) path.dataset.familyId = item.familyId;
    if (Number.isFinite(item.lineShare)) path.dataset.lineShare = String(item.lineShare);
    if (Number.isFinite(item.games) && item.games > 0) path.dataset.games = String(item.games);
    if (Number.isFinite(item.strokeWidth)) path.style.strokeWidth = `${item.strokeWidth}px`;
    svg.appendChild(path);
  }
  return paths;
}
