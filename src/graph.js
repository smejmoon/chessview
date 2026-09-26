import { Chess } from 'chess.js';
import {
  addLineCandidates,
  createLineFrontier,
  hasLineCandidates,
  takeLineCandidate,
} from './line-frontier.js';
import { createVisibleGraph } from './visible-graph.js';

export const AUTO_THRESHOLD = 0.05;
export const AUTO_SAMPLE_FLOOR = 80;
export const EXPLORER_TTL_MS = 24 * 60 * 60 * 1000;
export const START_FEN = new Chess().fen();

export function toPlayableFen(positionKey) {
  const parts = positionKey.trim().split(/\s+/);
  if (parts.length >= 6) return parts.slice(0, 6).join(' ');
  if (parts.length === 4) return `${parts.join(' ')} 0 1`;
  throw new Error('Invalid chess position');
}

export function canonicalPosition(fen) {
  const chess = new Chess(toPlayableFen(fen));
  const [placement, turn, castling, ep] = chess.fen().split(' ');
  let relevantEp = '-';
  if (ep !== '-') {
    const canCaptureEp = chess.moves({ verbose: true }).some((move) => move.flags.includes('e'));
    if (canCaptureEp) relevantEp = ep;
  }
  return `${placement} ${turn} ${castling || '-'} ${relevantEp}`;
}

export function moveToChild(sourceKey, move) {
  const chess = new Chess(toPlayableFen(sourceKey));
  const uciPromotion = move.uci?.slice(4) || undefined;
  const played = chess.move({
    from: move.from ?? move.uci?.slice(0, 2),
    to: move.to ?? move.uci?.slice(2, 4),
    promotion: move.promotion ?? uciPromotion,
  });
  if (!played) throw new Error(`Illegal move from graph source: ${move.uci ?? ''}`);
  return {
    key: canonicalPosition(chess.fen()),
    fen: chess.fen(),
    san: played.san,
    uci: `${played.from}${played.to}${played.promotion ?? ''}`,
  };
}

export function totalGames(explorer) {
  return (explorer?.white ?? 0) + (explorer?.draws ?? 0) + (explorer?.black ?? 0);
}

export function moveGames(move) {
  return (move?.white ?? 0) + (move?.draws ?? 0) + (move?.black ?? 0);
}

export function decorateExplorerMoves(explorer) {
  const total = totalGames(explorer);
  return (explorer?.moves ?? []).map((move) => ({
    ...move,
    games: moveGames(move),
    share: total ? moveGames(move) / total : 0,
    qualifies: total >= AUTO_SAMPLE_FLOOR && moveGames(move) / Math.max(1, total) >= AUTO_THRESHOLD,
  }));
}

export function omittedShare(explorer) {
  return decorateExplorerMoves(explorer)
    .filter((move) => !move.qualifies)
    .reduce((sum, move) => sum + move.share, 0);
}

export function edgeId(edge) {
  return `${edge.source}|${edge.uci}|${edge.target}`;
}

export function positionFromUrl(search = window.location.search) {
  const params = new URLSearchParams(search);
  const raw = params.get('fen');
  if (!raw) return canonicalPosition(START_FEN);
  try {
    return canonicalPosition(raw);
  } catch {
    return canonicalPosition(START_FEN);
  }
}

export function positionUrl(key) {
  const url = new URL(window.location.href);
  url.searchParams.set('fen', canonicalPosition(key));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function legalDestinations(positionKey) {
  const chess = new Chess(toPlayableFen(positionKey));
  const destinations = new Map();
  for (const move of chess.moves({ verbose: true })) {
    if (!destinations.has(move.from)) destinations.set(move.from, []);
    if (!destinations.get(move.from).includes(move.to)) destinations.get(move.from).push(move.to);
  }
  return destinations;
}

export function stableEdgeOrder(a, b) {
  return (b.share ?? 0) - (a.share ?? 0) || a.uci.localeCompare(b.uci) || a.target.localeCompare(b.target);
}

function stableIncomingEdgeOrder(a, b) {
  return (b.games ?? 0) - (a.games ?? 0)
    || (b.share ?? 0) - (a.share ?? 0)
    || (a.uci ?? '').localeCompare(b.uci ?? '')
    || a.source.localeCompare(b.source)
    || a.target.localeCompare(b.target);
}

function lineChildren(outgoingBySource, key, distance, breadth = 0) {
  return (outgoingBySource.get(key) ?? [])
    .filter((edge) => edge.qualifies)
    .slice()
    .sort(stableEdgeOrder)
    .map((edge, index) => ({
      key: edge.target,
      edge,
      distance,
      depth: distance,
      breadth: breadth + index,
    }));
}

export function chooseNeighborhood({ center, incoming = [], outgoingBySource = new Map(), max = 19 }) {
  const visible = createVisibleGraph({ center, direction: 'lines', max });

  incoming
    .slice()
    .sort((a, b) => (b.games ?? 0) - (a.games ?? 0) || a.key.localeCompare(b.key))
    .slice(0, Math.min(4, Math.max(1, Math.floor(max / 4))))
    .forEach((item) => visible.addNode({ ...item, relation: 'incoming', distance: 1 }));

  const roots = (outgoingBySource.get(center) ?? [])
    .filter((edge) => edge.qualifies || edge.manual)
    .slice()
    .sort(stableEdgeOrder);

  const lineFrontiers = [];
  for (const root of roots) {
    if (!visible.hasNode(root.target) && visible.boardCount() >= max) continue;
    const family = root.uci;
    const lineShare = root.share ?? 0;
    visible.ensureFamily(family, { direction: 'lines', lineShare, rootEdgeId: edgeId(root) });
    const result = visible.addNode({
      key: root.target,
      edge: root,
      relation: 'outgoing',
      distance: 1,
      branch: family,
      lineShare,
      families: [family],
    });
    if (!result.node) continue;
    visible.addRelationship({ edge: root, family, distance: 1, lineShare });

    const frontier = createLineFrontier(family, null, lineShare);
    frontier.seenEdges = new Set([edgeId(root)]);
    addLineCandidates(frontier, lineChildren(outgoingBySource, root.target, 2));
    lineFrontiers.push(frontier);
  }

  while (hasLineCandidates(lineFrontiers)) {
    let progressed = false;
    for (const frontier of lineFrontiers) {
      const next = takeLineCandidate(frontier, (candidate) => (
        !frontier.seenEdges.has(edgeId(candidate.edge))
        && (visible.hasNode(candidate.key) || visible.boardCount() < max)
      ));
      if (!next) continue;
      frontier.seenEdges.add(edgeId(next.edge));

      const result = visible.addNode({
        ...next,
        relation: 'descendant',
        branch: frontier.branch,
        lineShare: frontier.lineShare,
        families: [frontier.branch],
      });
      if (!result.node) continue;

      visible.addRelationship({
        edge: next.edge,
        family: frontier.branch,
        distance: next.distance,
        lineShare: frontier.lineShare,
      });
      addLineCandidates(frontier, lineChildren(
        outgoingBySource,
        next.key,
        next.distance + 1,
        next.breadth,
      ));
      progressed = true;
    }
    if (!progressed) break;
  }

  return visible.result();
}

function rootCandidates(incomingByTarget, target, distance) {
  return (incomingByTarget.get(target) ?? [])
    .slice()
    .sort(stableIncomingEdgeOrder)
    .map((edge) => ({ key: edge.source, edge, distance }));
}

export function chooseRootNeighborhood({ center, incomingByTarget = new Map(), max = 19 }) {
  const visible = createVisibleGraph({ center, direction: 'roots', max });
  const frontiers = [];

  const immediate = (incomingByTarget.get(center) ?? [])
    .slice()
    .sort(stableIncomingEdgeOrder);

  for (const edge of immediate) {
    const family = edge.source;
    if (!visible.hasNode(family) && visible.boardCount() >= max) continue;
    visible.ensureFamily(family, { direction: 'roots', rootEdgeId: edgeId(edge) });
    const result = visible.addNode({
      key: family,
      edge,
      relation: 'root',
      distance: 1,
      branch: family,
      branches: [family],
      families: [family],
    });
    if (!result.node) continue;
    visible.addRelationship({ edge, family, distance: 1 });
    frontiers.push({
      branch: family,
      pending: rootCandidates(incomingByTarget, family, 2),
      seenEdges: new Set([edgeId(edge)]),
    });
  }

  while (frontiers.some((frontier) => frontier.pending.length > 0)) {
    let progressed = false;

    for (const frontier of frontiers) {
      while (frontier.pending.length) {
        const candidate = frontier.pending.shift();
        if (!candidate || candidate.key === center) continue;
        const candidateEdgeId = edgeId(candidate.edge);
        if (frontier.seenEdges.has(candidateEdgeId)) continue;
        frontier.seenEdges.add(candidateEdgeId);
        if (!visible.hasNode(candidate.key) && visible.boardCount() >= max) continue;

        const downstream = visible.getNode(candidate.edge.target);
        const families = downstream?.families?.length ? downstream.families : [frontier.branch];
        families.forEach((family) => visible.ensureFamily(family, { direction: 'roots' }));
        const result = visible.addNode({
          ...candidate,
          relation: 'root',
          branch: families[0] ?? frontier.branch,
          branches: families,
          families,
        });
        if (!result.node) continue;
        visible.addRelationship({ edge: candidate.edge, families, distance: candidate.distance });

        frontier.pending.push(...rootCandidates(
          incomingByTarget,
          candidate.key,
          candidate.distance + 1,
        ));
        progressed = true;
        break;
      }
    }

    if (!progressed) break;
  }

  const result = visible.result();
  for (const node of result.nodes) {
    node.branches = [...node.families];
    node.edges = node.relationships
      .map((id) => result.relationshipById.get(id)?.edge)
      .filter(Boolean);
    node.edge = node.edges[0] ?? node.edge;
    node.branch = node.branches[0] ?? node.branch;
    node.merge = node.edges.length > 1 || node.branches.length > 1;
  }
  return result;
}
