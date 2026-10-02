import type { Orientation } from './nodus-controller.ts';
import type { PromotionPiece } from './recenter-input.js';

export type PromotionChooser = Readonly<{
  choose(input: Readonly<{
    center: string;
    to: string;
    choices: readonly string[];
    orientation?: Orientation;
    color?: Orientation;
  }>): Promise<PromotionPiece | null>;
  sync(input: Readonly<{
    center: string;
    orientation?: Orientation;
    color?: Orientation;
  }>): boolean;
  cancel(): boolean;
  dispose(): boolean;
}>;

export function createPromotionChooser(options: Readonly<{ app: Element }>): PromotionChooser;
