import Defaults from "../../../../../components/Global/Defaults.ts";

/**
 * Calculate gradient position based on element state and progress percentage.
 */
export function calculateGradientPosition(
  state: "Active" | "NotSung" | "Sung",
  percentage: number
): number {
  if (state === "NotSung") {
    return Defaults.SimpleLyricsMode ? -50 : -20;
  }
  if (state === "Sung") {
    return 100;
  }
  // Active
  return Defaults.SimpleLyricsMode
    ? -50 + 120 * percentage
    : -20 + 120 * percentage;
}

/**
 * Apply gradient position to an element, handling SimpleLyricsMode rendering types.
 */
export function applyGradientPosition(
  el: HTMLElement,
  gradientPos: number
): void {
  if (Defaults.SimpleLyricsMode) {
    if (Defaults.SimpleLyricsMode_RenderingType === "calculate") {
      el.style.setProperty("--SLM_GradientPosition", `${gradientPos}%`);
    }
  } else {
    el.style.setProperty("--gradient-position", `${gradientPos}%`);
  }
}
