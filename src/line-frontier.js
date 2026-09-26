function candidatePriority(candidate) {
  return (candidate.depth ?? 1) + (candidate.breadth ?? 0);
}

function candidateOrder(a, b) {
  return candidatePriority(a) - candidatePriority(b)
    || (b.depth ?? 1) - (a.depth ?? 1)
    || a.frontierOrder - b.frontierOrder;
}

export function createLineFrontier(branch, initial = null, lineShare = 0) {
  const frontier = {
    branch,
    lineShare,
    pending: [],
    nextOrder: 0,
  };
  if (initial != null) addLineCandidates(frontier, [initial]);
  return frontier;
}

export function addLineCandidates(frontier, candidates) {
  for (const candidate of candidates ?? []) {
    frontier.pending.push({ ...candidate, frontierOrder: frontier.nextOrder++ });
  }
  frontier.pending.sort(candidateOrder);
}

export function takeLineCandidate(frontier, accept = () => true) {
  while (frontier.pending.length) {
    const candidate = frontier.pending.shift();
    if (accept(candidate)) return candidate;
  }
  return null;
}

export function hasLineCandidates(frontiers) {
  return frontiers.some((frontier) => frontier.pending.length > 0);
}
