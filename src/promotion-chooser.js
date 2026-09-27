import './promotion.css';

const PROMOTION_ORDER = Object.freeze(['q', 'n', 'r', 'b']);
const PROMOTION_ROLES = Object.freeze({
  q: 'queen',
  n: 'knight',
  r: 'rook',
  b: 'bishop',
});

function orderedChoices(choices = []) {
  const allowed = new Set(choices);
  return PROMOTION_ORDER.filter((piece) => allowed.has(piece));
}

function promotionSquare(to, index, orientation, color) {
  const file = String(to ?? '').charCodeAt(0) - 97;
  if (file < 0 || file > 7) return null;
  const displayFile = orientation === 'black' ? 7 - file : file;
  const displayRank = color === orientation ? index : 7 - index;
  return {
    left: `${displayFile * 12.5}%`,
    top: `${displayRank * 12.5}%`,
  };
}

export function createPromotionChooser({ app } = {}) {
  if (!app) throw new TypeError('Promotion chooser requires an app element');
  const document = app.ownerDocument ?? globalThis.document;
  let pending = null;

  function removeOverlay(state = pending) {
    state?.overlay?.remove?.();
    if (state) state.overlay = null;
  }

  function settle(piece) {
    const state = pending;
    if (!state) return false;
    pending = null;
    removeOverlay(state);
    document?.removeEventListener?.('keydown', state.onKeyDown);
    state.resolve(piece);
    return true;
  }

  function render(center = pending?.center) {
    const state = pending;
    if (!state) return false;
    if (center !== state.center) return settle(null);

    const host = app.querySelector?.('#center-board');
    if (!host) return false;
    removeOverlay(state);

    const overlay = document.createElement('div');
    overlay.id = 'promotion-choice';
    overlay.className = 'promotion-choice';
    overlay.setAttribute?.('role', 'dialog');
    overlay.setAttribute?.('aria-label', 'Choose promotion piece');
    overlay.addEventListener('click', () => settle(null));

    state.choices.forEach((piece, index) => {
      const point = promotionSquare(state.to, index, state.orientation, state.color);
      if (!point) return;
      const role = PROMOTION_ROLES[piece];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'promotion-square';
      button.dataset.promotion = piece;
      button.setAttribute?.('aria-label', `Promote to ${role}`);
      button.style.setProperty('left', point.left);
      button.style.setProperty('top', point.top);
      button.addEventListener('click', (event) => {
        event.stopPropagation?.();
        settle(piece);
      });

      const visual = document.createElement('piece');
      visual.className = `${role} ${state.color}`;
      button.appendChild(visual);
      overlay.appendChild(button);
    });

    state.overlay = overlay;
    host.appendChild(overlay);
    return true;
  }

  function choose({ center, to, choices, orientation = 'white', color = 'white' } = {}) {
    const available = orderedChoices(choices);
    if (!center || !to || !available.length) return Promise.resolve(null);
    if (pending) settle(null);

    return new Promise((resolve) => {
      const state = {
        center,
        to,
        choices: available,
        orientation,
        color,
        overlay: null,
        resolve,
        onKeyDown: null,
      };
      state.onKeyDown = (event) => {
        if (event?.key === 'Escape') settle(null);
      };
      pending = state;
      document?.addEventListener?.('keydown', state.onKeyDown);
      render(center);
    });
  }

  return Object.freeze({
    choose,
    sync: (center) => render(center),
    cancel: () => settle(null),
    dispose: () => settle(null),
  });
}
