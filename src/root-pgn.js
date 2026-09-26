import './root-ui.css';
import { getIncoming } from './db.js';
import { canonicalPosition, START_FEN } from './graph.js';
import { drawVisibleEdges } from './map-render.js';
import { formatPgnMoves, formatPgnSuffix, reconstructPgnPath } from './pgn.js';
import { expandMoveOrderTranspositions } from './transpositions.js';

const START = canonicalPosition(START_FEN);
const expandedTargets = new Set();
const expandingTargets = new Map();

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
  if (!target || expandedTargets.has(target)) return;
  if (expandingTargets.has(target)) return expandingTargets.get(target);
  const promise = (async () => {
    const incomingByTarget = await collectIncomingToStart(target);
    const referencePath = reconstructPgnPath(target, incomingByTarget, START);
    if (!referencePath?.length) return;
    await expandMoveOrderTranspositions(referencePath, target, { maxPaths: 256, maxStates: 75_000 });
    expandedTargets.add(target);
  })().finally(() => expandingTargets.delete(target));
  expandingTargets.set(target, promise);
  return promise;
}

function relationshipsFor(composition, key, options = {}) {
  if (typeof composition?.relationshipsFor === 'function') return composition.relationshipsFor(key, options);
  const { incoming = true, outgoing = true } = options;
  return (composition?.relationships ?? []).filter((relationship) => (
    (incoming && relationship.target === key) || (outgoing && relationship.source === key)
  ));
}

function rootStructure(map, composition) {
  if (!map || composition?.direction !== 'roots') return null;
  const satellites = new Map([...map.querySelectorAll('.satellite[data-key]')].map((element) => [element.dataset.key, element]));
  const entries = (composition.nodes ?? []).map((node) => {
    const satellite = satellites.get(node.key);
    if (!satellite) return null;
    const relationships = relationshipsFor(composition, node.key, { incoming: false });
    return {
      satellite,
      key: node.key,
      depth: node.distance,
      relationships,
      branches: [...(node.families ?? [])],
      isMerge: node.merge === true,
    };
  }).filter(Boolean);
  return { map, composition, entries, entriesByKey: new Map(entries.map((entry) => [entry.key, entry])) };
}

function laneY(index, count) {
  return count <= 1 ? 50 : 16 + (68 * index) / Math.max(1, count - 1);
}

function layoutRoots(structure) {
  if (!structure?.entries.length) return;
  const { map, entries } = structure;
  const center = map.querySelector('.center-position');
  if (!center) return;
  const mapRect = map.getBoundingClientRect();
  const centerRect = center.getBoundingClientRect();
  const maxDepth = Math.max(...entries.map((entry) => entry.depth));
  const first = entries.filter((entry) => entry.depth === 1);
  const last = entries.filter((entry) => entry.depth === maxDepth);
  const firstHalf = Math.max(38, ...first.map((entry) => entry.satellite.getBoundingClientRect().width / 2));
  const lastHalf = Math.max(28, ...last.map((entry) => entry.satellite.getBoundingClientRect().width / 2));
  const startX = centerRect.left - mapRect.left - firstHalf - 18;
  const endX = lastHalf + 18;
  const familyY = new Map(first.map((entry, index) => [entry.key, laneY(index, first.length)]));

  for (const entry of entries) {
    const progress = maxDepth <= 1 ? 0 : (entry.depth - 1) / (maxDepth - 1);
    entry.satellite.style.setProperty('--x', `${Math.max(endX, startX - Math.max(0, startX - endX) * progress)}px`);
    const ys = entry.branches.map((branch) => familyY.get(branch)).filter(Number.isFinite);
    entry.satellite.style.setProperty('--y', `${ys.length ? ys.reduce((sum, value) => sum + value, 0) / ys.length : 50}%`);
    entry.satellite.classList.toggle('is-transposition-merge', entry.isMerge);
  }
}

async function decorateRootRows(scope, structure) {
  if (!structure) return;
  const rows = [...document.querySelectorAll('.roots-row[data-nav-key]')];
  for (const row of rows) {
    if (!scope.isCurrent() || !row.isConnected) return;
    const target = row.dataset.navKey;
    const label = row.querySelector('.root-name');
    if (!target || !label) continue;
    const incomingByTarget = await collectIncomingToStart(target);
    if (!scope.isCurrent() || !row.isConnected) return;
    const path = reconstructPgnPath(target, incomingByTarget, START);
    if (path == null) continue;
    const entry = structure.entriesByKey.get(target);
    const full = path.length ? formatPgnMoves(path) : 'start position';
    const suffix = path.length ? formatPgnSuffix(path, 6) : 'start position';
    label.textContent = entry?.isMerge ? `↗ ${suffix}` : suffix;
    label.title = entry?.isMerge ? `Transposition merge · ${full}` : full;
  }
}

function bindLinkedHover() {
  const elements = [...document.querySelectorAll('.roots-row[data-nav-key], .satellite[data-key]')];
  const clear = () => elements.forEach((element) => element.classList.remove('is-related-highlight'));
  for (const element of elements) {
    if (element.dataset.linkedHoverBound === '1') continue;
    element.dataset.linkedHoverBound = '1';
    element.addEventListener('pointerenter', () => {
      clear();
      const key = element.dataset.navKey ?? element.dataset.key;
      elements.filter((candidate) => (candidate.dataset.navKey ?? candidate.dataset.key) === key)
        .forEach((candidate) => candidate.classList.add('is-related-highlight'));
    });
    element.addEventListener('pointerleave', clear);
  }
}

export async function prepareRootComposition(scope) {
  if (scope.view !== 'roots') return;
  await expandCurrentRootTranspositions(scope.center);
}

export async function decorateRootComposition(scope) {
  if (!scope.isCurrent()) return;
  const map = document.querySelector('.map');
  if (!map || !scope.composition) return;
  const structure = scope.view === 'roots' ? rootStructure(map, scope.composition) : null;
  if (structure) layoutRoots(structure);
  drawVisibleEdges(map, scope.composition, { direction: scope.view });
  await decorateRootRows(scope, structure);
  if (!scope.isCurrent()) return;
  bindLinkedHover();
}
