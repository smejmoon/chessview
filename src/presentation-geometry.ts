const MAP_PADDING_PX = 20;
const BOARD_GAP_PX = 16;
const FAMILY_GAP_PX = 30;
const MAX_PROMINENT_LINES = 4;

export type PresentationRegion = Readonly<{
  left: number;
  right: number;
  top: number;
  bottom: number;
}>;

export type NodePlacement = Readonly<{
  x: number;
  y: number;
  size: number;
  tier: 'prominent' | 'compact';
}>;

export type PresentationNode = Readonly<{
  key: string;
  relation?: string;
  distance?: number;
  families?: readonly string[];
}>;

export type PresentationRelationship = Readonly<{
  source: string;
  target: string;
  families?: readonly string[];
}>;

export type PresentationTopology = Readonly<{
  center: string;
  nodes: readonly PresentationNode[];
  relationships: readonly PresentationRelationship[];
}>;

export type PresentationGeometry = Readonly<{
  width: number;
  height: number;
  center: Readonly<{ x: number; y: number; size: number }>;
  lineRegion: PresentationRegion;
  rootRegion: PresentationRegion | null;
  prominentSize: number;
  compactSize: number;
  lineCapacity: number;
  rootCapacity: number;
}>;

export type PresentationConstraints = Readonly<{
  lineCapacity: number;
  rootCapacity: number;
}>;

type IndexedNode = Readonly<{ node: PresentationNode; index: number }>;
type PlacementColumn = Readonly<{
  x: number;
  ys: readonly number[];
  prominent: boolean;
}>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function regionWidth(region: PresentationRegion): number {
  return Math.max(0, region.right - region.left);
}

function regionHeight(region: PresentationRegion): number {
  return Math.max(0, region.bottom - region.top);
}

function insetLeft(region: PresentationRegion, amount: number): PresentationRegion {
  return Object.freeze({
    left: Math.min(region.right, region.left + Math.max(0, amount)),
    right: region.right,
    top: region.top,
    bottom: region.bottom,
  });
}

function rowCount(region: PresentationRegion, size: number, gap: number): number {
  if (regionWidth(region) < size || regionHeight(region) < size) return 0;
  return Math.max(0, Math.floor((regionHeight(region) + gap) / (size + gap)));
}

function columnCount(region: PresentationRegion, size: number, gap: number): number {
  if (regionWidth(region) < size || regionHeight(region) < size) return 0;
  return Math.max(0, Math.floor((regionWidth(region) + gap) / (size + gap)));
}

function rowCenters(
  region: PresentationRegion,
  size: number,
  gap: number,
  limit = Number.POSITIVE_INFINITY,
): number[] {
  const count = Math.min(rowCount(region, size, gap), limit);
  if (!Number.isFinite(count) || count <= 0) return [];
  if (count === 1) return [(region.top + region.bottom) / 2];
  const span = (count - 1) * (size + gap);
  const start = (region.top + region.bottom) / 2 - span / 2;
  return Array.from({ length: count }, (_, index) => start + index * (size + gap));
}

function columnCenters(
  region: PresentationRegion,
  size: number,
  gap: number,
  direction: 'left-to-right' | 'right-to-left' = 'left-to-right',
): number[] {
  const count = columnCount(region, size, gap);
  if (!count) return [];
  const first = direction === 'left-to-right'
    ? region.left + size / 2
    : region.right - size / 2;
  const step = (size + gap) * (direction === 'left-to-right' ? 1 : -1);
  return Array.from({ length: count }, (_, index) => first + index * step);
}

function prominentRowCount(region: PresentationRegion, prominentSize: number): number {
  if (regionWidth(region) < prominentSize) return 0;
  return Math.min(
    MAX_PROMINENT_LINES,
    rowCount(region, prominentSize, BOARD_GAP_PX + FAMILY_GAP_PX),
  );
}

function lineCapacityFor(
  region: PresentationRegion,
  prominentSize: number,
  compactSize: number,
): number {
  const prominentRows = prominentRowCount(region, prominentSize);
  if (!prominentRows) {
    return rowCount(region, compactSize, BOARD_GAP_PX)
      * columnCount(region, compactSize, BOARD_GAP_PX);
  }
  const compactRegion = insetLeft(region, prominentSize + BOARD_GAP_PX);
  return prominentRows
    + rowCount(compactRegion, compactSize, BOARD_GAP_PX)
      * columnCount(compactRegion, compactSize, BOARD_GAP_PX);
}

function rootCapacityFor(region: PresentationRegion | null, compactSize: number): number {
  if (!region) return 0;
  return rowCount(region, compactSize, BOARD_GAP_PX + FAMILY_GAP_PX)
    * columnCount(region, compactSize, BOARD_GAP_PX);
}

function compactColumns(
  region: PresentationRegion,
  size: number,
  verticalGap: number,
  direction: 'left-to-right' | 'right-to-left' = 'left-to-right',
): PlacementColumn[] {
  const ys = rowCenters(region, size, verticalGap);
  return columnCenters(region, size, BOARD_GAP_PX, direction)
    .map((x) => Object.freeze({ x, ys, prominent: false }));
}

function lineColumns(geometry: PresentationGeometry): PlacementColumn[] {
  const rows = prominentRowCount(geometry.lineRegion, geometry.prominentSize);
  if (!rows) {
    return compactColumns(geometry.lineRegion, geometry.compactSize, BOARD_GAP_PX);
  }
  const first = Object.freeze({
    x: geometry.lineRegion.left + geometry.prominentSize / 2,
    ys: rowCenters(
      geometry.lineRegion,
      geometry.prominentSize,
      BOARD_GAP_PX + FAMILY_GAP_PX,
      MAX_PROMINENT_LINES,
    ),
    prominent: true,
  });
  const compactRegion = insetLeft(
    geometry.lineRegion,
    geometry.prominentSize + BOARD_GAP_PX,
  );
  return [first, ...compactColumns(compactRegion, geometry.compactSize, BOARD_GAP_PX)];
}

function rootColumns(geometry: PresentationGeometry): PlacementColumn[] {
  if (!geometry.rootRegion) return [];
  return compactColumns(
    geometry.rootRegion,
    geometry.compactSize,
    BOARD_GAP_PX + FAMILY_GAP_PX,
  );
}

function isRootContext(node: PresentationNode | undefined): boolean {
  return node?.relation === 'root' || node?.relation === 'sibling';
}

function average(values: readonly number[], fallback: number): number {
  if (!values.length) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function familyIds(node: PresentationNode): string[] {
  return [...new Set((node.families ?? []).filter(Boolean))];
}

function stableTopologyOrder(
  indexed: readonly IndexedNode[],
  relationships: readonly PresentationRelationship[],
  anchorRelation: 'outgoing' | 'root',
): PresentationNode[] {
  if (!indexed.length) return [];
  const byKey = new Map(indexed.map((item) => [item.node.key, item]));
  const indegree = new Map(indexed.map(({ node }) => [node.key, 0]));
  const children = new Map<string, string[]>();
  const seenEdges = new Set<string>();
  const familyRank = new Map<string, number>();

  for (const { node, index } of indexed) {
    for (const family of familyIds(node)) {
      if (!familyRank.has(family)) familyRank.set(family, index);
    }
  }

  for (const relationship of relationships) {
    if (!byKey.has(relationship.source) || !byKey.has(relationship.target)) continue;
    if (relationship.source === relationship.target) continue;
    const id = relationship.source + '\u0000' + relationship.target;
    if (seenEdges.has(id)) continue;
    seenEdges.add(id);
    if (!children.has(relationship.source)) children.set(relationship.source, []);
    children.get(relationship.source)?.push(relationship.target);
    indegree.set(relationship.target, (indegree.get(relationship.target) ?? 0) + 1);
  }

  const compare = (leftKey: string, rightKey: string): number => {
    const left = byKey.get(leftKey);
    const right = byKey.get(rightKey);
    if (!left || !right) return leftKey.localeCompare(rightKey);
    const leftAnchor = left.node.relation === anchorRelation ? 0 : 1;
    const rightAnchor = right.node.relation === anchorRelation ? 0 : 1;
    const leftDistance = left.node.distance ?? Number.MAX_SAFE_INTEGER;
    const rightDistance = right.node.distance ?? Number.MAX_SAFE_INTEGER;
    const leftFamily = Math.min(
      ...familyIds(left.node).map((family) => familyRank.get(family) ?? left.index),
      left.index,
    );
    const rightFamily = Math.min(
      ...familyIds(right.node).map((family) => familyRank.get(family) ?? right.index),
      right.index,
    );
    return leftAnchor - rightAnchor
      || leftDistance - rightDistance
      || leftFamily - rightFamily
      || left.index - right.index
      || left.node.key.localeCompare(right.node.key);
  };

  const ready = indexed
    .filter(({ node }) => (indegree.get(node.key) ?? 0) === 0)
    .map(({ node }) => node.key)
    .sort(compare);
  const ordered: PresentationNode[] = [];
  const emitted = new Set<string>();

  while (ready.length) {
    const key = ready.shift();
    if (!key || emitted.has(key)) continue;
    const item = byKey.get(key);
    if (!item) continue;
    emitted.add(key);
    ordered.push(item.node);
    for (const child of children.get(key) ?? []) {
      const next = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, next);
      if (next === 0) {
        ready.push(child);
        ready.sort(compare);
      }
    }
  }

  const remainder = indexed
    .map(({ node }) => node.key)
    .filter((key) => !emitted.has(key))
    .sort(compare);
  for (const key of remainder) {
    const item = byKey.get(key);
    if (item) ordered.push(item.node);
  }
  return ordered;
}

function nearestY(available: number[], target: number): number | null {
  if (!available.length) return null;
  let bestIndex = 0;
  let bestDistance = Math.abs(available[0] - target);
  for (let index = 1; index < available.length; index += 1) {
    const distance = Math.abs(available[index] - target);
    if (distance < bestDistance || (distance === bestDistance && available[index] < available[bestIndex])) {
      bestIndex = index;
      bestDistance = distance;
    }
  }
  const [value] = available.splice(bestIndex, 1);
  return value ?? null;
}

function placeSide({
  geometry,
  region,
  nodes,
  relationships,
  columns,
  anchorRelation,
}: {
  geometry: PresentationGeometry;
  region: PresentationRegion;
  nodes: readonly IndexedNode[];
  relationships: readonly PresentationRelationship[];
  columns: readonly PlacementColumn[];
  anchorRelation: 'outgoing' | 'root';
}): Map<string, NodePlacement> {
  const ordered = stableTopologyOrder(nodes, relationships, anchorRelation);
  const capacity = columns.reduce((sum, column) => sum + column.ys.length, 0);
  if (ordered.length > capacity) {
    throw new RangeError(
      'Accepted Constellation exceeds presentation capacity: '
      + ordered.length + ' nodes for ' + capacity + ' places',
    );
  }

  const result = new Map<string, NodePlacement>();
  const keys = new Set(ordered.map((node) => node.key));
  const parents = new Map<string, string[]>();
  for (const relationship of relationships) {
    if (!keys.has(relationship.source) || !keys.has(relationship.target)) continue;
    if (!parents.has(relationship.target)) parents.set(relationship.target, []);
    parents.get(relationship.target)?.push(relationship.source);
  }

  const familyY = new Map<string, number>();
  let cursor = 0;

  for (const column of columns) {
    if (cursor >= ordered.length) break;
    const chunk = ordered.slice(cursor, cursor + column.ys.length);
    const available = [...column.ys];

    chunk.forEach((node, localIndex) => {
      const parentYs = (parents.get(node.key) ?? [])
        .map((key) => result.get(key)?.y)
        .filter((value): value is number => Number.isFinite(value));
      const relatedYs = familyIds(node)
        .map((family) => familyY.get(family))
        .filter((value): value is number => Number.isFinite(value));
      const fallback = region.top + regionHeight(region) * ((localIndex + 1) / (chunk.length + 1));
      const target = average(parentYs, average(relatedYs, fallback));
      const y = nearestY(available, target);
      if (!Number.isFinite(y)) return;
      const prominent = column.prominent && node.relation === 'outgoing';
      const placement = Object.freeze({
        x: column.x,
        y: Number(y),
        size: prominent ? geometry.prominentSize : geometry.compactSize,
        tier: prominent ? 'prominent' as const : 'compact' as const,
      });
      result.set(node.key, placement);
      for (const family of familyIds(node)) {
        if (!familyY.has(family)) familyY.set(family, placement.y);
      }
    });

    cursor += chunk.length;
  }

  return result;
}

export function placeConstellation(
  geometry: PresentationGeometry,
  topology: PresentationTopology,
): ReadonlyMap<string, NodePlacement> {
  const indexed = topology.nodes.map((node, index) => ({ node, index }));
  const lines = indexed.filter(({ node }) => !isRootContext(node));
  const roots = indexed.filter(({ node }) => isRootContext(node));
  if (lines.length > geometry.lineCapacity) {
    throw new RangeError(
      'Accepted Line Constellation exceeds line capacity: '
      + lines.length + ' > ' + geometry.lineCapacity,
    );
  }
  if (roots.length > geometry.rootCapacity) {
    throw new RangeError(
      'Accepted Root context exceeds root capacity: '
      + roots.length + ' > ' + geometry.rootCapacity,
    );
  }

  const result = placeSide({
    geometry,
    region: geometry.lineRegion,
    nodes: lines,
    relationships: topology.relationships,
    columns: lineColumns(geometry),
    anchorRelation: 'outgoing',
  });

  if (geometry.rootRegion) {
    const rootPlacement = placeSide({
      geometry,
      region: geometry.rootRegion,
      nodes: roots,
      relationships: topology.relationships,
      columns: rootColumns(geometry),
      anchorRelation: 'root',
    });
    for (const [key, placement] of rootPlacement) result.set(key, placement);
  }

  return result;
}

export function derivePresentationGeometry({
  width,
  height,
  rootContext = false,
}: {
  width: number;
  height: number;
  rootContext?: boolean;
}): PresentationGeometry {
  const safeWidth = Math.max(320, Number.isFinite(width) ? width : 320);
  const safeHeight = Math.max(240, Number.isFinite(height) ? height : 240);
  const centerLimit = Math.max(
    160,
    Math.min(safeHeight - MAP_PADDING_PX * 2, safeWidth * (rootContext ? 0.32 : 0.36)),
  );
  const centerSize = clamp(centerLimit, 160, 470);
  const prominentSize = clamp(centerSize * 0.30, 76, 128);
  const compactSize = clamp(centerSize * 0.21, 54, 92);
  const minimumCenterX = MAP_PADDING_PX + centerSize / 2;
  const maximumCenterX = safeWidth - MAP_PADDING_PX - centerSize / 2;
  const desiredCenterX = safeWidth * (rootContext ? 0.40 : 0.27);
  const centerX = clamp(desiredCenterX, minimumCenterX, maximumCenterX);

  const lineRegion = Object.freeze({
    left: centerX + centerSize / 2 + BOARD_GAP_PX,
    right: safeWidth - MAP_PADDING_PX,
    top: MAP_PADDING_PX,
    bottom: safeHeight - MAP_PADDING_PX,
  });
  const rootRegion = rootContext
    ? Object.freeze({
      left: MAP_PADDING_PX,
      right: centerX - centerSize / 2 - BOARD_GAP_PX,
      top: MAP_PADDING_PX,
      bottom: safeHeight - MAP_PADDING_PX,
    })
    : null;

  return Object.freeze({
    width: safeWidth,
    height: safeHeight,
    center: Object.freeze({ x: centerX, y: safeHeight / 2, size: centerSize }),
    lineRegion,
    rootRegion,
    prominentSize,
    compactSize,
    lineCapacity: lineCapacityFor(lineRegion, prominentSize, compactSize),
    rootCapacity: rootCapacityFor(rootRegion, compactSize),
  });
}

export function compositionConstraints(geometry: PresentationGeometry): PresentationConstraints {
  return Object.freeze({
    lineCapacity: geometry.lineCapacity,
    rootCapacity: geometry.rootCapacity,
  });
}
