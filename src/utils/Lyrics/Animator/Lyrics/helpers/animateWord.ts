import Spring from "@socali/modules/Spring";
import Defaults from "../../../../../components/Global/Defaults.ts";
import storage from "../../../../storage.ts";
import { GetSpline, type AnimationPoint } from "./splineUtils.ts";
import { promoteToGPU } from "./gpuPromotion.ts";
import { queueStyle } from "./styleBatch.ts";
import { calculateGradientPosition } from "./gradientPosition.ts";
import {
  applyGlowStyle,
  WORD_BLUR_MULT,
  WORD_OPACITY_MULT,
  WORD_OPACITY_MAX,
} from "./glowStyle.ts";

// Word animation spline ranges
const ScaleRange: AnimationPoint[] = [
  { Time: 0, Value: 0.95 },
  { Time: 0.7, Value: 1.025 },
  { Time: 1, Value: 1 },
];
const YOffsetRange: AnimationPoint[] = [
  { Time: 0, Value: 1 / 100 },
  { Time: 0.9, Value: -(1 / 60) },
  { Time: 1, Value: 0 },
];
const GlowRange: AnimationPoint[] = [
  { Time: 0, Value: 0 },
  { Time: 0.15, Value: 1 },
  { Time: 0.6, Value: 1 },
  { Time: 1, Value: 0 },
];
const SimpleYOffsetRange: AnimationPoint[] = [
  { Time: 0, Value: 1 / 100 },
  { Time: 1, Value: -0.04 },
];

export const ScaleSpline = GetSpline(ScaleRange);
export const YOffsetSpline = GetSpline(
  storage.get("simpleLyricsMode") === "true" ? SimpleYOffsetRange : YOffsetRange
);
export const GlowSpline = GetSpline(GlowRange);

const YOffsetDamping = 0.4;
const YOffsetFrequency = 1.25;
const ScaleDamping = 0.6;
const ScaleFrequency = 0.7;
const GlowDamping = 0.5;
const GlowFrequency = 1;

export const createWordSprings = () => {
  if (Defaults.SimpleLyricsMode) {
    return {
      Scale: {
        Step: () => {},
        SetGoal: () => {},
      },
      YOffset: new Spring(YOffsetSpline.at(0), YOffsetFrequency, YOffsetDamping),
      Glow: {
        Step: () => {},
        SetGoal: () => {},
      },
    };
  }
  return {
    Scale: new Spring(ScaleSpline.at(0), ScaleFrequency, ScaleDamping),
    YOffset: new Spring(YOffsetSpline.at(0), YOffsetFrequency, YOffsetDamping),
    Glow: new Spring(GlowSpline.at(0), GlowFrequency, GlowDamping),
  };
};

const getSLMAnimation = (duration: number) => {
  return `SLM_Animation ${duration}ms linear forwards`;
};

const getPreSLMAnimation = (duration: number) => {
  return `Pre_SLM_GradientAnimation ${duration}ms linear forwards`;
};

/**
 * Animate a single word element (non-dot, non-letterGroup).
 * Handles spring init, state-based targets, stepping, and style application.
 * Returns the current glow value for potential reuse.
 */
export function animateWord(
  word: any,
  wordState: "Active" | "NotSung" | "Sung",
  percentage: number,
  deltaTime: number,
  words: any[],
  wordIndex: number
): void {
  if (!word.AnimatorStore) {
    word.AnimatorStore = createWordSprings();
    word.AnimatorStore.Scale.SetGoal(ScaleSpline.at(0), true);
    word.AnimatorStore.YOffset.SetGoal(YOffsetSpline.at(0), true);
    word.AnimatorStore.Glow.SetGoal(GlowSpline.at(0), true);
    promoteToGPU(word.HTMLElement);
  }

  const targetScale = wordState === "Active" ? ScaleSpline.at(percentage)
    : wordState === "NotSung" ? ScaleSpline.at(0)
    : ScaleSpline.at(1);
  const targetYOffset = wordState === "Active" ? YOffsetSpline.at(percentage)
    : wordState === "NotSung" ? YOffsetSpline.at(0)
    : YOffsetSpline.at(1);
  const targetGlow = wordState === "Active" ? GlowSpline.at(percentage)
    : wordState === "NotSung" ? GlowSpline.at(0)
    : GlowSpline.at(1);
  const targetGradientPos = calculateGradientPosition(wordState, percentage);

  word.AnimatorStore.Scale.SetGoal(targetScale);
  word.AnimatorStore.YOffset.SetGoal(targetYOffset);
  word.AnimatorStore.Glow.SetGoal(targetGlow);

  const currentScale = word.AnimatorStore.Scale.Step(deltaTime);
  const currentYOffset = word.AnimatorStore.YOffset.Step(deltaTime);
  const currentGlow = word.AnimatorStore.Glow.Step(deltaTime);

  queueStyle(word.HTMLElement, "scale", `${currentScale}`);
  queueStyle(
    word.HTMLElement,
    "transform",
    `translate3d(0, calc(var(--DefaultLyricsSize) * ${currentYOffset}), 0)`
  );

  // Apply gradient and glow for non-letterGroup words
  if (!word.LetterGroup) {
    const totalDuration = word.EndTime - word.StartTime;
    if (Defaults.SimpleLyricsMode) {
      if (wordState === "Active" && !word.SLMAnimated) {
        if (Defaults.SimpleLyricsMode_RenderingType === "calculate") {
          word.HTMLElement.style.setProperty(
            "--SLM_GradientPosition",
            `${targetGradientPos}%`
          );
        } else {
          word.HTMLElement.style.removeProperty("--SLM_GradientPosition");
          word.HTMLElement.style.animation = getSLMAnimation(totalDuration);
          word.SLMAnimated = true;
          word.PreSLMAnimated = false;
          const nextWord = words[wordIndex + 1];
          if (nextWord) {
            if (!nextWord.PreSLMAnimated) {
              nextWord.PreSLMAnimated = true;
              nextWord.HTMLElement.style.removeProperty("--SLM_GradientPosition");
              setTimeout(
                () => {
                  nextWord.HTMLElement.style.animation = getPreSLMAnimation(125);
                },
                Number(totalDuration * 0.6 - 22) ?? totalDuration
              );
            }
          }
        }
      }
      if (wordState === "NotSung") {
        if (Defaults.SimpleLyricsMode_RenderingType === "calculate") {
          word.HTMLElement.style.setProperty(
            "--SLM_GradientPosition",
            `${targetGradientPos}%`
          );
        } else {
          if (!word.PreSLMAnimated) {
            word.HTMLElement.style.animation = "none";
            word.HTMLElement.style.setProperty("--SLM_GradientPosition", "-50%");
          }
          word.SLMAnimated = false;
        }
      }
      if (wordState === "Sung") {
        if (Defaults.SimpleLyricsMode_RenderingType === "calculate") {
          word.HTMLElement.style.setProperty(
            "--SLM_GradientPosition",
            `${targetGradientPos}%`
          );
        } else {
          word.HTMLElement.style.animation = "none";
          word.HTMLElement.style.setProperty("--SLM_GradientPosition", "100%");
          word.SLMAnimated = false;
          word.PreSLMAnimated = false;
        }
      }
    } else {
      word.HTMLElement.style.setProperty("--gradient-position", `${targetGradientPos}%`);
    }
    applyGlowStyle(word.HTMLElement, currentGlow, WORD_BLUR_MULT, WORD_OPACITY_MULT, WORD_OPACITY_MAX);
  }
}

/**
 * Handle the SLM pre-animation for letterGroup words when active.
 */
export function handleLetterGroupSLMPreAnimation(
  word: any,
  wordState: "Active" | "NotSung" | "Sung",
  words: any[],
  wordIndex: number
): void {
  if (!word.LetterGroup) return;
  if (!Defaults.SimpleLyricsMode) return;
  if (wordState !== "Active") return;
  if (Defaults.SimpleLyricsMode_RenderingType !== "animate") return;

  const totalDuration = word.EndTime - word.StartTime;
  const nextWord = words[wordIndex + 1];
  if (nextWord && !nextWord?.LetterGroup) {
    if (!nextWord.PreSLMAnimated) {
      nextWord.PreSLMAnimated = true;
      nextWord.HTMLElement.style.removeProperty("--SLM_GradientPosition");
      setTimeout(
        () => {
          nextWord.HTMLElement.style.animation = getPreSLMAnimation(250);
        },
        Number(totalDuration * 0.845 - 130) ?? totalDuration
      );
    }
  }
}

/**
 * Animate a word in the "Sung" line state (used in checkNextLine).
 * Steps its springs toward the Sung target and applies styles.
 */
export function animateWordSung(
  word: any,
  deltaTime: number
): void {
  if (!word.AnimatorStore || word.Dot) return;

  word.AnimatorStore.Scale.SetGoal(ScaleSpline.at(1));
  word.AnimatorStore.YOffset.SetGoal(YOffsetSpline.at(1));
  word.AnimatorStore.Glow.SetGoal(GlowSpline.at(1));
  const currentScale = word.AnimatorStore.Scale.Step(deltaTime);
  const currentYOffset = word.AnimatorStore.YOffset.Step(deltaTime);
  const currentGlow = word.AnimatorStore.Glow.Step(deltaTime);

  queueStyle(
    word.HTMLElement,
    "transform",
    `translate3d(0, calc(var(--DefaultLyricsSize) * ${currentYOffset}), 0)`
  );
  queueStyle(word.HTMLElement, "scale", `${currentScale}`);

  if (!word.LetterGroup) {
    if (Defaults.SimpleLyricsMode) {
      word.HTMLElement.style.animation = "none";
      word.HTMLElement.style.setProperty("--SLM_GradientPosition", "100%");
    } else {
      word.HTMLElement.style.setProperty("--gradient-position", "100%");
    }
    applyGlowStyle(word.HTMLElement, currentGlow, WORD_BLUR_MULT, WORD_OPACITY_MULT, WORD_OPACITY_MAX);
  }
}
