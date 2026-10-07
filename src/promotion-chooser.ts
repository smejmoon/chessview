import './promotion.css';
import type { PromotionPiece } from './recenter-input.ts';

type Orientation = 'white' | 'black';
export type PromotionChooser = Readonly<{ choose(input: Readonly<{ center: string; to: string; choices: readonly string[]; orientation?: Orientation; color?: Orientation }>): Promise<PromotionPiece | null>; sync(input: Readonly<{ center: string; orientation?: Orientation; color?: Orientation }>): boolean; cancel(): boolean; dispose(): boolean }>;

const PROMOTION_ORDER = Object.freeze(['q', 'n', 'r', 'b']);
const PROMOTION_ROLES: Readonly<Record<string, string>> = Object.freeze({
  q: 'queen',
  n: 'knight',
  r: 'rook',
  b: 'bishop',
});

function orderedChoices(choices: readonly string[] = []): PromotionPiece[] {
  const allowed = new Set(choices);
  return PROMOTION_ORDER.filter((piece): piece is PromotionPiece => allowed.has(piece));
}

function promotionSquare(to: string, index: number, orientation: Orientation, color: Orientation) {
  const file = String(to ?? '').charCodeAt(0) - 97;
  if (file < 0 || file > 7) return null;
  const displayFile = orientation === 'black' ? 7 - file : file;
  const displayRank = color === orientation ? index : 7 - index;
  return {
    left: `${displayFile * 12.5}%`,
    top: `${displayRank * 12.5}%`,
  };
}

function isPromotionOptionTarget(state: any, target: any) {
  for (let node = target; node; node = node.parentNode) {
    if (state.options.has(node)) return true;
  }
  return false;
}

export function createPromotionChooser({ app }: Readonly<{ app: Element }>): PromotionChooser {
  if (!app) throw new TypeError('Promotion chooser requires an app element');
  const document = app.ownerDocument ?? globalThis.document;
  let pending: any = null;

  function removeOverlay(state: any = pending) {
    state?.overlay?.remove?.();
    if (state) {
      state.overlay = null;
      state.options.clear();
    }
  }

  function settle(piece: PromotionPiece | null) {
    const state = pending;
    if (!state) return false;
    pending = null;
    removeOverlay(state);
    document?.removeEventListener?.('pointerdown', state.onPointerDown, true);
    document?.removeEventListener?.('keydown', state.onKeyDown);
    state.resolve(piece);
    return true;
  }

  function render(center: string | undefined = pending?.center) {
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

    state.choices.forEach((piece: PromotionPiece, index: number) => {
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
      state.options.add(button);
    });

    state.overlay = overlay;
    host.appendChild(overlay);
    return true;
  }

  function choose({ center, to, choices, orientation = 'white', color = 'white' }: Readonly<{ center: string; to: string; choices: readonly string[]; orientation?: Orientation; color?: Orientation }>): Promise<PromotionPiece | null> {
    const available = orderedChoices(choices);
    if (!center || !to || !available.length) return Promise.resolve(null);
    if (pending) settle(null);

    return new Promise<PromotionPiece | null>((resolve) => {
      const state: any = {
        center,
        to,
        choices: available,
        orientation,
        color,
        overlay: null,
        options: new Set(),
        resolve,
        onPointerDown: null,
        onKeyDown: null,
      };
      state.onPointerDown = (event: any) => {
        if (isPromotionOptionTarget(state, event?.target)) return;
        event?.preventDefault?.();
        event?.stopPropagation?.();
        settle(null);
      };
      state.onKeyDown = (event: any) => {
        if (event?.key === 'Escape') settle(null);
      };
      pending = state;
      document?.addEventListener?.('pointerdown', state.onPointerDown, true);
      document?.addEventListener?.('keydown', state.onKeyDown);
      render(center);
    });
  }

  function sync({ center, orientation, color }: Readonly<{ center: string; orientation?: Orientation; color?: Orientation }>) {
    const state = pending;
    if (!state) return false;
    if (center !== state.center) return settle(null);
    if (orientation === 'white' || orientation === 'black') state.orientation = orientation;
    if (color === 'white' || color === 'black') state.color = color;
    return render(center);
  }

  return Object.freeze({
    choose,
    sync,
    cancel: () => settle(null),
    dispose: () => settle(null),
  });
}
