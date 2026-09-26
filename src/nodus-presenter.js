import { createViewStatusPresenter } from './view-status.js';

export function createNodusPresenter({
  renderer,
  statusPresenter = createViewStatusPresenter(),
  log = () => {},
} = {}) {
  if (typeof renderer?.render !== 'function') throw new TypeError('Nodus presenter requires renderer.render');
  if (typeof renderer?.renderFailure !== 'function') throw new TypeError('Nodus presenter requires renderer.renderFailure');

  async function present(kind, view, actions) {
    if (kind === 'start') statusPresenter.start(view);
    else statusPresenter.update(view);

    try {
      await renderer.render(view, actions, statusPresenter.presentation);
      statusPresenter.paint();
      return true;
    } catch (error) {
      log('Nodus presentation failed', {
        center: view?.center,
        mode: view?.mode,
        error: error?.message ?? String(error),
      });
      statusPresenter.fail();
      await renderer.renderFailure(view, actions, error, statusPresenter.presentation);
      statusPresenter.paint();
      return false;
    }
  }

  function dispose() {
    statusPresenter.dispose();
    renderer.dispose?.();
  }

  return Object.freeze({
    start: (view, actions) => present('start', view, actions),
    update: (view, actions) => present('update', view, actions),
    dispose,
  });
}
