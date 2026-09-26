import { lineStrokeWidth } from './edge-visual.js';

function familyRecord(composition, id) {
  if (!id) return null;
  const indexed = composition?.familyById?.get?.(id);
  if (indexed) return indexed;
  return composition?.families?.find?.((family) => family.id === id) ?? null;
}

function nodeRecord(composition, key) {
  const indexed = composition?.nodeByKey?.get?.(key);
  if (indexed) return indexed;
  return composition?.nodes?.find?.((node) => node.key === key) ?? null;
}

export function visibleConnectors(composition, { direction = composition?.direction } = {}) {
  const relationships = Array.isArray(composition?.relationships) ? composition.relationships : [];

  return relationships.flatMap((relationship) => {
    if (direction === 'lines') {
      const familyIds = relationship.families?.length ? relationship.families : [null];
      return familyIds.map((familyId, index) => {
        const family = familyRecord(composition, familyId);
        const lineShare = family?.lineShare ?? null;
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
          className: familyIds.length > 1 ? 'edge edge-shared-family' : 'edge',
          lineShare,
          strokeWidth: lineStrokeWidth(lineShare),
        };
      });
    }

    const sourceNode = nodeRecord(composition, relationship.source);
    const classes = ['edge'];
    if ((relationship.edge?.share ?? 0) >= 0.2) classes.push('edge-strong');
    if (sourceNode?.merge) classes.push('edge-merge');
    return [{
      id: relationship.id,
      relationshipId: relationship.id,
      familyId: null,
      familyIndex: 0,
      familyCount: 1,
      familyOffset: 0,
      source: relationship.source,
      target: relationship.target,
      edge: relationship.edge,
      className: classes.join(' '),
      lineShare: null,
      strokeWidth: null,
    }];
  });
}

function elementMap(map) {
  return new Map(
    [...map.querySelectorAll('.position[data-key]')]
      .filter((element) => element.dataset.key)
      .map((element) => [element.dataset.key, element]),
  );
}

function connectorPath(source, target, mapRect, familyOffset = 0) {
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

export function drawVisibleEdges(map, composition, { direction = composition?.direction } = {}) {
  const svg = map?.querySelector('#edges');
  if (!map || !svg) return [];

  const mapRect = map.getBoundingClientRect();
  const elements = elementMap(map);
  const paths = [];

  for (const connector of visibleConnectors(composition, { direction })) {
    const source = elements.get(connector.source);
    const target = elements.get(connector.target);
    if (!source || !target) continue;
    paths.push({
      ...connector,
      d: connectorPath(source, target, mapRect, connector.familyOffset),
    });
  }

  const signature = `${mapRect.width}x${mapRect.height}|${paths.map((item) => [
    item.id,
    item.className,
    item.strokeWidth ?? '',
    item.d,
  ].join(':')).join('|')}`;
  if (svg.dataset.visibleEdgesSignature === signature) return paths;

  svg.dataset.visibleEdgesSignature = signature;
  svg.setAttribute('viewBox', `0 0 ${mapRect.width} ${mapRect.height}`);
  svg.innerHTML = '';
  for (const item of paths) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', item.d);
    path.setAttribute('class', item.className);
    path.dataset.relationshipId = item.relationshipId;
    path.dataset.edgeSource = item.source;
    path.dataset.edgeTarget = item.target;
    if (item.familyId) path.dataset.familyId = item.familyId;
    if (Number.isFinite(item.lineShare)) path.dataset.lineShare = String(item.lineShare);
    if (Number.isFinite(item.strokeWidth)) path.style.strokeWidth = `${item.strokeWidth}px`;
    svg.appendChild(path);
  }

  return paths;
}
