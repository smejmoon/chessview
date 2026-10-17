// Branch-only visual evaluation bridge. Constellation owns selection; this sends only
// the accepted snapshot to the standalone experiment. Navigation returns to Current View.
import type { CurrentViewActions } from './current-view-controller.ts';
import type { RendererView } from './nodus-renderer.ts';

export function acceptedStarMapProjection(view: RendererView) {
  if (view.structure.status !== 'ready') return null;
  const composition = view.structure.value?.composition;
  if (!composition || !Array.isArray(composition.nodes) || !Array.isArray(composition.relationships)) return null;
  const nodes = new Map<string, {
    key: string; relation: string; distance: number; families: readonly string[]; merge: boolean;
  }>();
  nodes.set(view.center, { key: view.center, relation: 'center', distance: 0, families: [], merge: false });
  for (const node of composition.nodes) {
    if (typeof node.key !== 'string' || nodes.has(node.key)) continue;
    nodes.set(node.key, {
      key: node.key,
      relation: node.relation ?? 'line',
      distance: Number.isFinite((node as any).distance) ? Number((node as any).distance) : 1,
      families: Array.isArray((node as any).families) ? [...(node as any).families] : [],
      merge: node.merge === true,
    });
  }
  const relationships = new Map<string, {
    id: string; source: string; target: string; san: string; families: readonly string[];
  }>();
  for (const relationship of composition.relationships) {
    if (!nodes.has(relationship.source) || !nodes.has(relationship.target)) continue;
    const id = (relationship as any).id ?? `${relationship.source}:${relationship.target}:${(relationship as any).edge?.uci ?? ''}`;
    if (relationships.has(id)) continue;
    relationships.set(id, {
      id, source: relationship.source, target: relationship.target,
      san: (relationship as any).edge?.san ?? '',
      families: relationship.families ?? [],
    });
  }
  return {
    center: view.center, viewMode: view.mode,
    nodes: [...nodes.values()],
    edges: [...relationships.values()],
  };
}

export function createStarMapPreview() {
  if (new URLSearchParams(window.location.search).get('star-map') !== '1') return null;
  let frame: HTMLIFrameElement | null = null;
  let latest: ReturnType<typeof acceptedStarMapProjection> = null;
  let actions: CurrentViewActions | null = null;
  let lastCenter: string | null = null;

  function send() {
    if (!frame?.contentWindow) return;
    frame.contentWindow.postMessage({
      type: 'chessview:projection', projection: latest,
      pendingCenter: lastCenter,
    }, window.location.origin);
  }
  function onMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin || event.source !== frame?.contentWindow) return;
    const message = event.data;
    if (message?.type === 'star-map:ready') { send(); return; }
    if (!actions) return;
    if (message?.type === 'star-map:recenter'
      && typeof message.key === 'string'
      && latest?.nodes.some(node => node.key === message.key)) {
      void actions.recenter({ target: message.key });
    } else if (message?.type === 'star-map:mode'
      && (message.mode === 'roots' || message.mode === 'lines')) {
      void actions.setMode(message.mode);
    } else if (message?.type === 'star-map:back') {
      actions.back();
    }
  }
  window.addEventListener('message', onMessage);

  function publish(view: RendererView, currentActions: CurrentViewActions) {
    actions = currentActions;
    lastCenter = view.center;
    latest = acceptedStarMapProjection(view);
    if (!frame && !latest) return;
    if (!frame) {
      frame = document.createElement('iframe');
      frame.title = 'ChessView live Constellation star-map evaluation';
      frame.src = new URL('star-map-lab/?live=1', document.baseURI).href;
      Object.assign(frame.style, {
        position: 'fixed', inset: '0', width: '100vw', height: '100vh',
        border: '0', zIndex: '1000',
      });
      frame.addEventListener('load', send);
      document.body.append(frame);
      const app = document.querySelector<HTMLElement>('#app');
      if (app) { app.style.opacity = '0'; app.style.pointerEvents = 'none'; }
    }
    send();
  }
  function dispose() {
    window.removeEventListener('message', onMessage);
    frame?.remove();
  }
  return Object.freeze({ publish, dispose });
}
