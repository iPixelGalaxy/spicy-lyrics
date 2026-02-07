import Spring from "@socali/modules/Spring";
import Defaults from "../../../../components/Global/Defaults.ts";
import { SpotifyPlayer } from "../../../../components/Global/SpotifyPlayer.ts";
import { isSpicySidebarMode } from "../../../../components/Utils/SidebarLyrics.ts";
import { currentLyricsPlayer } from "../../Global/Applyer.ts";
import { LyricsObject } from "../../lyrics.ts";
import { BlurMultiplier, SidebarBlurMultiplier, timeOffset } from "../Shared.ts";

// Shared utilities (re-exported for backward compatibility)
export { GetSpline, Clamp, type AnimationPoint } from "./helpers/splineUtils.ts";
import { GetSpline } from "./helpers/splineUtils.ts";

// Helpers
import { setStyleIfChanged, flushStyleBatch } from "./helpers/styleBatch.ts";
import { promoteToGPUWithFilter } from "./helpers/gpuPromotion.ts";
import { setLineStateClass } from "./helpers/setLineStateClass.ts";
import { animateWord, animateWordSung, handleLetterGroupSLMPreAnimation } from "./helpers/animateWord.ts";
import { animateDot } from "./helpers/animateDot.ts";
import {
  animateLettersActive,
  animateLettersNotSung,
  animateLettersSung,
  animateLettersSungLine,
} from "./helpers/animateLetter.ts";
import { updateViewportRange, isLineInViewportRange } from "./helpers/viewportTracker.ts";

// Line glow springs
const LineGlowRange = [
  { Time: 0, Value: 0 },
  { Time: 0.5, Value: 1 },
  { Time: 1, Value: 0 },
];
const LineGlowSpline = GetSpline(LineGlowRange);
const LineGlowDamping = 0.5;
const LineGlowFrequency = 1;

const createLineSprings = () => {
  if (Defaults.SimpleLyricsMode) {
    return {
      Glow: {
        Step: () => {},
        SetGoal: () => {},
      },
    };
  }
  return {
    Glow: new Spring(LineGlowSpline.at(0), LineGlowFrequency, LineGlowDamping),
  };
};

// Cached Credits element reference
let _cachedCreditsElement: HTMLElement | null = null;

export function getCachedCreditsElement(): HTMLElement | undefined {
  if (_cachedCreditsElement?.isConnected) {
    return _cachedCreditsElement;
  }
  _cachedCreditsElement =
    document.querySelector<HTMLElement>(
      "#SpicyLyricsPage .LyricsContainer .LyricsContent .Credits"
    ) ?? null;
  return _cachedCreditsElement ?? undefined;
}

export function clearCachedCreditsElement(): void {
  _cachedCreditsElement = null;
}

// Cached scroll container for viewport tracking
let _cachedScrollContainer: HTMLElement | null = null;

function getScrollContainer(): HTMLElement | null {
  if (_cachedScrollContainer?.isConnected) {
    return _cachedScrollContainer;
  }
  _cachedScrollContainer =
    document.querySelector<HTMLElement>(
      "#SpicyLyricsPage .LyricsContainer .LyricsContent .simplebar-content-wrapper"
    ) ?? null;
  return _cachedScrollContainer;
}

export function clearCachedScrollContainer(): void {
  _cachedScrollContainer = null;
}

export let Blurring_LastLine: number | null = null;
let lastFrameTime = performance.now();

export function findActiveElement(currentTime: number): any {
  const ProcessedPosition = currentTime + timeOffset;
  const CurrentLyricsType = Defaults.CurrentLyricsType;

  if (!CurrentLyricsType || CurrentLyricsType === "None") return null;

  if (CurrentLyricsType === "Syllable") {
    const lines = LyricsObject.Types.Syllable.Lines;
    for (const line of lines) {
      if (getElementState(ProcessedPosition, line.StartTime, line.EndTime) === "Active") {
        if (line.DotLine && line.Syllables?.Lead) {
          const dotArray = line.Syllables.Lead;
          for (const dot of dotArray) {
            if (getElementState(ProcessedPosition, dot.StartTime, dot.EndTime) === "Active") {
              return [dot, "dot"];
            }
          }
        } else if (line.Syllables?.Lead) {
          const words = line.Syllables.Lead;
          for (const word of words) {
            if (word.Dot) continue;
            if (getElementState(ProcessedPosition, word.StartTime, word.EndTime) === "Active") {
              if (word.LetterGroup && word.Letters) {
                for (const letter of word.Letters) {
                  if (
                    getElementState(ProcessedPosition, letter.StartTime, letter.EndTime) ===
                    "Active"
                  ) {
                    return [letter, "letter"];
                  }
                }
              }
              return [word, word.LetterGroup ? "letterGroup" : "word"];
            }
          }
        }
        return [line, "line"];
      }
    }
  } else if (CurrentLyricsType === "Line") {
    const lines = LyricsObject.Types.Line.Lines;
    for (const line of lines) {
      if (getElementState(ProcessedPosition, line.StartTime, line.EndTime) === "Active") {
        if (line.DotLine && line.Syllables?.Lead) {
          const dotArray = line.Syllables.Lead;
          for (const dot of dotArray) {
            if (getElementState(ProcessedPosition, dot.StartTime, dot.EndTime) === "Active") {
              return [dot, "dot"];
            }
          }
        }
        return [line, "line"];
      }
    }
  }

  return null;
}

export function setBlurringLastLine(c: number | null) {
  Blurring_LastLine = c;
}

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

let lastAnimateFrameTime = 0;
const FRAME_INTERVAL_MS = 1000 / 50;
let clpStatus: "playing" | "paused" | null = null;

export function Animate(position: number): void {
  const ProcessedPosition = position + timeOffset - (Defaults.SimpleLyricsMode ? 33.5 : 0);

  if (Defaults.LyricsRenderer === "aml-lyrics") {
    if (clpStatus === null) {
      if (!currentLyricsPlayer) return;
      if (SpotifyPlayer.IsPlaying) {
        currentLyricsPlayer.resume();
        clpStatus = "playing";
      } else {
        currentLyricsPlayer.pause();
        clpStatus = "paused";
      }
    }
    if (SpotifyPlayer.IsPlaying && clpStatus === "playing") {
      if (!currentLyricsPlayer) return;
      currentLyricsPlayer.pause();
      clpStatus = "paused";
    } else if (!SpotifyPlayer.IsPlaying && clpStatus === "paused") {
      if (!currentLyricsPlayer) return;
      currentLyricsPlayer.resume();
      clpStatus = "playing";
    }
    if (currentLyricsPlayer) {
      currentLyricsPlayer.setCurrentTime(ProcessedPosition);
      currentLyricsPlayer.update(ProcessedPosition);
    }
    return;
  }

  const now = performance.now();

  const LIMIT_FRAMES = (isSpicySidebarMode ? (Defaults.SimpleLyricsMode ? false : true) : false);
  const FRAME_INTERVAL = FRAME_INTERVAL_MS;

  const shouldLimitFrame = LIMIT_FRAMES && now - lastAnimateFrameTime < FRAME_INTERVAL;
  if (shouldLimitFrame) {
    return;
  }
  const deltaTime = (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  lastAnimateFrameTime = now;

  const CurrentLyricsType = Defaults.CurrentLyricsType;

  if (!CurrentLyricsType || CurrentLyricsType === "None") return;

  const Credits = getCachedCreditsElement();

  // Apply blur helper (closure over ProcessedPosition)
  const applyBlur = (
    arr: Array<{ HTMLElement: HTMLElement; StartTime: number; EndTime: number }>,
    activeIndex: number,
    blurMultiplierValue: number
  ): void => {
    if (!arr[activeIndex]) return;

    promoteToGPUWithFilter(arr[activeIndex].HTMLElement);

    const max = BlurMultiplier * 5 + BlurMultiplier * 0.465;

    for (let i = 0; i < arr.length; i++) {
      const el = arr[i].HTMLElement;
      const state = getElementState(ProcessedPosition, arr[i].StartTime, arr[i].EndTime);
      const distance = Math.abs(i - activeIndex);
      const blurAmount = distance === 0 ? 0 : Math.min(blurMultiplierValue * distance, max);

      const value = state === "Active" || distance === 0 ? "0px" : `${blurAmount}px`;

      setStyleIfChanged(el, "--BlurAmount", value, 0.25);
      promoteToGPUWithFilter(el);
    }
  };

  if (CurrentLyricsType === "Syllable") {
    const arr = LyricsObject.Types.Syllable.Lines;

    // Update viewport range for culling
    updateViewportRange(getScrollContainer(), arr);

    for (let index = 0; index < arr.length; index++) {
      const line = arr[index];
      const lineState = getElementState(ProcessedPosition, line.StartTime, line.EndTime);

      // Always set state classes (lightweight)
      setLineStateClass(line.HTMLElement, lineState);

      // Viewport culling: skip expensive spring/style work for offscreen lines
      if (!isLineInViewportRange(index)) {
        continue;
      }

      if (lineState === "Active") {
        if (Blurring_LastLine !== index) {
          applyBlur(arr, index, isSpicySidebarMode ? SidebarBlurMultiplier : BlurMultiplier);
          Blurring_LastLine = index;
        }

        if (!line.Syllables?.Lead) {
          console.warn("Line has no Syllables.Lead array");
          continue;
        }

        const words = line.Syllables.Lead;
        for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
          const word = words[wordIndex];
          const wordState = getElementState(ProcessedPosition, word.StartTime, word.EndTime);
          const percentage = getProgressPercentage(ProcessedPosition, word.StartTime, word.EndTime);

          const isLetterGroup = word?.LetterGroup;
          const isDot = word?.Dot;

          if (!isDot) {
            // Animate word (handles init, springs, styles, gradient, glow)
            animateWord(word, wordState, percentage, deltaTime, words, wordIndex);

            // Handle letterGroup SLM pre-animation
            if (isLetterGroup) {
              handleLetterGroupSLMPreAnimation(word, wordState, words, wordIndex);
            }
          } else if (isDot && !isLetterGroup) {
            // Animate dot
            animateDot(word, wordState, percentage, deltaTime);
          }

          // Animate letters within letterGroups
          if (isLetterGroup && word.Letters) {
            if (wordState === "Active") {
              animateLettersActive(word, ProcessedPosition, deltaTime);
            } else if (wordState === "NotSung") {
              animateLettersNotSung(word, deltaTime);
            } else if (wordState === "Sung") {
              animateLettersSung(word, deltaTime);
            }
          }
        }
      } else if (lineState === "Sung") {
        // Credits activation when last line is sung
        if (arr.length === index + 1) {
          if (Credits && !Credits.classList.contains("Active")) {
            Credits.classList.add("Active");
          }
        }

        // Animate words transitioning to sung state
        const checkNextLine = () => {
          const words = line.Syllables?.Lead;
          if (!words) return;
          for (let i = 0; i < words.length; i++) {
            const word = words[i];
            if (word.AnimatorStore && !word.Dot) {
              animateWordSung(word, deltaTime);
            } else if (word.AnimatorStore && word.Dot && !word.LetterGroup) {
              animateDot(word, "Sung", 1, deltaTime);
            }
            if (word.LetterGroup && word.Letters) {
              animateLettersSungLine(word, deltaTime);
            }
          }
        };

        {
          const NextLine = arr[index + 1];
          if (NextLine) {
            const nextLineStatus = getElementState(
              ProcessedPosition,
              NextLine.StartTime,
              NextLine.EndTime
            );
            if (nextLineStatus === "NotSung" || nextLineStatus === "Active") {
              checkNextLine();
            }
          } else if (!NextLine) {
            checkNextLine();
          }
        }
      }
      // NotSung lines: class already set by setLineStateClass, no animation needed
    }
  } else if (CurrentLyricsType === "Line") {
    const arr = LyricsObject.Types.Line.Lines;

    // Update viewport range for culling
    updateViewportRange(getScrollContainer(), arr);

    for (let index = 0; index < arr.length; index++) {
      const line = arr[index];
      const lineState = getElementState(ProcessedPosition, line.StartTime, line.EndTime);

      // Always set state classes (lightweight)
      setLineStateClass(line.HTMLElement, lineState);

      // Viewport culling: skip expensive spring/style work for offscreen lines
      if (!isLineInViewportRange(index)) {
        continue;
      }

      if (lineState === "Active") {
        if (Blurring_LastLine !== index) {
          applyBlur(arr, index, isSpicySidebarMode ? SidebarBlurMultiplier : BlurMultiplier);
          Blurring_LastLine = index;
        }

        const percentage = getProgressPercentage(ProcessedPosition, line.StartTime, line.EndTime);

        if (line.DotLine && line.Syllables?.Lead) {
          const dotArray = line.Syllables.Lead;
          for (let i = 0; i < dotArray.length; i++) {
            const dot = dotArray[i];
            const dotState = getElementState(ProcessedPosition, dot.StartTime, dot.EndTime);
            const dotPercentage = getProgressPercentage(
              ProcessedPosition,
              dot.StartTime,
              dot.EndTime
            );
            animateDot(dot, dotState, dotPercentage, deltaTime);
          }
        } else {
          // Line animation (non-dot) using springs
          if (!line.AnimatorStore) {
            line.AnimatorStore = createLineSprings();
            line.AnimatorStore.Glow.SetGoal(LineGlowSpline.at(0), true);
          }

          let targetGlow: number;
          let targetGradientPos: number;

          if (lineState === "Active") {
            targetGlow = LineGlowSpline.at(percentage);
            targetGradientPos = percentage * 100;
          } else if (lineState === "NotSung") {
            targetGlow = LineGlowSpline.at(0);
            targetGradientPos = -20;
          } else {
            targetGlow = LineGlowSpline.at(1);
            targetGradientPos = 100;
          }

          line.AnimatorStore.Glow.SetGoal(targetGlow);
          const currentGlow = line.AnimatorStore.Glow.Step(deltaTime);

          if (!Defaults.SimpleLyricsMode) {
            line.HTMLElement.style.setProperty("--gradient-position", `${targetGradientPos}%`);
            setStyleIfChanged(
              line.HTMLElement,
              "--text-shadow-blur-radius",
              `${4 + 8 * currentGlow}px`,
              0.5
            );
            setStyleIfChanged(
              line.HTMLElement,
              "--text-shadow-opacity",
              `${currentGlow * 50}%`,
              1
            );
          }
        }
        // Remove Credits.Active when a line is active
        if (Credits?.classList.contains("Active")) {
          Credits.classList.remove("Active");
        }
      } else if (lineState === "Sung") {
        if (arr.length === index + 1) {
          if (Credits && !Credits.classList.contains("Active")) {
            Credits.classList.add("Active");
          }
        }
      }
      // NotSung lines: class already set by setLineStateClass, no animation needed
    }
  }
  // Commit any queued style changes after completing the animation computations
  flushStyleBatch();
}
