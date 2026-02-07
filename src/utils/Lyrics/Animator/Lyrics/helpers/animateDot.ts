import Spring from "@socali/modules/Spring";
import Defaults from "../../../../../components/Global/Defaults.ts";
import storage from "../../../../storage.ts";
import { GetSpline, type AnimationPoint } from "./splineUtils.ts";
import { promoteToGPU } from "./gpuPromotion.ts";
import { queueStyle } from "./styleBatch.ts";
import {
  applyGlowStyle,
  DOT_BLUR_MULT,
  DOT_OPACITY_MULT,
} from "./glowStyle.ts";

// Dot Animation Constants
const DotAnimations = {
  YOffsetDamping: 0.4,
  YOffsetFrequency: 1.25,
  ScaleDamping: 0.6,
  ScaleFrequency: 0.7,
  GlowDamping: 0.5,
  GlowFrequency: 1,
  OpacityDamping: 0.5,
  OpacityFrequency: 1,

  ScaleRange: [
    { Time: 0, Value: 0.75 },
    { Time: 0.7, Value: 1.05 },
    { Time: 1, Value: 1 },
  ] as AnimationPoint[],
  YOffsetRange: [
    { Time: 0, Value: 0 },
    { Time: 0.9, Value: -0.12 },
    { Time: 1, Value: 0 },
  ] as AnimationPoint[],
  GlowRange: [
    { Time: 0, Value: 0 },
    { Time: 0.6, Value: 1 },
    { Time: 1, Value: 1 },
  ] as AnimationPoint[],
  OpacityRange: [
    { Time: 0, Value: storage.get("simpleLyricsMode") === "true" ? 0.27 : 0.35 },
    { Time: 0.6, Value: 1 },
    { Time: 1, Value: 1 },
  ] as AnimationPoint[],
};

export const DotScaleSpline = GetSpline(DotAnimations.ScaleRange);
export const DotYOffsetSpline = GetSpline(DotAnimations.YOffsetRange);
export const DotGlowSpline = GetSpline(DotAnimations.GlowRange);
export const DotOpacitySpline = GetSpline(DotAnimations.OpacityRange);

export const createDotSprings = () => {
  if (Defaults.SimpleLyricsMode) {
    return {
      Scale: {
        Step: () => {},
        SetGoal: () => {},
      },
      YOffset: {
        Step: () => {},
        SetGoal: () => {},
      },
      Glow: {
        Step: () => {},
        SetGoal: () => {},
      },
      Opacity: new Spring(
        DotOpacitySpline.at(0),
        DotAnimations.OpacityFrequency,
        DotAnimations.OpacityDamping
      ),
    };
  }
  return {
    Scale: new Spring(
      DotScaleSpline.at(0),
      DotAnimations.ScaleFrequency,
      DotAnimations.ScaleDamping
    ),
    YOffset: new Spring(
      DotYOffsetSpline.at(0),
      DotAnimations.YOffsetFrequency,
      DotAnimations.YOffsetDamping
    ),
    Glow: new Spring(DotGlowSpline.at(0), DotAnimations.GlowFrequency, DotAnimations.GlowDamping),
    Opacity: new Spring(
      DotOpacitySpline.at(0),
      DotAnimations.OpacityFrequency,
      DotAnimations.OpacityDamping
    ),
  };
};

/**
 * Animate a single dot element. Shared by both Syllable and Line lyrics types.
 */
export function animateDot(
  dot: any,
  dotState: "Active" | "NotSung" | "Sung",
  dotPercentage: number,
  deltaTime: number
): void {
  // Initialize springs if needed
  if (!dot.AnimatorStore) {
    dot.AnimatorStore = createDotSprings();
    dot.AnimatorStore.Scale.SetGoal(DotScaleSpline.at(0), true);
    dot.AnimatorStore.YOffset.SetGoal(DotYOffsetSpline.at(0), true);
    dot.AnimatorStore.Glow.SetGoal(DotGlowSpline.at(0), true);
    dot.AnimatorStore.Opacity.SetGoal(DotOpacitySpline.at(0), true);
    promoteToGPU(dot.HTMLElement);
  }

  let targetScale: number;
  let targetYOffset: number;
  let targetGlow: number;
  let targetOpacity: number;

  if (dotState === "Active") {
    targetScale = DotScaleSpline.at(dotPercentage);
    targetYOffset = DotYOffsetSpline.at(dotPercentage);
    targetGlow = DotGlowSpline.at(dotPercentage);
    targetOpacity = DotOpacitySpline.at(dotPercentage);
  } else if (dotState === "NotSung") {
    targetScale = DotScaleSpline.at(0);
    targetYOffset = DotYOffsetSpline.at(0);
    targetGlow = DotGlowSpline.at(0);
    targetOpacity = DotOpacitySpline.at(0);
  } else {
    // Sung
    targetScale = DotScaleSpline.at(1);
    targetYOffset = DotYOffsetSpline.at(1);
    targetGlow = DotGlowSpline.at(1);
    targetOpacity = DotOpacitySpline.at(1);
  }

  dot.AnimatorStore.Scale.SetGoal(targetScale);
  dot.AnimatorStore.YOffset.SetGoal(targetYOffset);
  dot.AnimatorStore.Glow.SetGoal(targetGlow);
  dot.AnimatorStore.Opacity.SetGoal(targetOpacity);

  const currentScale = dot.AnimatorStore.Scale.Step(deltaTime);
  const currentYOffset = dot.AnimatorStore.YOffset.Step(deltaTime);
  const currentGlow = dot.AnimatorStore.Glow.Step(deltaTime);
  const currentOpacity = dot.AnimatorStore.Opacity.Step(deltaTime);

  queueStyle(
    dot.HTMLElement,
    "transform",
    `translate3d(0, calc(var(--DefaultLyricsSize) * ${currentYOffset ?? 0}), 0)`
  );
  queueStyle(dot.HTMLElement, "scale", `${currentScale}`);
  queueStyle(dot.HTMLElement, "opacity", `${currentOpacity}`);
  applyGlowStyle(dot.HTMLElement, currentGlow, DOT_BLUR_MULT, DOT_OPACITY_MULT);
}
