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

export type FamilyPlacementItem = Readonly<{
  key: string;
  family: string;
  anchor?: boolean;
}>;

export type PresentationGeometry = Readonly<{
  width: number;
  height: number;
  center: Readonly<{ x: number; y: number; size: number }>;
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

function grouped(items: readonly FamilyPlacementItem[]): Array<{
  family: string;
  anchor: FamilyPlacementItem;
  rest: FamilyPlacementItem[];
}> {
  const byFamily = new Map<string, FamilyPlacementItem[]>();
  for (const item of items) {
    const family = item.family || item.key;
    if (!byFamily.has(family)) byFamily.set(family, []);
    byFamily.get(family)?.push(item);
  }
  return [...byFamily.entries()].map(([family, familyItems]) => {
    const anchor = familyItems.find((item) => item.anchor) ?? familyItems[0];
    return {
      family,
      anchor,
      rest: familyItems.filter((item) => item !== anchor),
    };
  });
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

function familyBandHalfHeight(groups: number, height: number): number {
  if (groups <= 1) return height / 2;
  return Math.max(54, (height - MAP_PADDING_PX * 2) / groups / 2 - FAMILY_GAP_PX / 2);
}

export function placeLineFamilies(
  geometry: PresentationGeometry,
  items: readonly FamilyPlacementItem[] = [],
): ReadonlyMap<string, PresentationSlot> {
  const result = new Map<string, PresentationSlot>();
  const groups = grouped(items.slice(0, geometry.lineCapacity));
  const prominent = geometry.lineSlots
    .filter((slot) => slot.tier === 'prominent')
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const compact = geometry.lineSlots
    .filter((slot) => slot.tier === 'compact')
    .slice();
  const familyY = new Map<string, number>();
  const familyBand = familyBandHalfHeight(groups.length, geometry.height);

  groups.forEach((group, index) => {
    const targetY = geometry.height * ((index + 1) / (groups.length + 1));
    let slot = takeBest(prominent, targetY, 'left-to-right');
    if (!slot) slot = takeBest(compact, targetY, 'left-to-right');
    if (!slot) return;
    result.set(group.anchor.key, slot);
    familyY.set(group.family, slot.y);
  });

  let round = 0;
  while (groups.some((group) => round < group.rest.length) && compact.length) {
    for (const group of groups) {
      const item = group.rest[round];
      if (!item) continue;
      const targetY = familyY.get(group.family) ?? geometry.height / 2;
      const slot = takeBest(compact, targetY, 'left-to-right', (candidate) => Math.abs(candidate.y - targetY) <= familyBand)
        ?? takeBest(compact, targetY, 'left-to-right');
      if (!slot) break;
      result.set(item.key, slot);
    }
    round += 1;
  }
  return result;
}

export function placeRootFamilies(
  geometry: PresentationGeometry,
  items: readonly FamilyPlacementItem[] = [],
): ReadonlyMap<string, PresentationSlot> {
  const result = new Map<string, PresentationSlot>();
  const groups = grouped(items.slice(0, geometry.rootCapacity));
  const available = geometry.rootSlots.slice();
  const familyY = new Map<string, number>();
  const familyX = new Map<string, number>();
  const familyBand = familyBandHalfHeight(groups.length, geometry.height);

  groups.forEach((group, index) => {
    const targetY = geometry.height * ((index + 1) / (groups.length + 1));
    const slot = takeBest(available, targetY, 'right-to-left');
    if (!slot) return;
    result.set(group.anchor.key, slot);
    familyY.set(group.family, slot.y);
    familyX.set(group.family, slot.x);
  });

  let round = 0;
  while (groups.some((group) => round < group.rest.length) && available.length) {
    for (const group of groups) {
      const item = group.rest[round];
      if (!item) continue;
      const targetY = familyY.get(group.family) ?? geometry.height / 2;
      const anchorX = familyX.get(group.family) ?? geometry.center.x;
      const inBand = (candidate: PresentationSlot) => Math.abs(candidate.y - targetY) <= familyBand;
      const slot = takeBest(available, targetY, 'right-to-left', (candidate) => candidate.x < anchorX && inBand(candidate))
        ?? takeBest(available, targetY, 'right-to-left', (candidate) => candidate.x < anchorX)
        ?? takeBest(available, targetY, 'right-to-left');
      if (!slot) break;
      result.set(item.key, slot);
    }
    round += 1;
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
