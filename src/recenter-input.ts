import { resolveMove } from './graph.ts';
import type { CurrentViewActions } from './current-view-controller.ts';

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

const PROMOTION_PIECES: readonly PromotionPiece[] = Object.freeze(['q', 'r', 'b', 'n']);

export function promotionChoices(source: string, from: string, to: string): PromotionPiece[] {
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

export function bindRecenterTarget(element: Element, actions: CurrentViewActions, target: string | (() => string | undefined)): (() => unknown) | null {
  if (!element?.addEventListener || typeof actions?.recenter !== 'function') return null;
  const resolveTarget = typeof target === 'function' ? target : () => target;
  const handler = () => {
    const resolved = resolveTarget();
    return resolved ? actions.recenter({ target: resolved }) : false;
  };
  element.addEventListener('click', handler);
  return handler;
}

export function createBoardMoveRecenterHandler({ source, actions, choosePromotion, resolvePromotionChoices = promotionChoices }: Readonly<{ source: string; actions: CurrentViewActions; choosePromotion?: (choices: readonly PromotionPiece[], move: Readonly<{ from: string; to: string }>) => PromotionPiece | null | Promise<PromotionPiece | null>; resolvePromotionChoices?: (source: string, from: string, to: string) => PromotionPiece[]; }>) {
  if (typeof actions?.recenter !== 'function') {
    throw new TypeError('Board move recenter handler requires actions.recenter');
  }

  return async (from: string, to: string): Promise<unknown> => {
    const choices = resolvePromotionChoices(source, from, to);
    let promotion;

    if (choices.length) {
      promotion = await choosePromotion?.(choices, { from, to });
      if (!promotion || !choices.includes(promotion)) {
        await actions.redraw?.();
        return false;
      }
    }

    const move = promotion ? { from, to, promotion } : { from, to };
    return actions.recenter({ move });
  };
}
