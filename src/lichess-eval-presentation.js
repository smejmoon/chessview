const ISSUE_PRESENTATION = Object.freeze({
  network: Object.freeze({
    text: 'Lichess · network issue',
    title: 'Could not reach Lichess for engine data.',
  }),
  service: Object.freeze({
    text: 'Lichess · engine unavailable',
    title: 'Lichess could not provide engine data.',
  }),
  'rate-limited': Object.freeze({
    text: 'Lichess · rate limited',
    title: 'Lichess temporarily rate-limited engine requests.',
  }),
  'invalid-data': Object.freeze({
    text: 'Lichess · engine data issue',
    title: 'Lichess returned engine data Chessview could not use.',
  }),
  'insufficient-data': Object.freeze({
    text: 'Lichess · engine data too shallow',
    title: 'Lichess returned engine data below Chessview’s usable-depth threshold.',
  }),
  'refresh-failed': Object.freeze({
    text: 'Lichess · cached engine data',
    title: 'Using cached engine data because the Lichess refresh failed.',
  }),
  storage: Object.freeze({
    text: 'Lichess · cache issue',
    title: 'Engine data was received, but Chessview could not update its local cache.',
  }),
});

export function lichessEvalStatusSpec(status = null) {
  const pending = Math.max(0, Number(status?.pending ?? 0));
  const requesting = status?.activity === 'requesting' || pending > 0;
  const issue = status?.issue ?? null;

  if (issue) {
    const presentation = ISSUE_PRESENTATION[issue.kind]
      ?? Object.freeze({ text: 'Lichess · engine issue', title: 'Lichess engine data has an acquisition issue.' });
    const pendingText = requesting
      ? ` ${pending || 1} engine request${(pending || 1) === 1 ? '' : 's'} still in progress.`
      : '';
    return Object.freeze({
      text: presentation.text,
      title: `${presentation.title}${pendingText}`,
      className: `network-status is-issue${requesting ? ' is-loading' : ''}`,
    });
  }

  if (requesting) {
    const count = pending || 1;
    return Object.freeze({
      text: 'Lichess · loading engine data…',
      title: `Requesting Lichess engine data for ${count} position${count === 1 ? '' : 's'}.`,
      className: 'network-status is-loading',
    });
  }

  return Object.freeze({
    text: 'Lichess · rated standard',
    title: 'Lichess rated-standard data source.',
    className: 'network-status',
  });
}

export function decorateLichessEvalStatus(root, status) {
  const element = root?.querySelector?.('.network-status');
  if (!element) return;
  const spec = lichessEvalStatusSpec(status);
  element.className = spec.className;
  element.textContent = spec.text;
  element.title = spec.title;
  element.setAttribute?.('aria-label', spec.title);
}

export function createLichessEvalStatusPresenter({
  render = null,
  log = (..._args) => {},
} = {}) {
  if (typeof render !== 'function') throw new TypeError('LichessEval status presenter requires render');

  function update(status) {
    try {
      render(status);
      return true;
    } catch (error) {
      log('LichessEval status presentation failed', {
        error: error?.message ?? String(error),
      });
      return false;
    }
  }

  return Object.freeze({ update });
}
