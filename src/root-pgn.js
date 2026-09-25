import './root-ui.css';
import { getIncoming, getOutgoing } from './db.js';
import { canonicalPosition, START_FEN } from './graph.js';
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

async function expandCurrentRootTranspositions() {
  const map = document.querySelector('.map.mode-roots');
  const center = map?.querySelector('.center-position[data-key]');
  const target = center?.dataset.key;
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

function relationDepth(element) {
  const relation = element.querySelector('.mini-label .relation')?.textContent?.trim()
    ?? element.querySelector('.root-depth')?.textContent?.trim()
    ?? '';
  const normalized = relation.toLowerCase();
  if (normalized === 'root' || normalized === 'line') return 1;
  const match = relation.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function layoutRootSatellites() {
  const map = document.querySelector('.map.mode-roots');
  const center = map?.querySelector('.center-position');
  if (!map || !center) return;

  const satellites = [...map.querySelectorAll('.satellite.relation-root')]
    .map((element) => ({ element, depth: relationDepth(element) }))
    .filter((item) => Number.isFinite(item.depth));
  if (!satellites.length) return;

  const mapRect = map.getBoundingClientRect();
  const centerRect = center.getBoundingClientRect();
  const maxDepth = Math.max(...satellites.map((item) => item.depth));
  const firstLevel = satellites.filter((item) => item.depth === 1);
  const lastLevel = satellites.filter((item) => item.depth === maxDepth);
  const firstHalf = Math.max(38, ...firstLevel.map((item) => item.element.getBoundingClientRect().width / 2));
  const lastHalf = Math.max(28, ...lastLevel.map((item) => item.element.getBoundingClientRect().width / 2));

  const startX = centerRect.left - mapRect.left - firstHalf - 18;
  const endX = lastHalf + 18;
  const span = Math.max(0, startX - endX);

  for (const item of satellites) {
    const progress = maxDepth <= 1 ? 0 : (item.depth - 1) / (maxDepth - 1);
    const x = Math.max(endX, startX - span * progress);
    item.element.style.setProperty('--x', `${x}px`);
  }
}

function visiblePositions(map) {
  const result = new Map();
  const center = map.querySelector('.center-position[data-key]');
  if (center?.dataset.key) result.set(center.dataset.key, { element: center, depth: 0 });

  for (const satellite of map.querySelectorAll('.satellite[data-key]')) {
    const depth = relationDepth(satellite);
    if (satellite.dataset.key && Number.isFinite(depth)) {
      result.set(satellite.dataset.key, { element: satellite, depth });
    }
  }
  return result;
}

function edgeSortForLabel(label) {
  return (a, b) => {
    const aLabel = a.san ?? a.uci ?? '';
    const bLabel = b.san ?? b.uci ?? '';
    const aMatch = aLabel === label ? 0 : 1;
    const bMatch = bLabel === label ? 0 : 1;
    return aMatch - bMatch
      || (b.games ?? 0) - (a.games ?? 0)
      || (b.share ?? 0) - (a.share ?? 0)
      || (a.uci ?? '').localeCompare(b.uci ?? '')
      || a.source.localeCompare(b.source)
      || a.target.localeCompare(b.target);
  };
}

async function visibleEdgeFor(satellite, mode, positions) {
  const key = satellite.dataset.key;
  const depth = relationDepth(satellite);
  if (!key || !Number.isFinite(depth) || depth < 1) return null;

  const label = satellite.querySelector('.mini-label strong')?.textContent?.trim() ?? '';
  if (mode === 'roots') {
    return (await getOutgoing(key))
      .filter((edge) => positions.get(edge.target)?.depth === depth - 1)
      .sort(edgeSortForLabel(label))[0] ?? null;
  }

  return (await getIncoming(key))
    .filter((edge) => positions.get(edge.source)?.depth === depth - 1)
    .sort(edgeSortForLabel(label))[0] ?? null;
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

function drawRootEdges(map, positions, resolved) {
  const svg = map.querySelector('#edges');
  if (!svg) return;

  const mapRect = map.getBoundingClientRect();
  const paths = [];
  for (const { edge } of resolved) {
    if (!edge) continue;
    const source = positions.get(edge.source)?.element;
    const target = positions.get(edge.target)?.element;
    if (!source || !target) continue;

    const a = source.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const x1 = a.left + a.width / 2 - mapRect.left;
    const y1 = a.top + a.height / 2 - mapRect.top;
    const x2 = b.left + b.width / 2 - mapRect.left;
    const y2 = b.top + b.height / 2 - mapRect.top;
    const horizontal = x2 >= x1 ? 1 : -1;
    const bend = Math.max(28, Math.abs(x2 - x1) * 0.36);
    paths.push({
      d: `M ${x1} ${y1} C ${x1 + horizontal * bend} ${y1}, ${x2 - horizontal * bend} ${y2}, ${x2} ${y2}`,
      className: (edge.share ?? 0) >= 0.2 ? 'edge edge-strong' : 'edge',
    });
  }

  const signature = `${mapRect.width}x${mapRect.height}|${paths.map((item) => `${item.className}:${item.d}`).join('|')}`;
  if (svg.dataset.rootEdgesSignature === signature) return;

  svg.dataset.rootEdgesSignature = signature;
  svg.setAttribute('viewBox', `0 0 ${mapRect.width} ${mapRect.height}`);
  svg.innerHTML = '';
  for (const item of paths) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', item.d);
    path.setAttribute('class', item.className);
    svg.appendChild(path);
  }
}

async function decorateMoveCues() {
  const run = ++cueGeneration;
  const map = document.querySelector('.map');
  if (!map) return;

  const mode = map.classList.contains('mode-roots') ? 'roots' : 'lines';
  const positions = visiblePositions(map);
  const satellites = [...map.querySelectorAll('.satellite[data-key]')];
  const resolved = await Promise.all(satellites.map(async (satellite) => ({
    satellite,
    edge: await visibleEdgeFor(satellite, mode, positions),
  })));

  if (run !== cueGeneration || !map.isConnected) return;
  const orientation = localStorage.getItem('chessview.orientation') === 'black' ? 'black' : 'white';
  const kind = mode === 'roots' ? 'next' : 'last';

  for (const { satellite, edge } of resolved) {
    if (!satellite.isConnected) continue;
    const board = satellite.querySelector('.mini-board');
    if (!board) continue;

    const existing = board.querySelector('.move-cue');
    if (!edge) {
      if (existing) existing.remove();
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

  if (mode === 'roots') drawRootEdges(map, positions, resolved);
}

async function decorateRootRows() {
  const run = ++generation;
  const rows = [...document.querySelectorAll('.roots-row[data-nav-key]')];

  for (const row of rows) {
    const target = row.dataset.navKey;
    const label = row.querySelector('.root-name');
    if (!target || !label) continue;

    const incomingByTarget = await collectIncomingToStart(target);
    if (run !== generation || !row.isConnected) return;

    const path = reconstructPgnPath(target, incomingByTarget, START);
    if (path == null) continue;

    if (!label.dataset.originalLabel) label.dataset.originalLabel = label.textContent?.trim() ?? '';
    const full = path.length ? formatPgnMoves(path) : 'start position';
    const display = path.length ? formatPgnSuffix(path, 6) : 'start position';
    const title = label.dataset.originalLabel && label.dataset.originalLabel !== 'known position'
      ? `${label.dataset.originalLabel} · ${full}`
      : full;

    label.style.textAlign = 'right';
    if (label.textContent !== display) label.textContent = display;
    if (label.title !== title) label.title = title;
  }
}

async function unflattenRootRows() {
  const center = document.querySelector('.map.mode-roots .center-position[data-key]')?.dataset.key;
  const list = document.querySelector('.roots-row[data-nav-key]')?.closest('.explorer-list');
  if (!center || !list || list.dataset.rootTreeFor === center) return;

  const rows = [...list.querySelectorAll('.roots-row[data-nav-key]')];
  if (!rows.length) return;

  const descriptors = rows.map((row, index) => ({
    row,
    index,
    key: row.dataset.navKey,
    depth: relationDepth(row),
    move: row.querySelector('.explorer-move')?.textContent?.trim() ?? '',
  })).filter((item) => item.key && Number.isFinite(item.depth));

  const byKey = new Map(descriptors.map((item) => [item.key, item]));
  const childrenByParent = new Map();

  for (const item of descriptors) {
    const outgoing = await getOutgoing(item.key);
    const current = document.querySelector('.map.mode-roots .center-position[data-key]');
    if (!item.row.isConnected || current?.dataset.key !== center) return;

    const candidates = outgoing.filter((edge) => {
      if (item.depth === 1) return edge.target === center;
      return byKey.get(edge.target)?.depth === item.depth - 1;
    });
    candidates.sort((a, b) => {
      const aMove = (a.san ?? a.uci ?? '') === item.move ? 0 : 1;
      const bMove = (b.san ?? b.uci ?? '') === item.move ? 0 : 1;
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
  return center === detail.center && view === detail.view;
}

async function decorateForView(detail) {
  const run = ++structureGeneration;
  let requestedRefresh = false;
  try {
    const expansion = await expandCurrentRootTranspositions();
    if (run !== structureGeneration || !currentViewMatches(detail)) return;
    if ((expansion?.addedEdges ?? 0) > 0) {
      requestedRefresh = true;
      requestViewRefresh({ cycleId: detail.cycleId, center: detail.center, view: detail.view });
      return;
    }

    layoutRootSatellites();
    await decorateMoveCues();
    if (run !== structureGeneration || !currentViewMatches(detail)) return;
    await decorateRootRows();
    if (run !== structureGeneration || !currentViewMatches(detail)) return;
    await unflattenRootRows();
    if (run !== structureGeneration || !currentViewMatches(detail)) return;
    bindLinkedHover();
  } catch (error) {
    console.error('Chessview Root composition failed', error);
  } finally {
    if (!requestedRefresh && run === structureGeneration && currentViewMatches(detail)) {
      reportViewWorkSettled({
        cycleId: detail.cycleId,
        label: 'structure',
        task: detail.tasks?.structure,
        center: detail.center,
      });
    }
  }
}

window.addEventListener(VIEW_RENDERED_EVENT, (event) => {
  const detail = event.detail ?? {};
  if (!detail.tasks?.structure) return;
  decorateForView(detail);
});
