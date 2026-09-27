import { resolveMove } from './graph.js';

const PROMOTION_PIECES = Object.freeze(['q', 'r', 'b', 'n']);
const PROMOTION_NAMES = Object.freeze({
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
});

export function promotionChoices(source, from, to) {
  try {
    resolveMove(source, { from, to });
    return [];
  } catch {}

  return PROMOTION_PIECES.filter((promotion) => {
    try {
      resolveMove(source, { from, to, promotion });
      return true;
    } catch {
      return false;
    }
  });
}

export function promptPromotion(windowLike, choices) {
  if (!choices?.length || typeof windowLike?.prompt !== 'function') return null;
  const allowed = new Set(choices);
  const defaultPiece = allowed.has('q') ? 'q' : choices[0];
  const descriptions = choices.map((piece) => `${piece}=${PROMOTION_NAMES[piece] ?? piece}`).join(', ');

  while (true) {
    const answer = windowLike.prompt(`Promote pawn (${descriptions})`, defaultPiece);
    if (answer == null) return null;
    const piece = String(answer).trim().toLowerCase().slice(0, 1);
    if (allowed.has(piece)) return piece;
  }
}

export function bindRecenterTarget(element, actions, target) {
  if (!element?.addEventListener || typeof actions?.recenter !== 'function') return null;
  const resolveTarget = typeof target === 'function' ? target : () => target;
  const handler = () => actions.recenter({ target: resolveTarget() });
  element.addEventListener('click', handler);
  return handler;
}

export function createBoardMoveRecenterHandler({
  source,
  actions,
  choosePromotion,
  resolvePromotionChoices = promotionChoices,
} = {}) {
  if (typeof actions?.recenter !== 'function') {
    throw new TypeError('Board move recenter handler requires actions.recenter');
  }

  return async (from, to) => {
    const choices = resolvePromotionChoices(source, from, to);
    let promotion;

    if (choices.length) {
      promotion = await choosePromotion?.(choices);
      if (!promotion || !choices.includes(promotion)) {
        await actions.redraw?.();
        return false;
      }
    }

    const move = promotion ? { from, to, promotion } : { from, to };
    return actions.recenter({ move });
  };
}
