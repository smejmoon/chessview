import './root-ui.css';
import { getIncoming } from './db.js';
import { canonicalPosition, START_FEN } from './graph.js';
import { drawVisibleEdges } from './map-render.js';
import { formatPgnMoves, formatPgnSuffix, reconstructPgnPath } from './pgn.js';
import { expandMoveOrderTranspositions } from './transpositions.js';
import {
  reportViewWorkSettled,
  requestViewRefresh,
  VIEW_RENDERED_EVENT,
} from './view-cycle.js';

const START = canonicalPosition(START_FEN);
const expandedTargets = new Set();
const expandingTargets = new Map();
let generation = 0;
let cueGeneration = 0;
let structureGeneration = 0;

async function collectIncomingToStart(target, maxDepth = 32) {
  const incomingByTarget = new Map();
  const queue = [{ key: target, depth: 0 }];
  const seen = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current.key) || current.depth >= maxDepth) continue;
    seen.add(current.key);

    const incoming = await getIncoming(current.key);
    incomingByTarget.set(current.key, incoming);
    if (incoming.some((edge) => edge.source === START)) break;

    for (const edge of incoming) {
      if (!seen.has(edge.source)) queue.push({ key: edge.source, depth: current.depth + 1 });
    }
  }

  return incomingByTarget;
}

async function expandCurrentRootTranspositions(target) {
  if (!target || expandedTargets.has(target)) return { addedEdges: 0 };
  if (expandingTargets.has(target)) return expandingTargets.get(target);

  const promise = (async () => {
    const incomingByTarget = await collectIncomingToStart(target);
    const referencePath = reconstructPgnPath(target, incomingByTarget, START);
    if (!referencePath?.length) return { addedEdges: 0 };

    const result = await expandMoveOrderTranspositions(referencePath, target, {
      maxPaths: 256,
      maxStates: 75_000,
    });
    expandedTargets.add(target);
    return result;
  })().finally(() => expandingTargets.delete(target));

  expandingTargets.set(target, promise);
  return promise;
}

function visibleRelationshipsFor(composition, key, { incoming = true, outgoing = true } = {}) {
  if (typeof composition?.relationshipsFor === 'function') {
    return composition.relationshipsFor(key, { incoming, outgoing });
  }
  return (composition?.relationships ?? []).filter((relationship) => (
    (incoming && relationship.target === key)
    || (outgoing && relationship.source === key)
  ));
}

function rootStructureFromComposition(map, composition) {
  if (!map || composition?.direction !== 'roots') return null;

  const positions = new Map();
  const center = map.querySelector('.center-position[data-key]');
  if (center?.dataset.key) positions.set(center.dataset.key, { element: center, depth: 0 });

  const satellitesByKey = new Map(
    [...map.querySelectorAll('.satellite[data-key]')]
      .filter((satellite) => satellite.dataset.key)
      .map((satellite) => [satellite.dataset.key, satellite]),
  );
  const entries = [];

  for (const node of composition.nodes ?? []) {
    const satellite = satellitesByKey.get(node.key);
    if (!satellite) continue;
    const relationships = visibleRelationshipsFor(composition, node.key, { incoming: false });
    const entry = {
      satellite,
      key: node.key,
      depth: node.distance,
      relationships,
      edges: relationships.map((relationship) => relationship.edge),
      branches: [...(node.families ?? [])],
      isMerge: node.merge === true,
      isShared: (node.families?.length ?? 0) > 1,
    };
    positions.set(node.key, { element: satellite, depth: node.distance });
    entries.push(entry);
  }

  return {
    map,
    composition,
    positions,
    entries,
    entriesByKey: new Map(entries.map((entry) => [entry.key, entry])),
  };
}

function rootLaneY(index, count) {
  if (count <= 1) return 50;
  return 16 + (68 * index) / Math.max(1, count - 1);
}

function layoutRootSatellites(structure) {
  const { map, entries } = structure ?? {};
  const center = map?.querySelector('.center-position');
  if (!map || !center || !entries?.length) return;

  const mapRect = map.getBoundingClientRect();
  const centerRect = center.getBoundingClientRect();
  const maxDepth = Math.max(...entries.map((entry) => entry.depth));
  const firstLevel = entries.filter((entry) => entry.depth === 1);
  const lastLevel = entries.filter((entry) => entry.depth === maxDepth);
  const firstHalf = Math.max(38, ...firstLevel.map((entry) => entry.satellite.getBoundingClientRect().width / 2));
  const lastHalf = Math.max(28, ...lastLevel.map((entry) => entry.satellite.getBoundingClientRect().width / 2));
  const startX = centerRect.left - mapRect.left - firstHalf - 18;
  const endX = lastHalf + 18;
  const span = Math.max(0, startX - endX);

  const familyY = new Map();
  firstLevel.forEach((entry, index) => familyY.set(entry.key, rootLaneY(index, firstLevel.length)));

  const groups = new Map();
  for (const entry of entries) {
    const progress = maxDepth <= 1 ? 0 : (entry.depth - 1) / (maxDepth - 1);
    const x = Math.max(endX, startX - span * progress);
    entry.satellite.style.setProperty('--x', `${x}px`);

    const ys = entry.branches.map((branch) => familyY.get(branch)).filter(Number.isFinite);
    const baseY = ys.length ? ys.reduce((sum, value) => sum + value, 0) / ys.length : 50;
    const signature = `${entry.depth}:${entry.branches.join('|')}`;
    if (!groups.has(signature)) groups.set(signature, []);
    groups.get(signature).push({ entry, baseY });
  }

  for (const group of groups.values()) {
    group.forEach(({ entry, baseY }, index) => {
      const offset = (index - (group.length - 1) / 2) * 8;
      const y = Math.max(8, Math.min(92, baseY + offset));
      entry.satellite.style.setProperty('--y', `${y}%`);
    });
  }

  for (const entry of entries) {
    entry.satellite.classList.toggle('is-transposition-merge', entry.isMerge);
    entry.satellite.classList.toggle('is-shared-root-ancestry', entry.isShared && !entry.isMerge);
    entry.satellite.dataset.rootFamilies = entry.branches.join('|');

    const label = entry.satellite.querySelector('.mini-label');
    let badge = label?.querySelector('.root-merge-badge');
    if (entry.isMerge) {
      if (!badge && label) {
        badge = document.createElement('span');
        badge.className = 'root-merge-badge';
        label.appendChild(badge);
      }
      if (badge) badge.textContent = `merge · ${Math.max(2, entry.branches.length)}`;
    } else {
      badge?.remove();
    }
  }
}

function squareCenter(square, orientation) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  if (orientation === 'black') return { x: 7 - file + 0.5, y: rank - 0.5 };
  return { x: file + 0.5, y: 8 - rank + 0.5 };
}

function moveCueMarkup(edge, kind) {
  const match = (edge?.uci ?? '').match(/^([a-h][1-8])([a-h][1-8])/);
  if (!match) return '';

  const orientation = localStorage.getItem('chessview.orientation') === 'black' ? 'black' : 'white';
  const from = squareCenter(match[1], orientation);
  const to = squareCenter(match[2], orientation);
  if (!from || !to) return '';

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (!length) return '';

  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;
  const tip = { x: to.x - ux * 0.12, y: to.y - uy * 0.12 };
  const base = { x: to.x - ux * 0.7, y: to.y - uy * 0.7 };
  const wing = 0.26;
  const lineEnd = { x: base.x - ux * 0.02, y: base.y - uy * 0.02 };
  const n = (value) => Number(value).toFixed(3);

  return `<svg class="move-cue is-${kind}" viewBox="0 0 8 8" aria-hidden="true">
    <rect class="move-cue-square" x="${n(from.x - 0.5)}" y="${n(from.y - 0.5)}" width="1" height="1" rx="0.08"></rect>
    <rect class="move-cue-square move-cue-destination" x="${n(to.x - 0.5)}" y="${n(to.y - 0.5)}" width="1" height="1" rx="0.08"></rect>
    <line class="move-cue-shaft" x1="${n(from.x)}" y1="${n(from.y)}" x2="${n(lineEnd.x)}" y2="${n(lineEnd.y)}"></line>
    <polygon class="move-cue-head" points="${n(tip.x)},${n(tip.y)} ${n(base.x + px * wing)},${n(base.y + py * wing)} ${n(base.x - px * wing)},${n(base.y - py * wing)}"></polygon>
  </svg>`;
}

function decorateMoveCues(composition, rootStructure = null) {
  const run = ++cueGeneration;
  const map = document.querySelector('.map');
  if (!map || !composition) return;

  const mode = map.classList.contains('mode-roots') ? 'roots' : 'lines';
  const satellitesByKey = new Map(
    [...map.querySelectorAll('.satellite[data-key]')]
      .filter((satellite) => satellite.dataset.key)
      .map((satellite) => [satellite.dataset.key, satellite]),
  );
  const resolved = mode === 'roots' && rootStructure
    ? rootStructure.entries.map((entry) => ({ satellite: entry.satellite, edges: entry.edges }))
    : (composition.nodes ?? []).map((node) => ({
      satellite: satellitesByKey.get(node.key),
      edges: visibleRelationshipsFor(composition, node.key, { outgoing: false })
        .map((relationship) => relationship.edge),
    }));

  if (run !== cueGeneration || !map.isConnected) return;
  const orientation = localStorage.getItem('chessview.orientation') === 'black' ? 'black' : 'white';
  const kind = mode === 'roots' ? 'next' : 'last';

  for (const { satellite, edges = [] } of resolved) {
    if (!satellite?.isConnected) continue;
    const board = satellite.querySelector('.mini-board');
    if (!board) continue;

    const existing = board.querySelector('.move-cue');
    const edge = edges.length === 1 ? edges[0] : null;
    if (!edge) {
      existing?.remove();
      delete board.dataset.moveCueSignature;
      continue;
    }

    const signature = `${kind}:${edge.uci ?? ''}:${orientation}`;
    if (existing && board.dataset.moveCueSignature === signature) continue;

    existing?.remove();
    const markup = moveCueMarkup(edge, kind);
    if (!markup) {
      delete board.dataset.moveCueSignature;
      continue;
    }
    board.insertAdjacentHTML('beforeend', markup);
    board.dataset.moveCueSignature = signature;
  }
}

async function decorateRootRows(rootStructure = null) {
  const run = ++generation;
  const rows = [...document.querySelectorAll('.roots-row[data-nav-key]')];

  for (const row of rows) {
    const target = row.dataset.navKey;
    const label = row.querySelector('.root-name');
    if (!target || !label) continue;

    const structureEntry = rootStructure?.entriesByKey.get(target);
    row.classList.toggle('is-transposition-merge', structureEntry?.isMerge === true);

    const incomingByTarget = await collectIncomingToStart(target);
    if (run !== generation || !row.isConnected) return;

    const path = reconstructPgnPath(target, incomingByTarget, START);
    if (path == null) continue;

    if (!label.dataset.originalLabel) label.dataset.originalLabel = label.textContent?.trim() ?? '';
    const full = path.length ? formatPgnMoves(path) : 'start position';
    const pathDisplay = path.length ? formatPgnSuffix(path, 6) : 'start position';
    const display = structureEntry?.isMerge ? `↗ ${pathDisplay}` : pathDisplay;
    const baseTitle = label.dataset.originalLabel && label.dataset.originalLabel !== 'known position'
      ? `${label.dataset.originalLabel} · ${full}`
      : full;
    const title = structureEntry?.isMerge
      ? `Transposition merge from ${Math.max(2, structureEntry.branches.length)} Roots · ${baseTitle}`
      : baseTitle;

    label.style.textAlign = 'right';
    if (label.textContent !== display) label.textContent = display;
    if (label.title !== title) label.title = title;
  }
}

function unflattenRootRows(rootStructure) {
  const center = rootStructure?.composition?.center;
  const list = document.querySelector('.roots-row[data-nav-key]')?.closest('.explorer-list');
  if (!center || !list || list.dataset.rootTreeFor === center) return;

  const rows = [...list.querySelectorAll('.roots-row[data-nav-key]')];
  if (!rows.length) return;

  const descriptors = rows.map((row, index) => {
    const key = row.dataset.navKey;
    const entry = rootStructure.entriesByKey.get(key);
    return {
      row,
      entry,
      index,
      key,
      depth: entry?.depth,
      move: row.querySelector('.explorer-move')?.textContent?.trim() ?? '',
    };
  }).filter((item) => item.key && item.entry && Number.isFinite(item.depth));

  const byKey = new Map(descriptors.map((item) => [item.key, item]));
  const childrenByParent = new Map();

  for (const item of descriptors) {
    const candidates = item.entry.relationships
      .filter((relationship) => {
        if (item.depth === 1) return relationship.target === center;
        return byKey.get(relationship.target)?.depth === item.depth - 1;
      })
      .slice()
      .sort((a, b) => {
        const aMove = (a.edge?.san ?? a.edge?.uci ?? '') === item.move ? 0 : 1;
        const bMove = (b.edge?.san ?? b.edge?.uci ?? '') === item.move ? 0 : 1;
        return aMove - bMove || a.target.localeCompare(b.target);
      });

    const parentKey = candidates[0]?.target ?? (item.depth === 1 ? center : null);
    if (!parentKey) continue;
    if (!childrenByParent.has(parentKey)) childrenByParent.set(parentKey, []);
    childrenByParent.get(parentKey).push(item);
  }

  for (const children of childrenByParent.values()) {
    children.sort((a, b) => a.index - b.index);
  }

  const tree = document.createElement('div');
  tree.className = 'root-tree';
  const placed = new Set();

  function appendChildren(parentKey, host) {
    for (const item of childrenByParent.get(parentKey) ?? []) {
      if (placed.has(item.key)) continue;
      placed.add(item.key);
      const branch = document.createElement('div');
      branch.className = 'root-tree-branch';
      branch.dataset.treeKey = item.key;
      branch.appendChild(item.row);

      const childHost = document.createElement('div');
      childHost.className = 'root-tree-children';
      appendChildren(item.key, childHost);
      if (childHost.childElementCount) branch.appendChild(childHost);
      host.appendChild(branch);
    }
  }

  appendChildren(center, tree);

  for (const item of descriptors) {
    if (placed.has(item.key)) continue;
    const branch = document.createElement('div');
    branch.className = 'root-tree-branch';
    branch.dataset.treeKey = item.key;
    branch.appendChild(item.row);
    tree.appendChild(branch);
  }

  list.replaceChildren(tree);
  list.dataset.rootTreeFor = center;
}

function clearLinkedHighlights() {
  document.querySelectorAll('.is-related-highlight').forEach((element) => {
    element.classList.remove('is-related-highlight');
  });
}

function highlightLinkedPosition(key) {
  clearLinkedHighlights();
  if (!key) return;
  document.querySelectorAll('.roots-row[data-nav-key], .satellite[data-key]').forEach((element) => {
    const elementKey = element.dataset.navKey ?? element.dataset.key;
    if (elementKey === key) element.classList.add('is-related-highlight');
  });
}

function bindLinkedHover() {
  document.querySelectorAll('.roots-row[data-nav-key], .satellite[data-key]').forEach((element) => {
    if (element.dataset.linkedHoverBound === '1') return;
    element.dataset.linkedHoverBound = '1';
    element.addEventListener('pointerenter', () => {
      highlightLinkedPosition(element.dataset.navKey ?? element.dataset.key);
    });
    element.addEventListener('pointerleave', clearLinkedHighlights);
  });
}

function currentViewMatches(detail) {
  const map = document.querySelector('.map.mode-roots, .map.mode-lines');
  const center = map?.querySelector('.center-position[data-key]')?.dataset.key;
  const view = map?.classList.contains('mode-roots') ? 'roots' : 'lines';
  const composition = detail.composition;
  const compositionMatches = !composition?.direction
    || (composition.center === detail.center && composition.direction === detail.view);
  return center === detail.center && view === detail.view && compositionMatches;
}

async function decorateForView(detail) {
  const run = ++structureGeneration;
  let requestedRefresh = false;
  let failed = false;
  try {
    const expansion = detail.view === 'roots'
      ? await expandCurrentRootTranspositions(detail.center)
      : { addedEdges: 0 };
    if (run !== structureGeneration || !currentViewMatches(detail)) return;
    if ((expansion?.addedEdges ?? 0) > 0) {
      requestedRefresh = true;
      requestViewRefresh({ cycleId: detail.cycleId, center: detail.center, view: detail.view });
      return;
    }

    const map = document.querySelector('.map');
    const composition = detail.composition;
    const rootStructure = map?.classList.contains('mode-roots')
      ? rootStructureFromComposition(map, composition)
      : null;
    if (run !== structureGeneration || !currentViewMatches(detail)) return;

    if (rootStructure) layoutRootSatellites(rootStructure);
    if (composition?.direction) drawVisibleEdges(map, composition, { direction: detail.view });
    decorateMoveCues(composition, rootStructure);
    if (run !== structureGeneration || !currentViewMatches(detail)) return;
    await decorateRootRows(rootStructure);
    if (run !== structureGeneration || !currentViewMatches(detail)) return;
    if (rootStructure) unflattenRootRows(rootStructure);
    if (run !== structureGeneration || !currentViewMatches(detail)) return;
    bindLinkedHover();
  } catch (error) {
    failed = true;
    console.error('Chessview Root composition failed', error);
  } finally {
    if (!requestedRefresh && run === structureGeneration && currentViewMatches(detail)) {
      reportViewWorkSettled({
        cycleId: detail.cycleId,
        label: 'structure',
        task: detail.tasks?.structure,
        center: detail.center,
        failed,
      });
    }
  }
}

window.addEventListener(VIEW_RENDERED_EVENT, (event) => {
  const detail = event.detail ?? {};
  if (!detail.tasks?.structure) return;
  decorateForView(detail);
});