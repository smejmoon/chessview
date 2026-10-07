import { createViewStatusPresenter } from './view-status.ts';

export function createNodusPresenter({
  renderer = null,
  statusPresenter = null,
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

  async function present(kind, view, actions) {
    if (kind === 'start') status.start(view);
    else status.update(view);

    try {
      await renderer.render(view, actions, status.presentation);
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
    status.dispose();
    renderer.dispose?.();
  }

  return Object.freeze({
    start: (view, actions) => present('start', view, actions),
    update: (view, actions) => present('update', view, actions),
    dispose,
  });
}
