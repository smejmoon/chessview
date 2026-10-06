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
  upstreamRegion: PresentationRegion | null;
  downstreamRegion: PresentationRegion;
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
type PlacementSide = 'upstream' | 'downstream';
type PlacementCell = Readonly<{
  x: number;
  y: number;
  tier: 'prominent' | 'compact';
  side: PlacementSide;
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

function columnCenters(region: PresentationRegion, size: number, gap: number): number[] {
  const count = columnCount(region, size, gap);
  if (!count) return [];
  const first = region.left + size / 2;
  return Array.from({ length: count }, (_, index) => first + index * (size + gap));
}

function prominentRowCount(region: PresentationRegion, prominentSize: number): number {
  if (regionWidth(region) < prominentSize) return 0;
  return Math.min(
    MAX_PROMINENT_LINES,
    rowCount(region, prominentSize, BOARD_GAP_PX + FAMILY_GAP_PX),
  );
}

function downstreamCapacityFor(
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

function upstreamCapacityFor(region: PresentationRegion | null, compactSize: number): number {
  if (!region) return 0;
  return rowCount(region, compactSize, BOARD_GAP_PX + FAMILY_GAP_PX)
    * columnCount(region, compactSize, BOARD_GAP_PX);
}

function compactCells(
  region: PresentationRegion,
  size: number,
  verticalGap: number,
  side: PlacementSide,
): PlacementCell[] {
  const ys = rowCenters(region, size, verticalGap);
  return columnCenters(region, size, BOARD_GAP_PX)
    .flatMap((x) => ys.map((y) => Object.freeze({
      x,
      y,
      tier: 'compact' as const,
      side,
    })));
}

function placementCells(geometry: PresentationGeometry): PlacementCell[] {
  const cells: PlacementCell[] = [];

  if (geometry.upstreamRegion) {
    cells.push(...compactCells(
      geometry.upstreamRegion,
      geometry.compactSize,
      BOARD_GAP_PX + FAMILY_GAP_PX,
      'upstream',
    ));
  }

  const prominentRows = prominentRowCount(geometry.downstreamRegion, geometry.prominentSize);
  if (prominentRows) {
    const x = geometry.downstreamRegion.left + geometry.prominentSize / 2;
    for (const y of rowCenters(
      geometry.downstreamRegion,
      geometry.prominentSize,
      BOARD_GAP_PX + FAMILY_GAP_PX,
      MAX_PROMINENT_LINES,
    )) {
      cells.push(Object.freeze({ x, y, tier: 'prominent', side: 'downstream' }));
    }
    const compactRegion = insetLeft(
      geometry.downstreamRegion,
      geometry.prominentSize + BOARD_GAP_PX,
    );
    cells.push(...compactCells(
      compactRegion,
      geometry.compactSize,
      BOARD_GAP_PX,
      'downstream',
    ));
  } else {
    cells.push(...compactCells(
      geometry.downstreamRegion,
      geometry.compactSize,
      BOARD_GAP_PX,
      'downstream',
    ));
  }

  return cells;
}

function placementSide(node: PresentationNode): PlacementSide {
  return node.relation === 'root' || node.relation === 'sibling'
    ? 'upstream'
    : 'downstream';
}

function familyIds(node: PresentationNode): string[] {
  return [...new Set((node.families ?? []).filter(Boolean))];
}

function average(values: readonly number[], fallback: number): number {
  if (!values.length) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stableTopologyOrder(
  topology: PresentationTopology,
  indexed: readonly IndexedNode[],
): PresentationNode[] {
  const byKey = new Map(indexed.map((item) => [item.node.key, item]));
  const knownKeys = new Set([topology.center, ...byKey.keys()]);
  const indegree = new Map<string, number>([topology.center, ...byKey.keys()].map((key) => [key, 0]));
  const children = new Map<string, string[]>();
  const seenEdges = new Set<string>();
  const familyRank = new Map<string, number>();

  for (const { node, index } of indexed) {
    for (const family of familyIds(node)) {
      if (!familyRank.has(family)) familyRank.set(family, index);
    }
  }

  for (const relationship of topology.relationships) {
    if (!knownKeys.has(relationship.source) || !knownKeys.has(relationship.target)) continue;
    if (relationship.source === relationship.target) continue;
    const id = relationship.source + '\u0000' + relationship.target;
    if (seenEdges.has(id)) continue;
    seenEdges.add(id);
    if (!children.has(relationship.source)) children.set(relationship.source, []);
    children.get(relationship.source)?.push(relationship.target);
    indegree.set(relationship.target, (indegree.get(relationship.target) ?? 0) + 1);
  }

  const compare = (leftKey: string, rightKey: string): number => {
    if (leftKey === topology.center) return rightKey === topology.center ? 0 : -1;
    if (rightKey === topology.center) return 1;
    const left = byKey.get(leftKey);
    const right = byKey.get(rightKey);
    if (!left || !right) return leftKey.localeCompare(rightKey);
    const leftSide = placementSide(left.node) === 'upstream' ? 0 : 1;
    const rightSide = placementSide(right.node) === 'upstream' ? 0 : 1;
    const leftAnchor = left.node.relation === 'root' || left.node.relation === 'outgoing' ? 0 : 1;
    const rightAnchor = right.node.relation === 'root' || right.node.relation === 'outgoing' ? 0 : 1;
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
    return leftSide - rightSide
      || leftAnchor - rightAnchor
      || leftDistance - rightDistance
      || leftFamily - rightFamily
      || left.index - right.index
      || left.node.key.localeCompare(right.node.key);
  };

  const ready = [...indegree]
    .filter(([, degree]) => degree === 0)
    .map(([key]) => key)
    .sort(compare);
  const ordered: PresentationNode[] = [];
  const emitted = new Set<string>();

  while (ready.length) {
    const key = ready.shift();
    if (!key || emitted.has(key)) continue;
    emitted.add(key);
    if (key !== topology.center) {
      const item = byKey.get(key);
      if (item) ordered.push(item.node);
    }
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

function chooseCell(
  available: PlacementCell[],
  side: PlacementSide,
  minX: number,
  maxX: number,
  targetY: number,
): PlacementCell | null {
  const eligible = available
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => cell.side === side && cell.x >= minX && cell.x <= maxX);
  if (!eligible.length) return null;
  const firstX = Math.min(...eligible.map(({ cell }) => cell.x));
  const sameColumn = eligible.filter(({ cell }) => cell.x === firstX);
  sameColumn.sort((left, right) => (
    Math.abs(left.cell.y - targetY) - Math.abs(right.cell.y - targetY)
    || left.cell.y - right.cell.y
  ));
  const selected = sameColumn[0];
  if (!selected) return null;
  available.splice(selected.index, 1);
  return selected.cell;
}

function pointFor(
  key: string,
  topology: PresentationTopology,
  geometry: PresentationGeometry,
  placed: ReadonlyMap<string, NodePlacement>,
): Readonly<{ x: number; y: number }> | null {
  if (key === topology.center) return geometry.center;
  return placed.get(key) ?? null;
}

export function placeConstellation(
  geometry: PresentationGeometry,
  topology: PresentationTopology,
): ReadonlyMap<string, NodePlacement> {
  const indexed = topology.nodes.map((node, index) => ({ node, index }));
  const upstreamCount = indexed.filter(({ node }) => placementSide(node) === 'upstream').length;
  const downstreamCount = indexed.length - upstreamCount;
  if (downstreamCount > geometry.lineCapacity) {
    throw new RangeError(
      'Accepted downstream Constellation exceeds line capacity: '
      + downstreamCount + ' > ' + geometry.lineCapacity,
    );
  }
  if (upstreamCount > geometry.rootCapacity) {
    throw new RangeError(
      'Accepted upstream context exceeds root capacity: '
      + upstreamCount + ' > ' + geometry.rootCapacity,
    );
  }

  const available = placementCells(geometry);
  const result = new Map<string, NodePlacement>();
  const familyY = new Map<string, number>();
  const order = stableTopologyOrder(topology, indexed);

  for (const node of order) {
    const side = placementSide(node);
    const linked = topology.relationships.filter(
      (relationship) => relationship.source === node.key || relationship.target === node.key,
    );
    const sourcePoints = linked
      .filter((relationship) => relationship.target === node.key)
      .map((relationship) => pointFor(relationship.source, topology, geometry, result))
      .filter((point): point is Readonly<{ x: number; y: number }> => point != null);
    const targetPoints = linked
      .filter((relationship) => relationship.source === node.key)
      .map((relationship) => pointFor(relationship.target, topology, geometry, result))
      .filter((point): point is Readonly<{ x: number; y: number }> => point != null);

    const minX = sourcePoints.length
      ? Math.max(...sourcePoints.map((point) => point.x))
      : Number.NEGATIVE_INFINITY;
    const maxX = targetPoints.length
      ? Math.min(...targetPoints.map((point) => point.x))
      : Number.POSITIVE_INFINITY;
    const neighborYs = [...sourcePoints, ...targetPoints].map((point) => point.y);
    const familyYs = familyIds(node)
      .map((family) => familyY.get(family))
      .filter((value): value is number => Number.isFinite(value));
    const region = side === 'upstream' ? geometry.upstreamRegion : geometry.downstreamRegion;
    if (!region) {
      throw new RangeError('Accepted upstream context has no presentation region');
    }
    const fallbackY = (region.top + region.bottom) / 2;
    const targetY = average(neighborYs, average(familyYs, fallbackY));
    const cell = chooseCell(available, side, minX, maxX, targetY);
    if (!cell) {
      throw new RangeError(
        'Accepted Constellation cannot be placed without reversing a visible relationship',
      );
    }

    const prominent = cell.tier === 'prominent' && node.relation === 'outgoing';
    const placement = Object.freeze({
      x: cell.x,
      y: cell.y,
      size: prominent ? geometry.prominentSize : geometry.compactSize,
      tier: prominent ? 'prominent' as const : 'compact' as const,
    });
    result.set(node.key, placement);
    for (const family of familyIds(node)) {
      if (!familyY.has(family)) familyY.set(family, placement.y);
    }
  }

  return result;
}

export function derivePresentationGeometry({
  width,
  height,
  upstreamContext = false,
  upstreamTop = MAP_PADDING_PX,
}: {
  width: number;
  height: number;
  upstreamContext?: boolean;
  upstreamTop?: number;
}): PresentationGeometry {
  const safeWidth = Math.max(320, Number.isFinite(width) ? width : 320);
  const safeHeight = Math.max(240, Number.isFinite(height) ? height : 240);
  const safeUpstreamTop = clamp(
    Number.isFinite(upstreamTop) ? Number(upstreamTop) : MAP_PADDING_PX,
    MAP_PADDING_PX,
    safeHeight - MAP_PADDING_PX,
  );
  const centerLimit = Math.max(
    160,
    Math.min(safeHeight - MAP_PADDING_PX * 2, safeWidth * (upstreamContext ? 0.32 : 0.36)),
  );
  const centerSize = clamp(centerLimit, 160, 470);
  const prominentSize = clamp(centerSize * 0.30, 76, 128);
  const compactSize = clamp(centerSize * 0.21, 54, 92);
  const minimumCenterX = MAP_PADDING_PX + centerSize / 2;
  const maximumCenterX = safeWidth - MAP_PADDING_PX - centerSize / 2;
  const desiredCenterX = safeWidth * (upstreamContext ? 0.40 : 0.27);
  const centerX = clamp(desiredCenterX, minimumCenterX, maximumCenterX);

  const downstreamRegion = Object.freeze({
    left: centerX + centerSize / 2 + BOARD_GAP_PX,
    right: safeWidth - MAP_PADDING_PX,
    top: MAP_PADDING_PX,
    bottom: safeHeight - MAP_PADDING_PX,
  });
  const upstreamRegion = upstreamContext
    ? Object.freeze({
      left: MAP_PADDING_PX,
      right: centerX - centerSize / 2 - BOARD_GAP_PX,
      top: safeUpstreamTop,
      bottom: safeHeight - MAP_PADDING_PX,
    })
    : null;

  return Object.freeze({
    width: safeWidth,
    height: safeHeight,
    center: Object.freeze({ x: centerX, y: safeHeight / 2, size: centerSize }),
    upstreamRegion,
    downstreamRegion,
    prominentSize,
    compactSize,
    lineCapacity: downstreamCapacityFor(downstreamRegion, prominentSize, compactSize),
    rootCapacity: upstreamCapacityFor(upstreamRegion, compactSize),
  });
}

export function compositionConstraints(geometry: PresentationGeometry): PresentationConstraints {
  return Object.freeze({
    lineCapacity: geometry.lineCapacity,
    rootCapacity: geometry.rootCapacity,
  });
}
