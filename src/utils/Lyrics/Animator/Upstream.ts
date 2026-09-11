import type { AnimatorValues } from "./Tuning.ts";

// Spikerko/spicy-lyrics main, 2a14863f8c29782f9ab3becff2b1360dfb74a4fb.
// Keep Default independent of the editable registry and Pixel tuning defaults.
export const UPSTREAM_ANIMATOR_VALUES: Readonly<AnimatorValues> = Object.freeze({
  wordPeakScale: 1.0505,
  letterPeakScale: 1.175,
  verticalStrength: 1,
  glowStrength: 1,
  blurStrength: 1,
  scaleFrequency: .88,
  scaleDamping: .64,
  verticalFrequency: 1.45,
  verticalDamping: .4,
  glowFrequency: 1.18,
  glowDamping: .56,
});
