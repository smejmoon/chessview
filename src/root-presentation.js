import './root-ui.css';
import { drawVisibleEdges } from './map-render.js';

function relationshipsFor(composition, key, options = {}) {
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
    return {
      satellite,
      key: node.key,
      depth: node.distance,
      relationships: relationshipsFor(composition, node.key, { incoming: false }),
      branches: [...(node.families ?? [])],
      isMerge: node.merge === true,
    };
  }).filter(Boolean);
  return { map, composition, entries };
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

function bindLinkedHover() {
  const elements = [...document.querySelectorAll('.roots-row[data-nav-key], .satellite[data-key]')];
  const clear = () => elements.forEach((element) => element.classList.remove('is-related-highlight'));
  for (const element of elements) {
    element.addEventListener('pointerenter', () => {
      clear();
      const key = element.dataset.navKey ?? element.dataset.key;
      elements.filter((candidate) => (candidate.dataset.navKey ?? candidate.dataset.key) === key)
        .forEach((candidate) => candidate.classList.add('is-related-highlight'));
    });
    element.addEventListener('pointerleave', clear);
  }
}

export function decorateRootPresentation(view) {
  const composition = view?.structure?.value?.composition;
  const map = document.querySelector('.map');
  if (!map || !composition) return;
  const structure = view.mode === 'roots' ? rootStructure(map, composition) : null;
  if (structure) layoutRoots(structure);
  drawVisibleEdges(map, composition, { direction: view.mode });
  bindLinkedHover();
}
