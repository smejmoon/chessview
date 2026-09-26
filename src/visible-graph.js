function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function relationshipId(edge) {
  return `${edge.source}|${edge.uci}|${edge.target}`;
}

export function createVisibleGraph({ center, direction, max = 19 }) {
  const nodes = [];
  const nodesByKey = new Map();
  const relationships = [];
  const relationshipsById = new Map();
  const families = new Map();

  const centerNode = {
    key: center,
    distance: 0,
    relation: 'center',
    families: [],
    relationships: [],
    merge: false,
  };
  nodesByKey.set(center, centerNode);

  function ensureFamily(id, metadata = {}) {
    if (!id) return null;
    const existing = families.get(id);
    if (existing) {
      Object.assign(existing, metadata);
      return existing;
    }
    const family = { id, ...metadata };
    families.set(id, family);
    return family;
  }

  function addNode({ key, distance, relation, families: familyIds = [], ...metadata }) {
    const existing = nodesByKey.get(key);
    if (existing) {
      existing.families = unique([...existing.families, ...familyIds]);
      existing.merge = existing.families.length > 1 || existing.relationships.length > 1;
      return { node: existing, added: false };
    }
    if (nodes.length >= max) return { node: null, added: false };

    const node = {
      key,
      distance,
      relation,
      ...metadata,
      families: unique(familyIds),
      relationships: [],
      merge: false,
    };
    nodes.push(node);
    nodesByKey.set(key, node);
    return { node, added: true };
  }

  function addRelationship({ edge, family, families: familyIds = [], distance, lineShare = null }) {
    if (!edge) return null;
    const ids = unique([family, ...familyIds]);
    const id = relationshipId(edge);
    const existing = relationshipsById.get(id);
    if (existing) {
      existing.families = unique([...existing.families, ...ids]);
      if (existing.lineShare == null && lineShare != null) existing.lineShare = lineShare;
      for (const key of [edge.source, edge.target]) {
        const node = nodesByKey.get(key);
        if (!node) continue;
        node.families = unique([...node.families, ...ids]);
        node.merge = node.families.length > 1 || node.relationships.length > 1;
      }
      return existing;
    }

    const relationship = {
      id,
      edge,
      source: edge.source,
      target: edge.target,
      distance,
      families: ids,
      lineShare,
    };
    relationships.push(relationship);
    relationshipsById.set(id, relationship);

    for (const key of [edge.source, edge.target]) {
      const node = nodesByKey.get(key);
      if (!node) continue;
      if (!node.relationships.includes(id)) node.relationships.push(id);
      node.families = unique([...node.families, ...ids]);
      node.merge = node.families.length > 1 || node.relationships.length > 1;
    }
    return relationship;
  }

  function relationshipsFor(key, { incoming = true, outgoing = true } = {}) {
    const node = nodesByKey.get(key);
    if (!node) return [];
    return node.relationships
      .map((id) => relationshipsById.get(id))
      .filter((relationship) => relationship && (
        (incoming && relationship.target === key)
        || (outgoing && relationship.source === key)
      ));
  }

  function result() {
    // Keep the node array iterable for existing board/layout consumers while the
    // explicit composition data moves those consumers off node-owned edges.
    nodes.center = center;
    nodes.direction = direction;
    nodes.nodes = nodes;
    nodes.relationships = relationships;
    nodes.families = [...families.values()];
    nodes.nodeByKey = nodesByKey;
    nodes.relationshipById = relationshipsById;
    nodes.relationshipsFor = relationshipsFor;
    return nodes;
  }

  return {
    center,
    direction,
    max,
    ensureFamily,
    addNode,
    addRelationship,
    getNode: (key) => nodesByKey.get(key) ?? null,
    hasNode: (key) => nodesByKey.has(key),
    boardCount: () => nodes.length,
    result,
  };
}
