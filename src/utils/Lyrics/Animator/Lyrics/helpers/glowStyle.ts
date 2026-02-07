import { setStyleIfChanged } from "./styleBatch.ts";

// Named constants for blur multipliers per element type
export const GLOW_BLUR_BASE = 4;
export const WORD_BLUR_MULT = 2;
export const DOT_BLUR_MULT = 6;
export const LETTER_BLUR_MULT = 12;
export const LINE_BLUR_MULT = 8;

// Named constants for glow opacity multipliers
export const WORD_OPACITY_MULT = 35;
export const WORD_OPACITY_MAX = 100;
export const DOT_OPACITY_MULT = 90;
export const LETTER_OPACITY_MULT = 185;
export const LINE_OPACITY_MULT = 50;

/**
 * Apply glow style (text-shadow blur + opacity) to an element.
 */
export function applyGlowStyle(
  el: HTMLElement,
  currentGlow: number,
  blurMult: number,
  opacityMult: number,
  opacityMax: number = Infinity
): void {
  const blurValue = `${GLOW_BLUR_BASE + blurMult * currentGlow}px`;
  const opacityValue = `${Math.min(currentGlow * opacityMult, opacityMax)}%`;
  setStyleIfChanged(el, "--text-shadow-blur-radius", blurValue, 0.5);
  setStyleIfChanged(el, "--text-shadow-opacity", opacityValue, 1);
}
