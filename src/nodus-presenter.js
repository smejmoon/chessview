import { createViewStatusPresenter } from './view-status.js';

export function createNodusPresenter({
  renderer,
  statusPresenter = null,
  log = () => {},
} = {}) {
  if (typeof renderer?.render !== 'function') throw new TypeError('Nodus presenter requires renderer.render');
  if (typeof renderer?.renderFailure !== 'function') throw new TypeError('Nodus presenter requires renderer.renderFailure');
  if (!statusPresenter && typeof renderer?.renderStatus !== 'function') {
    throw new TypeError('Nodus presenter requires renderer.renderStatus');
  }

  const status = statusPresenter ?? createViewStatusPresenter({
    onPresentation: (presentation) => renderer.renderStatus(presentation),
  });

  async function present(kind, view, actions) {
    if (kind === 'start') status.start(view);
    else status.update(view);

    try {
      await renderer.render(view, actions, status.presentation);
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
    status.dispose();
    renderer.dispose?.();
  }

  return Object.freeze({
    start: (view, actions) => present('start', view, actions),
    update: (view, actions) => present('update', view, actions),
    dispose,
  });
}
