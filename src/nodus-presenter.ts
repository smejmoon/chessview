import { createEvidenceReader } from './evidence-source.ts';
import type { EvidenceEdge } from './evidence-source.ts';
import { prepareMoveEvidence } from './evidence-presentation.ts';
import type { PreparedConstellationEvidence } from './evidence-presentation.ts';
import { createViewStatusPresenter } from './view-status.ts';

type PrepareEvidenceInput = Readonly<{
  center: string;
  edges: readonly EvidenceEdge[];
  signal: AbortSignal;
}>;

async function prepareConstellationEvidence({
  center,
  edges,
  signal,
}: PrepareEvidenceInput): Promise<PreparedConstellationEvidence> {
  const reader = createEvidenceReader({ signal });
  const [position, moves] = await Promise.all([
    reader.position(center),
    prepareMoveEvidence(edges, { reader }),
  ]);
  return Object.freeze({ position, moves });
}

function visibleEdges(view): readonly EvidenceEdge[] {
  const relationships = view?.structure?.value?.composition?.relationships;
  if (!Array.isArray(relationships)) return Object.freeze([]);
  return Object.freeze(relationships
    .map((relationship) => relationship?.edge)
    .filter((edge): edge is EvidenceEdge => Boolean(
      edge
      && typeof edge.source === 'string'
      && typeof edge.target === 'string'
      && typeof edge.uci === 'string',
    )));
}

export function createNodusPresenter({
  renderer = null,
  statusPresenter = null,
  prepareEvidence = prepareConstellationEvidence,
  decorateWeather = (_view, _presentation) => {},
  log = (..._args) => {},
} = {}) {
  if (typeof renderer?.render !== 'function') throw new TypeError('Nodus presenter requires renderer.render');
  if (typeof renderer?.renderFailure !== 'function') throw new TypeError('Nodus presenter requires renderer.renderFailure');
  if (!statusPresenter && typeof renderer?.renderStatus !== 'function') {
    throw new TypeError('Nodus presenter requires renderer.renderStatus');
  }

  const status = statusPresenter ?? createViewStatusPresenter({
    onPresentation: (presentation) => renderer.renderStatus(presentation),
  });
  let evidenceController: AbortController | null = null;
  let presentationRevision = 0;

  function preparePresentationEvidence(view, actions, revision) {
    if (typeof renderer.decorateEvidence !== 'function') return;
    const controller = new AbortController();
    evidenceController = controller;
    void Promise.resolve(prepareEvidence(Object.freeze({
      center: view.center,
      edges: visibleEdges(view),
      signal: controller.signal,
    }))).then((evidence) => {
      if (controller.signal.aborted || revision !== presentationRevision) return;
      renderer.decorateEvidence(view, actions, evidence);
    }).catch((error) => {
      if (controller.signal.aborted || revision !== presentationRevision) return;
      log('Nodus evidence presentation failed', {
        center: view?.center,
        mode: view?.mode,
        error: error?.message ?? String(error),
      });
      renderer.renderEvidenceFailure?.(error);
    });
  }

  async function present(kind, view, actions) {
    evidenceController?.abort();
    evidenceController = null;
    const revision = ++presentationRevision;

    if (kind === 'start') status.start(view);
    else status.update(view);

    try {
      await renderer.render(view, actions, status.presentation);
      preparePresentationEvidence(view, actions, revision);
      try {
        decorateWeather(view, status.presentation);
      } catch (error) {
        log('Weather diagnostics failed', {
          center: view?.center,
          mode: view?.mode,
          error: error?.message ?? String(error),
        });
      }
      return true;
    } catch (error) {
      log('Nodus presentation failed', {
        center: view?.center,
        mode: view?.mode,
        error: error?.message ?? String(error),
      });
      status.fail();
      await renderer.renderFailure(view, actions, error, status.presentation);
      return false;
    }
  }

  function dispose() {
    presentationRevision += 1;
    evidenceController?.abort();
    evidenceController = null;
    status.dispose();
    renderer.dispose?.();
  }

  return Object.freeze({
    start: (view, actions) => present('start', view, actions),
    update: (view, actions) => present('update', view, actions),
    dispose,
  });
}
