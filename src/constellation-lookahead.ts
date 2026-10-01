const DEFAULT_LOOKAHEAD_LIMIT = 4;

export type ConstellationLookaheadNode = Readonly<{
  key?: string;
}>;

export type ConstellationLookaheadStructure = Readonly<{
  composition?: Readonly<{
    nodes?: readonly ConstellationLookaheadNode[];
  }>;
}>;

export type ConstellationLookaheadOptions = Readonly<{
  center?: string;
  structure?: ConstellationLookaheadStructure;
  max?: number;
}>;

function limitValue(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_LOOKAHEAD_LIMIT;
  return Math.max(0, Math.floor(value));
}

export function nominateConstellationLookahead({
  center,
  structure,
  max = DEFAULT_LOOKAHEAD_LIMIT,
}: ConstellationLookaheadOptions = {}): readonly string[] {
  const limit = limitValue(max);
  if (limit === 0) return Object.freeze([] as string[]);

  const nodes = Array.isArray(structure?.composition?.nodes)
    ? structure.composition.nodes
    : [];
  const seen = new Set<string>(typeof center === 'string' && center ? [center] : []);
  const nominations: string[] = [];

  for (const node of nodes) {
    const key = node?.key;
    if (typeof key !== 'string' || !key || seen.has(key)) continue;
    seen.add(key);
    nominations.push(key);
    if (nominations.length >= limit) break;
  }

  return Object.freeze(nominations);
}
