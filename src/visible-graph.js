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

  function result() {
    return {
      center,
      direction,
      nodes,
      relationships,
      families: [...families.values()],
      nodeByKey: nodesByKey,
      relationshipById: relationshipsById,
    };
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
