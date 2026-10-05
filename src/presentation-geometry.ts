const MAP_PADDING_PX = 20;
const BOARD_GAP_PX = 16;
const FAMILY_GAP_PX = 30;
const MAX_LINE_CAPACITY = 16;
const MAX_ROOT_CONTEXT_CAPACITY = 6;
const MAX_PROMINENT_LINES = 4;

export type PresentationSlot = Readonly<{
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
  prominentSize: number;
  compactSize: number;
  lineSlots: readonly PresentationSlot[];
  rootSlots: readonly PresentationSlot[];
  lineCapacity: number;
  rootCapacity: number;
  prominentLineCapacity: number;
}>;

export type PresentationConstraints = Readonly<{
  lineCapacity: number;
  rootCapacity: number;
}>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rowCenters(height: number, padding: number, size: number, gap: number, maxRows = 5): number[] {
  const usable = Math.max(size, height - padding * 2);
  const count = Math.max(1, Math.min(maxRows, Math.floor((usable + gap) / (size + gap))));
  if (count === 1) return [height / 2];
  const span = (count - 1) * (size + gap);
  const start = height / 2 - span / 2;
  return Array.from({ length: count }, (_, index) => start + index * (size + gap));
}

function lineSlots({
  width,
  height,
  centerX,
  centerSize,
  prominentSize,
  compactSize,
}: {
  width: number;
  height: number;
  centerX: number;
  centerSize: number;
  prominentSize: number;
  compactSize: number;
}): PresentationSlot[] {
  const result: PresentationSlot[] = [];
  let x = centerX + centerSize / 2 + BOARD_GAP_PX + prominentSize / 2;
  const right = width - MAP_PADDING_PX;
  if (x + prominentSize / 2 <= right) {
    for (const y of rowCenters(height, MAP_PADDING_PX, prominentSize, BOARD_GAP_PX + FAMILY_GAP_PX, MAX_PROMINENT_LINES)) {
      result.push({ x, y, size: prominentSize, tier: 'prominent' });
    }
    x += prominentSize / 2 + BOARD_GAP_PX + compactSize / 2;
  } else {
    x = centerX + centerSize / 2 + BOARD_GAP_PX + compactSize / 2;
  }

  const ys = rowCenters(height, MAP_PADDING_PX, compactSize, BOARD_GAP_PX);
  while (result.length < MAX_LINE_CAPACITY && x + compactSize / 2 <= right) {
    for (const y of ys) {
      if (result.length >= MAX_LINE_CAPACITY) break;
      result.push({ x, y, size: compactSize, tier: 'compact' });
    }
    x += compactSize + BOARD_GAP_PX;
  }
  return result;
}

function rootSlots({
  height,
  centerX,
  centerSize,
  compactSize,
}: {
  height: number;
  centerX: number;
  centerSize: number;
  compactSize: number;
}): PresentationSlot[] {
  const xs: number[] = [];
  let x = centerX - centerSize / 2 - BOARD_GAP_PX - compactSize / 2;
  while (x - compactSize / 2 >= MAP_PADDING_PX) {
    xs.push(x);
    x -= compactSize + BOARD_GAP_PX;
  }
  const ys = rowCenters(height, MAP_PADDING_PX, compactSize, BOARD_GAP_PX + FAMILY_GAP_PX);
  return ys.flatMap((y) => xs.map((slotX) => ({
    x: slotX,
    y,
    size: compactSize,
    tier: 'compact' as const,
  })));
}

function isRootContext(node: PresentationNode | undefined): boolean {
  return node?.relation === 'root' || node?.relation === 'sibling';
}

function average(values: readonly number[], fallback: number): number {
  if (!values.length) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function takeBest(
  slots: PresentationSlot[],
  targetY: number,
  horizontal: 'left-to-right' | 'right-to-left',
  accept: (slot: PresentationSlot) => boolean = () => true,
): PresentationSlot | null {
  const candidates = slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => accept(slot));
  if (!candidates.length) return null;
  let best = candidates[0];
  for (let offset = 1; offset < candidates.length; offset += 1) {
    const candidate = candidates[offset];
    const candidateDistance = Math.abs(candidate.slot.y - targetY);
    const bestDistance = Math.abs(best.slot.y - targetY);
    const horizontalOrder = horizontal === 'left-to-right'
      ? candidate.slot.x - best.slot.x
      : best.slot.x - candidate.slot.x;
    if (candidateDistance < bestDistance
      || (candidateDistance === bestDistance && horizontalOrder < 0)
      || (candidateDistance === bestDistance && horizontalOrder === 0 && candidate.slot.y < best.slot.y)) {
      best = candidate;
    }
  }
  return slots.splice(best.index, 1)[0] ?? null;
}

function compactSlot(geometry: PresentationGeometry, slot: PresentationSlot): PresentationSlot {
  if (slot.tier === 'compact' && slot.size === geometry.compactSize) return slot;
  return Object.freeze({ x: slot.x, y: slot.y, size: geometry.compactSize, tier: 'compact' as const });
}

function familyYs(
  node: PresentationNode,
  anchors: ReadonlyMap<string, number>,
): number[] {
  return [...(node.families ?? [])]
    .map((family) => anchors.get(family))
    .filter((value): value is number => Number.isFinite(value));
}

function recordFamilyAnchors(
  node: PresentationNode,
  y: number,
  anchors: Map<string, number>,
): void {
  for (const family of node.families ?? []) if (!anchors.has(family)) anchors.set(family, y);
}

function sourcePoints(
  node: PresentationNode,
  topology: PresentationTopology,
  nodesByKey: ReadonlyMap<string, PresentationNode>,
  result: ReadonlyMap<string, PresentationSlot>,
  geometry: PresentationGeometry,
  side: 'lines' | 'roots',
): Array<Readonly<{ x: number; y: number }>> {
  const points: Array<Readonly<{ x: number; y: number }>> = [];
  for (const relationship of topology.relationships) {
    if (relationship.target !== node.key) continue;
    if (relationship.source === topology.center) {
      if (side === 'lines') points.push(geometry.center);
      continue;
    }
    const sourceNode = nodesByKey.get(relationship.source);
    if (side === 'lines' ? isRootContext(sourceNode) : !isRootContext(sourceNode)) continue;
    const point = result.get(relationship.source);
    if (point) points.push(point);
  }
  return points;
}

export function placeConstellation(
  geometry: PresentationGeometry,
  topology: PresentationTopology,
): ReadonlyMap<string, PresentationSlot> {
  const result = new Map<string, PresentationSlot>();
  const nodesByKey = new Map(topology.nodes.map((node) => [node.key, node]));
  const indexed = topology.nodes.map((node, index) => ({ node, index }));
  const lineNodes = indexed.filter(({ node }) => !isRootContext(node));
  const rootNodes = indexed.filter(({ node }) => isRootContext(node));
  const lineAnchors = lineNodes.filter(({ node }) => node.relation === 'outgoing');
  const lineRest = lineNodes
    .filter(({ node }) => node.relation !== 'outgoing')
    .sort((a, b) => (a.node.distance ?? Number.MAX_SAFE_INTEGER) - (b.node.distance ?? Number.MAX_SAFE_INTEGER) || a.index - b.index);
  const rootAnchors = rootNodes.filter(({ node }) => node.relation === 'root');
  const rootRest = rootNodes
    .filter(({ node }) => node.relation !== 'root')
    .sort((a, b) => (a.node.distance ?? Number.MAX_SAFE_INTEGER) - (b.node.distance ?? Number.MAX_SAFE_INTEGER) || a.index - b.index);
  const lineAvailable = geometry.lineSlots.slice();
  const rootAvailable = geometry.rootSlots.slice();
  const lineFamilyY = new Map<string, number>();
  const rootFamilyY = new Map<string, number>();

  lineAnchors.forEach(({ node }, index) => {
    const targetY = geometry.height * ((index + 1) / (lineAnchors.length + 1));
    const slot = takeBest(lineAvailable, targetY, 'left-to-right', (candidate) => candidate.tier === 'prominent')
      ?? takeBest(lineAvailable, targetY, 'left-to-right');
    if (!slot) return;
    result.set(node.key, slot);
    recordFamilyAnchors(node, slot.y, lineFamilyY);
  });

  lineRest.forEach(({ node }, index) => {
    const parents = sourcePoints(node, topology, nodesByKey, result, geometry, 'lines');
    const fallbackY = geometry.height * ((index + 1) / (lineRest.length + 1));
    const targetY = average(
      parents.map(({ y }) => y),
      average(familyYs(node, lineFamilyY), fallbackY),
    );
    const parentX = parents.length ? Math.max(...parents.map(({ x }) => x)) : geometry.center.x;
    const slot = takeBest(lineAvailable, targetY, 'left-to-right', (candidate) => candidate.x > parentX)
      ?? takeBest(lineAvailable, targetY, 'left-to-right');
    if (!slot) return;
    result.set(node.key, compactSlot(geometry, slot));
  });

  rootAnchors.forEach(({ node }, index) => {
    const targetY = geometry.height * ((index + 1) / (rootAnchors.length + 1));
    const slot = takeBest(rootAvailable, targetY, 'left-to-right');
    if (!slot) return;
    result.set(node.key, slot);
    recordFamilyAnchors(node, slot.y, rootFamilyY);
  });

  rootRest.forEach(({ node }, index) => {
    const parents = sourcePoints(node, topology, nodesByKey, result, geometry, 'roots');
    const fallbackY = geometry.height * ((index + 1) / (rootRest.length + 1));
    const targetY = average(
      parents.map(({ y }) => y),
      average(familyYs(node, rootFamilyY), fallbackY),
    );
    const parentX = parents.length ? Math.max(...parents.map(({ x }) => x)) : -Infinity;
    const slot = takeBest(rootAvailable, targetY, 'left-to-right', (candidate) => candidate.x > parentX)
      ?? takeBest(rootAvailable, targetY, 'right-to-left');
    if (!slot) return;
    result.set(node.key, slot);
  });

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
  const centerLimit = Math.max(160, Math.min(safeHeight - MAP_PADDING_PX * 2, safeWidth * (rootContext ? 0.32 : 0.36)));
  const centerSize = clamp(centerLimit, 160, 470);
  const prominentSize = clamp(centerSize * 0.30, 76, 128);
  const compactSize = clamp(centerSize * 0.21, 54, 92);
  const minimumCenterX = MAP_PADDING_PX + centerSize / 2;
  const maximumCenterX = safeWidth - MAP_PADDING_PX - centerSize / 2;
  const desiredCenterX = safeWidth * (rootContext ? 0.40 : 0.27);
  const centerX = clamp(desiredCenterX, minimumCenterX, maximumCenterX);
  const lines = lineSlots({ width: safeWidth, height: safeHeight, centerX, centerSize, prominentSize, compactSize });
  const roots = rootContext ? rootSlots({ height: safeHeight, centerX, centerSize, compactSize }) : [];
  const frozenLines: readonly PresentationSlot[] = lines.map((slot) => Object.freeze(slot));
  const frozenRoots: readonly PresentationSlot[] = roots.map((slot) => Object.freeze(slot));

  return Object.freeze({
    width: safeWidth,
    height: safeHeight,
    center: Object.freeze({ x: centerX, y: safeHeight / 2, size: centerSize }),
    prominentSize,
    compactSize,
    lineSlots: Object.freeze(frozenLines),
    rootSlots: Object.freeze(frozenRoots),
    lineCapacity: Math.max(1, lines.length),
    rootCapacity: rootContext ? Math.min(MAX_ROOT_CONTEXT_CAPACITY, roots.length) : 0,
    prominentLineCapacity: lines.filter((slot) => slot.tier === 'prominent').length,
  });
}

export function compositionConstraints(geometry: PresentationGeometry): PresentationConstraints {
  return Object.freeze({ lineCapacity: geometry.lineCapacity, rootCapacity: geometry.rootCapacity });
}
