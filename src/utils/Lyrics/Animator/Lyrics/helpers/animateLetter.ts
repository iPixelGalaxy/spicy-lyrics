import Spring from "@socali/modules/Spring";
import { easeSinOut } from "npm:d3-ease";
import Defaults from "../../../../../components/Global/Defaults.ts";
import { SimpleLyricsMode_LetterEffectsStrengthConfig } from "../../../lyrics.ts";
import { GetSpline, type AnimationPoint } from "./splineUtils.ts";
import { ScaleSpline, GlowSpline } from "./animateWord.ts";
import { promoteToGPU } from "./gpuPromotion.ts";
import { queueStyle } from "./styleBatch.ts";
import {
  applyGlowStyle,
  LETTER_BLUR_MULT,
  LETTER_OPACITY_MULT,
} from "./glowStyle.ts";

const SungLetterGlow = 0.2;

const YOffsetRange: AnimationPoint[] = [
  { Time: 0, Value: 1 / 100 },
  { Time: 0.9, Value: -(1 / 60) },
  { Time: 1, Value: 0 },
];
export const LetterYOffsetSpline = GetSpline(YOffsetRange);

const YOffsetDamping = 0.4;
const YOffsetFrequency = 1.25;
const ScaleDamping = 0.6;
const ScaleFrequency = 0.7;
const GlowDamping = 0.5;
const GlowFrequency = 1;

const getSLMAnimation = (duration: number) => {
  return `SLM_Animation ${duration}ms linear forwards`;
};

export const createLetterSprings = () => {
  return {
    Scale: new Spring(ScaleSpline.at(0), ScaleFrequency, ScaleDamping),
    YOffset: new Spring(LetterYOffsetSpline.at(0), YOffsetFrequency, YOffsetDamping),
    Glow: new Spring(GlowSpline.at(0), GlowFrequency, GlowDamping),
  };
};

function getElementState(
  currentTime: number,
  startTime: number,
  endTime: number
): "NotSung" | "Active" | "Sung" {
  if (currentTime < startTime) return "NotSung";
  if (currentTime > endTime) return "Sung";
  return "Active";
}

function getProgressPercentage(currentTime: number, startTime: number, endTime: number): number {
  if (currentTime <= startTime) return 0;
  if (currentTime >= endTime) return 1;
  return (currentTime - startTime) / (endTime - startTime);
}

function ensureLetterSprings(letter: any): void {
  if (!letter.AnimatorStore) {
    letter.AnimatorStore = createLetterSprings();
    letter.AnimatorStore.Scale.SetGoal(ScaleSpline.at(0), true);
    letter.AnimatorStore.YOffset.SetGoal(LetterYOffsetSpline.at(0), true);
    letter.AnimatorStore.Glow.SetGoal(GlowSpline.at(0), true);
    promoteToGPU(letter.HTMLElement);
  }
}

function applyLetterStyles(
  letter: any,
  deltaTime: number,
  targetGradient: number,
  letterState: "Active" | "NotSung" | "Sung"
): void {
  const currentScale = letter.AnimatorStore.Scale.Step(deltaTime);
  const currentYOffset = letter.AnimatorStore.YOffset.Step(deltaTime);
  const currentGlow = letter.AnimatorStore.Glow.Step(deltaTime);

  const totalDuration = letter.EndTime - letter.StartTime;

  // Apply gradient
  if (Defaults.SimpleLyricsMode) {
    if (Defaults.SimpleLyricsMode_RenderingType === "calculate") {
      letter.HTMLElement.style.setProperty(
        "--SLM_GradientPosition",
        `${targetGradient}%`
      );
    } else {
      if (letterState === "Active" && !letter.SLMAnimated) {
        letter.HTMLElement.style.removeProperty("--SLM_GradientPosition");
        letter.HTMLElement.style.animation = getSLMAnimation(totalDuration);
        letter.SLMAnimated = true;
      }
      if (letterState === "NotSung") {
        if (!letter.PreSLMAnimated) {
          letter.HTMLElement.style.animation = "none";
          letter.HTMLElement.style.setProperty("--SLM_GradientPosition", "-50%");
        }
        letter.SLMAnimated = false;
      }
      if (letterState === "Sung") {
        letter.HTMLElement.style.animation = "none";
        letter.HTMLElement.style.setProperty("--SLM_GradientPosition", "100%");
        letter.SLMAnimated = false;
      }
    }
  } else {
    letter.HTMLElement.style.setProperty("--gradient-position", `${targetGradient}%`);
  }

  // Apply transform and scale
  queueStyle(
    letter.HTMLElement,
    "transform",
    `translate3d(0, calc(var(--DefaultLyricsSize) * ${currentYOffset * 2}), 0)`
  );
  queueStyle(letter.HTMLElement, "scale", `${currentScale}`);
  applyGlowStyle(letter.HTMLElement, currentGlow, LETTER_BLUR_MULT, LETTER_OPACITY_MULT);
}

/**
 * Animate letters in the Active word state — includes proximity-based animation.
 */
export function animateLettersActive(
  word: any,
  ProcessedPosition: number,
  deltaTime: number
): void {
  if (!word.Letters) return;

  // Find active letter info
  let activeLetterIndex = -1;
  let activeLetterPercentage = 0;
  for (let i = 0; i < word.Letters.length; i++) {
    if (
      getElementState(
        ProcessedPosition,
        word.Letters[i].StartTime,
        word.Letters[i].EndTime
      ) === "Active"
    ) {
      activeLetterIndex = i;
      activeLetterPercentage = getProgressPercentage(
        ProcessedPosition,
        word.Letters[i].StartTime,
        word.Letters[i].EndTime
      );
      break;
    }
  }

  for (let k = 0; k < word.Letters.length; k++) {
    const letter = word.Letters[k];
    ensureLetterSprings(letter);

    let targetScale: number;
    let targetYOffset: number;
    let targetGlow: number;
    let targetGradient: number;

    // Default active state target is resting
    targetScale = ScaleSpline.at(0);
    targetYOffset = LetterYOffsetSpline.at(0);
    targetGlow = GlowSpline.at(0);

    const letterState = getElementState(
      ProcessedPosition,
      letter.StartTime,
      letter.EndTime
    );

    // Apply proximity-based animation if an active letter is found
    if (activeLetterIndex !== -1) {
      const percentageCount = Defaults.SimpleLyricsMode
        ? getProgressPercentage(ProcessedPosition, word.StartTime, word.EndTime)
        : activeLetterPercentage;

      const config = SimpleLyricsMode_LetterEffectsStrengthConfig;
      const baseScale =
        ScaleSpline.at(percentageCount) *
        (Defaults.SimpleLyricsMode
          ? word.TotalTime > config.LongerThan
            ? config.Longer.Scale
            : config.Shorter.Scale
          : 1);
      const baseYOffset =
        LetterYOffsetSpline.at(percentageCount) *
        (Defaults.SimpleLyricsMode
          ? word.TotalTime > config.LongerThan
            ? config.Longer.YOffset
            : config.Shorter.YOffset
          : 1);
      const baseGlow =
        GlowSpline.at(percentageCount) *
        (Defaults.SimpleLyricsMode
          ? word.TotalTime > config.LongerThan
            ? config.Longer.Glow
            : config.Shorter.Glow
          : 1);

      const restingScale = ScaleSpline.at(0);
      const restingYOffset = LetterYOffsetSpline.at(0);
      const restingGlow = GlowSpline.at(0);

      const distance = Math.abs(k - activeLetterIndex);
      const falloff = Math.max(0, 1 / (1 + distance * 0.9));

      targetScale = restingScale + (baseScale - restingScale) * falloff;
      targetYOffset = restingYOffset + (baseYOffset - restingYOffset) * falloff;
      targetGlow = restingGlow + (baseGlow - restingGlow) * falloff;
    }

    // Override for specific letter states
    if (letterState === "NotSung" && !Defaults.SimpleLyricsMode) {
      targetScale = ScaleSpline.at(0);
      targetYOffset = LetterYOffsetSpline.at(0);
      targetGlow = GlowSpline.at(0);
    } else if (letterState === "Sung" && activeLetterIndex === -1) {
      targetGlow = GlowSpline.at(SungLetterGlow);
    }

    // Determine Gradient
    if (letterState === "NotSung") {
      targetGradient = Defaults.SimpleLyricsMode ? -50 : -20;
    } else if (letterState === "Sung") {
      targetGradient = 100;
    } else {
      // Active
      if (Defaults.SimpleLyricsMode) {
        targetGradient =
          k === activeLetterIndex
            ? -50 + 120 * easeSinOut(activeLetterPercentage)
            : -50;
      } else {
        targetGradient =
          k === activeLetterIndex
            ? -20 + 120 * easeSinOut(activeLetterPercentage)
            : -20;
      }
    }

    letter.AnimatorStore.Scale.SetGoal(targetScale);
    letter.AnimatorStore.YOffset.SetGoal(targetYOffset);
    letter.AnimatorStore.Glow.SetGoal(targetGlow);

    applyLetterStyles(letter, deltaTime, targetGradient, letterState);
  }
}

/**
 * Animate letters in the NotSung word state — all letters at resting position.
 */
export function animateLettersNotSung(
  word: any,
  deltaTime: number
): void {
  if (!word.Letters) return;

  for (let k = 0; k < word.Letters.length; k++) {
    const letter = word.Letters[k];
    ensureLetterSprings(letter);

    letter.AnimatorStore.Scale.SetGoal(ScaleSpline.at(0));
    letter.AnimatorStore.YOffset.SetGoal(LetterYOffsetSpline.at(0));
    letter.AnimatorStore.Glow.SetGoal(GlowSpline.at(0));

    const notSungGradient = Defaults.SimpleLyricsMode ? -50 : -20;

    if (Defaults.SimpleLyricsMode) {
      letter.HTMLElement.style.animation = "none";
      letter.HTMLElement.style.setProperty("--SLM_GradientPosition", "-50%");
    }

    applyLetterStyles(letter, deltaTime, notSungGradient, "NotSung");
  }
}

/**
 * Animate letters in the Sung word state — all letters at end position.
 */
export function animateLettersSung(
  word: any,
  deltaTime: number
): void {
  if (!word.Letters) return;

  for (let k = 0; k < word.Letters.length; k++) {
    const letter = word.Letters[k];
    ensureLetterSprings(letter);

    letter.AnimatorStore.Scale.SetGoal(ScaleSpline.at(1));
    letter.AnimatorStore.YOffset.SetGoal(LetterYOffsetSpline.at(1));
    letter.AnimatorStore.Glow.SetGoal(GlowSpline.at(1));

    if (Defaults.SimpleLyricsMode) {
      letter.HTMLElement.style.animation = "none";
      letter.HTMLElement.style.setProperty("--SLM_GradientPosition", "100%");
    }

    applyLetterStyles(letter, deltaTime, 100, "Sung");
  }
}

/**
 * Animate letters for a sung line's checkNextLine flow.
 * Direct style writes (not using setStyleIfChanged) to match original behavior.
 */
export function animateLettersSungLine(
  word: any,
  deltaTime: number
): void {
  if (!word.Letters) return;

  for (let k = 0; k < word.Letters.length; k++) {
    const letter = word.Letters[k];
    ensureLetterSprings(letter);

    letter.AnimatorStore.Scale.SetGoal(ScaleSpline.at(1));
    letter.AnimatorStore.YOffset.SetGoal(LetterYOffsetSpline.at(1));
    letter.AnimatorStore.Glow.SetGoal(GlowSpline.at(1));

    const currentScale = letter.AnimatorStore.Scale.Step(deltaTime);
    const currentYOffset = letter.AnimatorStore.YOffset.Step(deltaTime);
    const currentGlow = letter.AnimatorStore.Glow.Step(deltaTime);

    if (Defaults.SimpleLyricsMode) {
      letter.HTMLElement.style.animation = "none";
      letter.HTMLElement.style.setProperty("--SLM_GradientPosition", "100%");
    } else {
      letter.HTMLElement.style.setProperty("--gradient-position", `100%`);
    }
    queueStyle(
      letter.HTMLElement,
      "transform",
      `translate3d(0, calc(var(--DefaultLyricsSize) * ${currentYOffset * 2}), 0)`
    );
    queueStyle(letter.HTMLElement, "scale", `${currentScale}`);
    letter.HTMLElement.style.setProperty(
      "--text-shadow-blur-radius",
      `${4 + 12 * currentGlow}px`
    );
    letter.HTMLElement.style.setProperty(
      "--text-shadow-opacity",
      `${currentGlow * LETTER_OPACITY_MULT}%`
    );
  }
}
