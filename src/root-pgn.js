import './root-ui.css';
import { getIncoming, getOutgoing } from './db.js';
import { canonicalPosition, START_FEN } from './graph.js';
import { formatPgnMoves, formatPgnSuffix, reconstructPgnPath } from './pgn.js';
import { expandMoveOrderTranspositions } from './transpositions.js';

const START = canonicalPosition(START_FEN);
const expandedTargets = new Set();
const expandingTargets = new Map();
let generation = 0;

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
  if (!target || expandedTargets.has(target)) return;
  if (expandingTargets.has(target)) return expandingTargets.get(target);

  const promise = (async () => {
    const incomingByTarget = await collectIncomingToStart(target);
    const referencePath = reconstructPgnPath(target, incomingByTarget, START);
    if (!referencePath?.length) return;

    const result = await expandMoveOrderTranspositions(referencePath, target, {
      maxPaths: 256,
      maxStates: 75_000,
    });
    expandedTargets.add(target);

    const current = document.querySelector('.map.mode-roots .center-position[data-key]');
    if (result.addedEdges > 0 && current?.dataset.key === target) {
      window.dispatchEvent(new Event('resize'));
    }
  })().finally(() => expandingTargets.delete(target));

  expandingTargets.set(target, promise);
  return promise;
}

function rootDepth(element) {
  const relation = element.querySelector('.mini-label .relation')?.textContent?.trim()
    ?? element.querySelector('.root-depth')?.textContent?.trim()
    ?? '';
  if (relation.toLowerCase() === 'root') return 1;
  const match = relation.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function layoutRootSatellites() {
  const map = document.querySelector('.map.mode-roots');
  const center = map?.querySelector('.center-position');
  if (!map || !center) return;

  const satellites = [...map.querySelectorAll('.satellite.relation-root')]
    .map((element) => ({ element, depth: rootDepth(element) }))
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
    depth: rootDepth(row),
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

let scheduled = false;
function scheduleDecorate() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    layoutRootSatellites();
    decorateRootRows();
    unflattenRootRows().then(() => bindLinkedHover());
    bindLinkedHover();
    expandCurrentRootTranspositions();
  });
}

new MutationObserver(scheduleDecorate).observe(document.querySelector('#app'), {
  childList: true,
  subtree: true,
});

scheduleDecorate();
