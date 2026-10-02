import type { NodusActions } from './nodus-controller.ts';

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export function promotionChoices(source: string, from: string, to: string): PromotionPiece[];

export function bindRecenterTarget(
  element: Element,
  actions: NodusActions,
  target: string | (() => string | undefined),
): (() => unknown) | null;

export function createBoardMoveRecenterHandler(options: Readonly<{
  source: string;
  actions: NodusActions;
  choosePromotion?: (
    choices: readonly PromotionPiece[],
    move: Readonly<{ from: string; to: string }>,
  ) => PromotionPiece | null | Promise<PromotionPiece | null>;
  resolvePromotionChoices?: (source: string, from: string, to: string) => PromotionPiece[];
}>): (from: string, to: string) => Promise<unknown>;
