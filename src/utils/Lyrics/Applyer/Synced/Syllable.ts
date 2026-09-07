import { $lyricsContainerExists, $minimalLyricsMode, $simpleLyricsMode, $spaceGravityMode } from "../../../../utils/stores.ts";
import { PageContainer } from "../../../../components/Pages/PageView.ts";
import { applyStyles, removeAllStyles } from "../../../CSS/Styles.ts";
import {
  ClearScrollSimplebar,
  MountScrollSimplebar,
  RecalculateScrollSimplebar,
  ScrollSimplebar,
} from "../../../Scrolling/Simplebar/ScrollSimplebar.ts";
import { AdoptReappliedScrollPosition, QueueForceScroll, ScrollToActiveLine } from "../../../Scrolling/ScrollToActiveLine.ts";
import { IdleEmphasisLyricsScale, IdleLyricsScale } from "../../Animator/Shared.ts";
import { ConvertTime } from "../../ConvertTime.ts";
import { ClearLyricsPageContainer } from "../../fetchLyrics.ts";
import isRtl from "../../isRtl.ts";
import {
  ClearLyricsContentArrays,
  CurrentLineLyricsObject,
  LyricsObject,
  SetWordArrayInCurentLine,
  getInterludeTimePadding,
  getLyricsBetweenShow,
  setRomanizedStatus,
} from "../../lyrics.ts";
import { CreateLyricsContainer, DestroyAllLyricsContainers } from "../CreateLyricsContainer.ts";
import {
  destroyLyricsVirtualizer,
  initLyricsVirtualizer,
  releaseLyricsVirtualizerElements,
  type LyricsViewportAnchor,
} from "../../LyricsVirtualizer.ts";
import {
  mountSpaceGravity,
  restoreSpaceGravity,
  tickSpaceGravity,
} from "../../SpaceGravity.ts";
import { ApplyIsByCommunity } from "../Credits/ApplyIsByCommunity.tsx";
import { ApplyLyricsCredits } from "../Credits/ApplyLyricsCredits.ts";
import { ApplyExperimentalWordSyncNotice } from "../Credits/ApplyExperimentalWordSyncNotice.ts";
import { EmitApply, EmitNotApplyed } from "../OnApply.ts";
import Emphasize from "../Utils/Emphasize.ts";
import { StripZeroWidth } from "../Utils/StripZeroWidth.ts";
import { IsLetterCapable } from "../Utils/IsLetterCapable.ts";
import { ApplyLyricsProvider } from "../Credits/ApplyProvider.ts";
import { CreateLyricsFooter, PlaceLyricsFooter } from "../Credits/CreateLyricsFooter.ts";
import Defaults from "../../../../components/Global/Defaults.ts";
import { SpotifyPlayer } from "../../../../components/Global/SpotifyPlayer.ts";

// Define the data structure for syllable lyrics
interface SyllableData {
  Text: string;
  TransliteratedText?: string;
  GibberishText?: string;
  StartTime: number;
  EndTime: number;
  IsPartOfWord?: boolean;
}

interface LeadData {
  StartTime: number;
  EndTime: number;
  Syllables: SyllableData[];
}

interface BackgroundData {
  StartTime: number;
  EndTime: number;
  Syllables: SyllableData[];
}

interface LineData {
  Lead: LeadData;
  Background?: BackgroundData[];
  OppositeAligned?: boolean;
}

interface LyricsData {
  Type: string;
  Content: LineData[];
  StartTime: number;
  SongWriters?: string[];
  source?: string;
  sourceDisplayName?: string;
  fetchProvider?: string;
  userUploaded?: boolean;
  experimentalWordSync?: boolean;
  experimentalWordSyncReason?: "SpaceGravity" | string;
  classes?: string;
  styles?: Record<string, string>;
}

const hasDigit = (text: string) => /\d/.test(text);

function reduceSyllables(syllables: SyllableData[], mode: string): SyllableData[] {
  if (mode === "Default" || !mode) return syllables;

  if (mode === "Merge Words") {
    const result: SyllableData[] = [];
    let i = 0;
    while (i < syllables.length) {
      const current = { ...syllables[i] };
      while (i < syllables.length - 1 && syllables[i].IsPartOfWord) {
        const next = syllables[i + 1];
        if (current.Text.endsWith("-") || next.Text.startsWith("-")) break;
        if (hasDigit(current.Text) || hasDigit(next.Text)) break;
        current.Text += next.Text;
        if (current.TransliteratedText !== undefined || next.TransliteratedText !== undefined) {
          const currentText = current.TransliteratedText ?? current.Text.slice(0, -next.Text.length);
          const nextText = next.TransliteratedText ?? next.Text;
          current.TransliteratedText = currentText + nextText;
        }
        if (current.GibberishText !== undefined || next.GibberishText !== undefined) {
          current.GibberishText = `${current.GibberishText ?? ""}${next.GibberishText ?? ""}`;
        }
        current.EndTime = next.EndTime;
        i++;
      }
      if (!syllables[i].IsPartOfWord) current.IsPartOfWord = false;
      result.push(current);
      i++;
    }
    return result;
  }

  if (mode === "Reduce Splits") {
    const result: SyllableData[] = [];
    let i = 0;
    while (i < syllables.length) {
      const current = { ...syllables[i] };
      const duration = current.EndTime - current.StartTime;
      if (
        duration < 0.2 &&
        i < syllables.length - 1 &&
        current.IsPartOfWord &&
        !current.Text.endsWith("-") &&
        !hasDigit(current.Text) &&
        !hasDigit(syllables[i + 1].Text)
      ) {
        const next = syllables[i + 1];
        current.Text += next.Text;
        if (current.TransliteratedText !== undefined || next.TransliteratedText !== undefined) {
          const currentText = current.TransliteratedText ?? current.Text.slice(0, -next.Text.length);
          const nextText = next.TransliteratedText ?? next.Text;
          current.TransliteratedText = currentText + nextText;
        }
        if (current.GibberishText !== undefined || next.GibberishText !== undefined) {
          current.GibberishText = `${current.GibberishText ?? ""}${next.GibberishText ?? ""}`;
        }
        current.EndTime = next.EndTime;
        current.IsPartOfWord = next.IsPartOfWord;
        i += 2;
      } else {
        i++;
      }
      result.push(current);
    }
    const hasShort = result.some(
      (s, idx) =>
        s.EndTime - s.StartTime < 0.2 &&
        s.IsPartOfWord &&
        !s.Text.endsWith("-") &&
        !hasDigit(s.Text) &&
        idx < result.length - 1 &&
        !hasDigit(result[idx + 1].Text)
    );
    if (hasShort && result.length < syllables.length) return reduceSyllables(result, mode);
    return result;
  }

  return syllables;
}

function getSyllableText(syllable: SyllableData, useRomanized: boolean): string {
  if (Defaults.MemeFormat !== "Off" && syllable.GibberishText !== undefined) {
    return syllable.GibberishText;
  }
  return useRomanized && syllable.TransliteratedText !== undefined
    ? syllable.TransliteratedText
    : syllable.Text;
}

function setSyllableTextVariants(
  element: HTMLElement,
  syllable: SyllableData,
  displayedText: string
): void {
  const isGibberish = Defaults.MemeFormat !== "Off" && syllable.GibberishText !== undefined;
  element.dataset.lyricsOriginalText = isGibberish ? displayedText : syllable.Text;
  element.dataset.lyricsRomanizedText = isGibberish
    ? displayedText
    : syllable.TransliteratedText ?? syllable.Text;

  if (isGibberish) {
    element.dataset.spaceGravityOriginalWordEnd = `${!syllable.IsPartOfWord}`;
  } else {
    delete element.dataset.spaceGravityOriginalWordEnd;
  }
}

function replaceLetterGroupText(word: any, text: string): void {
  const letters = Array.from(text);
  const existingLetters = word.Letters as Array<any> | undefined;

  if (existingLetters?.length === letters.length) {
    existingLetters.forEach((letter, index) => {
      letter.HTMLElement.textContent = letters[index];
    });
    return;
  }

  const totalDuration = word.EndTime - word.StartTime;
  const letterDuration = letters.length > 0 ? totalDuration / letters.length : totalDuration;
  word.HTMLElement.replaceChildren();
  word.Letters = letters.map((letter, index) => {
    const element = document.createElement("span");
    element.textContent = letter;
    element.classList.add("letter", "Emphasis");
    if (index === letters.length - 1) element.classList.add("LastLetterInWord");
    if (!$simpleLyricsMode.get()) element.style.setProperty("--gradient-position", "-20%");
    element.style.setProperty("--text-shadow-opacity", "0%");
    element.style.setProperty("--text-shadow-blur-radius", "4px");
    element.style.scale = IdleEmphasisLyricsScale.toString();
    element.style.transform = "translateY(calc(var(--DefaultLyricsSize) * 0.02))";
    word.HTMLElement.appendChild(element);
    return {
      HTMLElement: element,
      StartTime: word.StartTime + index * letterDuration,
      EndTime: word.StartTime + (index + 1) * letterDuration,
      TotalTime: letterDuration,
      Emphasis: true,
      ...(word.BGWord ? { BGLetter: true } : {}),
    };
  });
}

export function UpdateSyllableLyricsRomanization(useRomanized: boolean): void {
  const gravitySession = syllableRenderSession?.SpaceGravity ? syllableRenderSession : null;
  if (gravitySession) restoreSpaceGravity();

  for (const line of LyricsObject.Types.Syllable.Lines) {
    for (const word of line.Syllables?.Lead ?? []) {
      if (word.Dot) continue;
      const text = useRomanized
        ? word.HTMLElement.dataset.lyricsRomanizedText
        : word.HTMLElement.dataset.lyricsOriginalText;
      if (text === undefined) continue;

      const displayText = StripZeroWidth(text);
      if (word.LetterGroup) replaceLetterGroupText(word, displayText);
      else word.HTMLElement.textContent = displayText;
    }
  }

  if (gravitySession) {
    mountSpaceGravity(
      gravitySession.VirtualContainer,
      gravitySession.Lines,
      gravitySession.Container,
      gravitySession.Footer
    );
    tickSpaceGravity(SpotifyPlayer.GetPosition());
  }
}

function shouldJoinSyllableToNext(syllable: SyllableData, isLastInLine: boolean): boolean {
  if (syllable.IsPartOfWord) return true;
  return (
    Defaults.MemeFormat === "Gibberish" &&
    syllable.GibberishText !== undefined &&
    !isLastInLine
  );
}

type SyllableRenderSession = {
  Host: HTMLElement;
  Container: HTMLElement;
  VirtualContainer: HTMLElement;
  Lines: typeof LyricsObject.Types.Syllable.Lines;
  LineElements: HTMLElement[];
  Footer: HTMLElement;
  SpaceGravity: boolean;
};

let syllableRenderSession: SyllableRenderSession | null = null;

export function ClearSyllableRenderSession(): void {
  syllableRenderSession = null;
}

/** Switch layouts without rebuilding words, letters, credits, or lyric data. */
export function UpdateRenderedSpaceGravity(enabled: boolean): boolean {
  const session = syllableRenderSession;
  if (!session || !session.Container.isConnected || session.SpaceGravity === enabled) return false;

  if (enabled) {
    PageContainer?.classList.add("SpaceGravityMode");
    const released = releaseLyricsVirtualizerElements();
    destroyLyricsVirtualizer();
    if (released.length > 0) session.LineElements = released;
    ClearScrollSimplebar();
    // SimpleBar keeps an internal wrapper/mask/content tree. Gravity's stage
    // is sized against the real LyricsContent host, exactly like first render;
    // leaving it in that shell defers a usable size until the page is hidden.
    session.Host.replaceChildren(session.Container);
    session.VirtualContainer.style.removeProperty("height");
    PlaceLyricsFooter(session.Footer, session.Container, session.Host, true);
    session.Container.classList.add("SpaceGravityStage");
    mountSpaceGravity(session.VirtualContainer, session.Lines, session.Container, session.Footer);
    tickSpaceGravity(SpotifyPlayer.GetPosition());
  } else {
    const restoredLines = restoreSpaceGravity();
    session.Lines = restoredLines as typeof LyricsObject.Types.Syllable.Lines;
    session.LineElements = restoredLines.map((line) => line.HTMLElement);
    session.Container.classList.remove("SpaceGravityStage");
    session.VirtualContainer.replaceChildren();
    PageContainer?.classList.remove("SpaceGravityMode");
    // Fresh normal mode owns a fresh SimpleBar tree. This also fixes pages
    // opened in gravity mode, where no scroll instance exists yet.
    session.Host.replaceChildren(session.Container);
    PlaceLyricsFooter(session.Footer, session.Container, session.Host);
    MountScrollSimplebar();
    const scrollEl = ScrollSimplebar?.getScrollElement() as HTMLElement | undefined;
    if (scrollEl) initLyricsVirtualizer(scrollEl, session.VirtualContainer, session.LineElements);
    QueueForceScroll();
    // The normal playback tick may not arrive for a while. Let the new
    // virtualizer mount first, then consume the queued correction so its
    // visibility check cannot briefly show an incorrect "go to active" button.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!session.SpaceGravity && ScrollSimplebar) ScrollToActiveLine(ScrollSimplebar);
    }));
  }

  session.SpaceGravity = enabled;
  return true;
}

export function ApplySyllableLyrics(
  data: LyricsData,
  UseRomanized: boolean = false,
  viewportAnchor: LyricsViewportAnchor | null = null
): void {
  if (!$lyricsContainerExists.get()) return;
  EmitNotApplyed();

  DestroyAllLyricsContainers();
  ClearSyllableRenderSession();
  const LyricsContainerParent = PageContainer?.querySelector<HTMLElement>(
    ".LyricsContainer .LyricsContent"
  );
  const LyricsContainerInstance = CreateLyricsContainer(viewportAnchor !== null);
  const LyricsContainer = LyricsContainerInstance.Container;

  // Check if LyricsContainer exists
  if (!LyricsContainer) {
    console.error("LyricsContainer not found");
    return;
  }

  const hasOppositeAligned = data.Content.some(item => item.OppositeAligned === true);
  LyricsContainer.classList.toggle("HasDuetLines", hasOppositeAligned);
  const hasRtlLines = data.Content.some(line =>
    line.Lead.Syllables.some(syllable => isRtl(syllable.Text)) ||
    line.Background?.some(bg => bg.Syllables.some(syllable => isRtl(syllable.Text))) === true
  );
  LyricsContainer.classList.toggle("HasRtlLines", hasRtlLines);

  LyricsContainer.setAttribute("data-lyrics-type", "Syllable");

  ClearLyricsContentArrays();
  ClearScrollSimplebar();

  ClearLyricsPageContainer();

  const virtualContainer = document.createElement("div");
  virtualContainer.classList.add("VirtualLyricsContainer");
  LyricsContainer.appendChild(virtualContainer);

  const lineElements: HTMLElement[] = [];
  const spaceGravityMode = $spaceGravityMode.get();
  const syllableMode = "Default";
  const allowLetterEmphasis = !data.experimentalWordSync;
  const firstVocalStartTime = Math.min(
    data.Content[0].Lead.StartTime,
    ...(data.Content[0].Background?.map((background) => background.StartTime) ?? [])
  );

  if (firstVocalStartTime >= getLyricsBetweenShow()) {
    const musicalLine = document.createElement("div");
    musicalLine.classList.add("line");
    musicalLine.classList.add("musical-line");
    LyricsObject.Types.Syllable.Lines.push({
      HTMLElement: musicalLine,
      StartTime: 0,
      EndTime: ConvertTime(firstVocalStartTime),
      TotalTime: ConvertTime(firstVocalStartTime),
      DotLine: true,
    });

    SetWordArrayInCurentLine();

    if (data.Content[0].OppositeAligned) {
      musicalLine.classList.add("OppositeAligned");
    }

    const dotGroup = document.createElement("div");
    dotGroup.classList.add("dotGroup");

    const musicalDots1 = document.createElement("span");
    const musicalDots2 = document.createElement("span");
    const musicalDots3 = document.createElement("span");

    const totalTime = ConvertTime(firstVocalStartTime);
    const baseDotTime = totalTime / 3;
    const dotPadding = getInterludeTimePadding() / 3;
    const dot1EndTime = Math.max(0, baseDotTime + dotPadding);
    const dot2EndTime = Math.max(dot1EndTime, baseDotTime * 2 + dotPadding * 2);
    const dot3EndTime = Math.max(dot2EndTime, totalTime + getInterludeTimePadding());

    musicalDots1.classList.add("word");
    musicalDots1.classList.add("dot");
    musicalDots1.textContent = "•";

    // Check if Syllables.Lead exists
    if (LyricsObject.Types.Syllable.Lines[CurrentLineLyricsObject]?.Syllables?.Lead) {
      LyricsObject.Types.Syllable.Lines[CurrentLineLyricsObject].Syllables?.Lead.push({
        HTMLElement: musicalDots1,
        StartTime: 0,
        EndTime: dot1EndTime,
        TotalTime: dot1EndTime,
        Dot: true,
      });
    } else {
      console.warn("Syllables.Lead is undefined for CurrentLineLyricsObject");
    }

    musicalDots2.classList.add("word");
    musicalDots2.classList.add("dot");
    musicalDots2.textContent = "•";

    // Check if Syllables.Lead exists
    if (LyricsObject.Types.Syllable.Lines[CurrentLineLyricsObject]?.Syllables?.Lead) {
      LyricsObject.Types.Syllable.Lines[CurrentLineLyricsObject].Syllables?.Lead.push({
        HTMLElement: musicalDots2,
        StartTime: dot1EndTime,
        EndTime: dot2EndTime,
        TotalTime: dot2EndTime - dot1EndTime,
        Dot: true,
      });
    } else {
      console.warn("Syllables.Lead is undefined for CurrentLineLyricsObject");
    }

    musicalDots3.classList.add("word");
    musicalDots3.classList.add("dot");
    musicalDots3.textContent = "•";

    // Check if Syllables.Lead exists
    if (LyricsObject.Types.Syllable.Lines[CurrentLineLyricsObject]?.Syllables?.Lead) {
      LyricsObject.Types.Syllable.Lines[CurrentLineLyricsObject].Syllables?.Lead.push({
        HTMLElement: musicalDots3,
        StartTime: dot2EndTime,
        EndTime: dot3EndTime,
        TotalTime: dot3EndTime - dot2EndTime,
        Dot: true,
      });
    } else {
      console.warn("Syllables.Lead is undefined for CurrentLineLyricsObject");
    }

    dotGroup.appendChild(musicalDots1);
    dotGroup.appendChild(musicalDots2);
    dotGroup.appendChild(musicalDots3);

    musicalLine.appendChild(dotGroup);
    lineElements.push(musicalLine);
  }
  data.Content.forEach((line, index, arr) => {
    const lineElem = document.createElement("div");
    lineElem.classList.add("line");

    const processedLeadSyllables = reduceSyllables(line.Lead.Syllables, syllableMode);
    const primaryLineEndTime = line.Background?.length && processedLeadSyllables.length
      ? Math.max(...processedLeadSyllables.map((syllable) => syllable.EndTime))
      : line.Lead.EndTime;
    const nextLineStartTime = arr[index + 1]?.Lead.StartTime ?? 0;

    const lineEndTimeAndNextLineStartTimeDistance =
      nextLineStartTime !== 0 ? nextLineStartTime - primaryLineEndTime : 0;

    const lineEndTime =
      line.Background?.length
        ? primaryLineEndTime
        : $minimalLyricsMode.get()
        ? nextLineStartTime === 0
          ? primaryLineEndTime
          : lineEndTimeAndNextLineStartTimeDistance < getLyricsBetweenShow() &&
              nextLineStartTime > primaryLineEndTime
            ? nextLineStartTime
            : primaryLineEndTime
        : primaryLineEndTime;

    LyricsObject.Types.Syllable.Lines.push({
      HTMLElement: lineElem,
      StartTime: ConvertTime(line.Lead.StartTime),
      EndTime: ConvertTime(lineEndTime),
      TotalTime: ConvertTime(lineEndTime) - ConvertTime(line.Lead.StartTime),
    });

    SetWordArrayInCurentLine();

    if (line.OppositeAligned) {
      lineElem.classList.add("OppositeAligned");
    }

    lineElements.push(lineElem);

    let currentWordGroup: HTMLSpanElement | null = null;

    processedLeadSyllables.forEach((lead, iL, aL) => {
      let word = document.createElement("span");
      const isLastInLine = iL === aL.length - 1;
      const shouldJoinToNext = shouldJoinSyllableToNext(lead, isLastInLine);

      if (isRtl(lead.Text) && !lineElem.classList.contains("rtl")) {
        lineElem.classList.add("rtl");
      }

      const totalDuration = ConvertTime(lead.EndTime) - ConvertTime(lead.StartTime);

      const leadText = StripZeroWidth(getSyllableText(lead, UseRomanized));
      const letterLength = leadText.split("").length;

      const IfLetterCapable = allowLetterEmphasis && IsLetterCapable(letterLength, totalDuration) && !isRtl(leadText);

      if (IfLetterCapable) {
        word = document.createElement("div");
        const letters = leadText.split(""); // Split word into individual letters

        Emphasize(letters, word, lead);

        if (isLastInLine) {
          word.classList.add("LastWordInLine");
        } else if (shouldJoinToNext) {
          word.classList.add("PartOfWord");
        }

        if (!$simpleLyricsMode.get()) {
          word.style.setProperty("--text-shadow-opacity", `0%`);
          word.style.setProperty("--text-shadow-blur-radius", `4px`);
          word.style.scale = IdleEmphasisLyricsScale.toString();
          word.style.transform = `translateY(calc(var(--DefaultLyricsSize) * 0.02))`;
        }
      } else {
        word.textContent = leadText;

        if (!$simpleLyricsMode.get()) {
          word.style.setProperty("--gradient-position", `-20%`);
          word.style.setProperty("--text-shadow-opacity", `0%`);
          word.style.setProperty("--text-shadow-blur-radius", `4px`);
          word.style.scale = IdleLyricsScale.toString();
          word.style.transform = `translateY(calc(var(--DefaultLyricsSize) * 0.01))`;
        }

        word.classList.add("word");

        if (isLastInLine) {
          word.classList.add("LastWordInLine");
        } else if (shouldJoinToNext) {
          word.classList.add("PartOfWord");
        }

        if (LyricsObject.Types.Syllable.Lines[CurrentLineLyricsObject]?.Syllables?.Lead) {
          LyricsObject.Types.Syllable.Lines[CurrentLineLyricsObject].Syllables?.Lead.push({
            HTMLElement: word,
            StartTime: ConvertTime(lead.StartTime),
            EndTime: ConvertTime(lead.EndTime),
            TotalTime: totalDuration,
          });
        } else {
          console.warn("Syllables.Lead is undefined for CurrentLineLyricsObject");
        }
      }

      setSyllableTextVariants(word, lead, leadText);

      const prev = aL[iL - 1];
      const prevShouldJoinToNext = prev ? shouldJoinSyllableToNext(prev, false) : false;

      if (shouldJoinToNext || (prevShouldJoinToNext && currentWordGroup)) {
        if (!currentWordGroup) {
          const group = document.createElement("span");
          group.classList.add("word-group");
          lineElem.appendChild(group);
          currentWordGroup = group;
        }

        currentWordGroup.appendChild(word);

        if (!shouldJoinToNext && prevShouldJoinToNext) {
          currentWordGroup = null;
        }
      } else {
        currentWordGroup = null;
        lineElem.appendChild(word);
      }
    });

    const parentLineIndex = LyricsObject.Types.Syllable.Lines.length - 1;
    if (line.Background) {
      line.Background.forEach((bg) => {
        const lineE = document.createElement("div");
        lineE.classList.add("line", "bg-line");

        LyricsObject.Types.Syllable.Lines.push({
          HTMLElement: lineE,
          StartTime: ConvertTime(bg.StartTime),
          EndTime: ConvertTime(bg.EndTime),
          TotalTime: ConvertTime(bg.EndTime) - ConvertTime(bg.StartTime),
          BGLine: true,
          SpaceGravityParentLineIndex: parentLineIndex,
          ActivationStartTime: ConvertTime(line.Lead.StartTime),
          ActivationEndTime: ConvertTime(line.Lead.EndTime),
        });
        SetWordArrayInCurentLine();

        if (line.OppositeAligned) {
          lineE.classList.add("OppositeAligned");
        }
        lineElements.push(lineE);

        let currentBGWordGroup: HTMLSpanElement | null = null;

        const processedBGSyllables = reduceSyllables(bg.Syllables, syllableMode);
        processedBGSyllables.forEach((bw, bI, bA) => {
          let bwE = document.createElement("span");
          const isLastInLine = bI === bA.length - 1;
          const shouldJoinToNext = shouldJoinSyllableToNext(bw, isLastInLine);

          if (isRtl(bw.Text) && !lineE.classList.contains("rtl")) {
            lineE.classList.add("rtl");
          }

          const totalDuration = ConvertTime(bw.EndTime) - ConvertTime(bw.StartTime);

            const bwText = StripZeroWidth(getSyllableText(bw, UseRomanized));
            const letterLength = bwText.split("").length;

          const IfLetterCapable = allowLetterEmphasis && IsLetterCapable(letterLength, totalDuration) && !isRtl(bwText);

          if (IfLetterCapable) {
            bwE = document.createElement("div");
            const letters = bwText.split(""); // Split word into individual letters

            Emphasize(letters, bwE, bw, true);

            if (isLastInLine) {
              bwE.classList.add("LastWordInLine");
            } else if (shouldJoinToNext) {
              bwE.classList.add("PartOfWord");
            }

            if (!$simpleLyricsMode.get()) {
              bwE.style.setProperty("--text-shadow-opacity", `0%`);
              bwE.style.setProperty("--text-shadow-blur-radius", `4px`);
              bwE.style.scale = IdleEmphasisLyricsScale.toString();
              bwE.style.transform = `translateY(calc(var(--font-size) * 0.02))`;
            }
          } else {
            bwE.textContent = bwText;

            if (!$simpleLyricsMode.get()) {
              bwE.style.setProperty("--gradient-position", `0%`);
              bwE.style.setProperty("--text-shadow-opacity", `0%`);
              bwE.style.setProperty("--text-shadow-blur-radius", `4px`);
              bwE.style.scale = IdleLyricsScale.toString();
              bwE.style.transform = `translateY(calc(var(--font-size) * 0.01))`;
            }

            // Check if Syllables.Lead exists
            if (LyricsObject.Types.Syllable.Lines[CurrentLineLyricsObject]?.Syllables?.Lead) {
              LyricsObject.Types.Syllable.Lines[CurrentLineLyricsObject].Syllables?.Lead.push({
                HTMLElement: bwE,
                StartTime: ConvertTime(bw.StartTime),
                EndTime: ConvertTime(bw.EndTime),
                TotalTime: ConvertTime(bw.EndTime) - ConvertTime(bw.StartTime),
                BGWord: true,
              });
            } else {
              console.warn("Syllables.Lead is undefined for CurrentLineLyricsObject");
            }

            bwE.classList.add("bg-word");
            bwE.classList.add("word");

            if (isLastInLine) {
              bwE.classList.add("LastWordInLine");
            } else if (shouldJoinToNext) {
              bwE.classList.add("PartOfWord");
            }
          }

          setSyllableTextVariants(bwE, bw, bwText);

          const prevBG = bA[bI - 1];
          const prevShouldJoinToNext = prevBG ? shouldJoinSyllableToNext(prevBG, false) : false;

          if (shouldJoinToNext || (prevShouldJoinToNext && currentBGWordGroup)) {
            if (!currentBGWordGroup) {
              const group = document.createElement("span");
              group.classList.add("word-group");
              lineE.appendChild(group);
              currentBGWordGroup = group;
            }

            currentBGWordGroup.appendChild(bwE);

            if (!shouldJoinToNext && prevShouldJoinToNext) {
              currentBGWordGroup = null;
            }
          } else {
            currentBGWordGroup = null;
            lineE.appendChild(bwE);
          }
        });
      });
    }
    const lastVocalEndTime = Math.max(
      line.Lead.EndTime,
      ...(line.Background?.map((background) => background.EndTime) ?? [])
    );
    const nextLine = arr[index + 1];
    const nextVocalStart = nextLine
      ? Math.min(
          nextLine.Lead.StartTime,
          ...(nextLine.Background?.map((background) => background.StartTime) ?? [])
        )
      : undefined;
    if (nextLine && nextVocalStart! - lastVocalEndTime >= getLyricsBetweenShow()) {
      const musicalLine = document.createElement("div");
      musicalLine.classList.add("line");
      musicalLine.classList.add("musical-line");

      LyricsObject.Types.Syllable.Lines.push({
        HTMLElement: musicalLine,
        StartTime: ConvertTime(lastVocalEndTime),
        EndTime: ConvertTime(nextVocalStart!),
        TotalTime:
          ConvertTime(nextVocalStart!) -
          ConvertTime(lastVocalEndTime),
        DotLine: true,
      });

      SetWordArrayInCurentLine();

      if (nextLine.OppositeAligned) {
        musicalLine.classList.add("OppositeAligned");
      }

      const dotGroup = document.createElement("div");
      dotGroup.classList.add("dotGroup");

      const musicalDots1 = document.createElement("span");
      const musicalDots2 = document.createElement("span");
      const musicalDots3 = document.createElement("span");

      const gapStartTime = ConvertTime(lastVocalEndTime);
      const totalTime = ConvertTime(nextVocalStart!) - gapStartTime;
      const baseDotTime = totalTime / 3;
      const dotPadding = getInterludeTimePadding() / 3;
      const dot1EndTime = Math.max(gapStartTime, gapStartTime + baseDotTime + dotPadding);
      const dot2EndTime = Math.max(dot1EndTime, gapStartTime + baseDotTime * 2 + dotPadding * 2);
      const dot3EndTime = Math.max(dot2EndTime, gapStartTime + totalTime + getInterludeTimePadding());

      musicalDots1.classList.add("word");
      musicalDots1.classList.add("dot");
      musicalDots1.textContent = "•";

      // Check if Syllables.Lead exists
      if (LyricsObject.Types.Syllable.Lines[CurrentLineLyricsObject]?.Syllables?.Lead) {
        LyricsObject.Types.Syllable.Lines[CurrentLineLyricsObject].Syllables?.Lead.push({
          HTMLElement: musicalDots1,
          StartTime: gapStartTime,
          EndTime: dot1EndTime,
          TotalTime: dot1EndTime - gapStartTime,
          Dot: true,
        });
      } else {
        console.warn("Syllables.Lead is undefined for CurrentLineLyricsObject");
      }

      musicalDots2.classList.add("word");
      musicalDots2.classList.add("dot");
      musicalDots2.textContent = "•";

      // Check if Syllables.Lead exists
      if (LyricsObject.Types.Syllable.Lines[CurrentLineLyricsObject]?.Syllables?.Lead) {
        LyricsObject.Types.Syllable.Lines[CurrentLineLyricsObject].Syllables?.Lead.push({
          HTMLElement: musicalDots2,
          StartTime: dot1EndTime,
          EndTime: dot2EndTime,
          TotalTime: dot2EndTime - dot1EndTime,
          Dot: true,
        });
      } else {
        console.warn("Syllables.Lead is undefined for CurrentLineLyricsObject");
      }

      musicalDots3.classList.add("word");
      musicalDots3.classList.add("dot");
      musicalDots3.textContent = "•";

      // Check if Syllables.Lead exists
      if (LyricsObject.Types.Syllable.Lines[CurrentLineLyricsObject]?.Syllables?.Lead) {
        LyricsObject.Types.Syllable.Lines[CurrentLineLyricsObject].Syllables?.Lead.push({
          HTMLElement: musicalDots3,
          StartTime: dot2EndTime,
          EndTime: dot3EndTime,
          TotalTime: dot3EndTime - dot2EndTime,
          Dot: true,
        });
      } else {
        console.warn("Syllables.Lead is undefined for CurrentLineLyricsObject");
      }

      dotGroup.appendChild(musicalDots1);
      dotGroup.appendChild(musicalDots2);
      dotGroup.appendChild(musicalDots3);

      musicalLine.appendChild(dotGroup);
      lineElements.push(musicalLine);
    }
  });

  const footer = CreateLyricsFooter(LyricsContainer, LyricsContainerParent, spaceGravityMode);

  ApplyLyricsCredits(data, footer);
  ApplyLyricsProvider(data, footer);
  ApplyExperimentalWordSyncNotice(data, footer);
  ApplyIsByCommunity(data, footer);

  if (LyricsContainerParent) {
    LyricsContainerInstance.Append(LyricsContainerParent);
  }

  if (spaceGravityMode) LyricsContainer.classList.add("SpaceGravityStage");

  const LyricsStylingContainer = spaceGravityMode
    ? LyricsContainer
    : PageContainer?.querySelector<HTMLElement>(
        ".LyricsContainer .LyricsContent .simplebar-content"
      );

  // Check if LyricsStylingContainer exists
  if (LyricsStylingContainer) {
    removeAllStyles(LyricsStylingContainer);

    if (data.classes && !spaceGravityMode) {
      LyricsStylingContainer.className = data.classes;
    } else if (data.classes) {
      LyricsStylingContainer.classList.add(...data.classes.split(/\s+/).filter(Boolean));
    }

    if (data.styles) {
      applyStyles(LyricsStylingContainer, data.styles);
    }
  } else {
    console.warn("LyricsStylingContainer not found");
  }

  if (spaceGravityMode) {
    mountSpaceGravity(
      virtualContainer,
      LyricsObject.Types.Syllable.Lines,
      LyricsContainer,
      footer
    );
  } else {
    if (ScrollSimplebar) RecalculateScrollSimplebar();
    else MountScrollSimplebar();

    const scrollEl = ScrollSimplebar?.getScrollElement() as HTMLElement | undefined;
    if (scrollEl) initLyricsVirtualizer(scrollEl, virtualContainer, lineElements, viewportAnchor);
  }

  syllableRenderSession = {
    Host: LyricsContainerParent!,
    Container: LyricsContainer,
    VirtualContainer: virtualContainer,
    Lines: LyricsObject.Types.Syllable.Lines,
    LineElements: lineElements,
    Footer: footer,
    SpaceGravity: spaceGravityMode,
  };

  EmitApply(data.Type, data.Content);

  if (viewportAnchor) AdoptReappliedScrollPosition();

  setRomanizedStatus(UseRomanized);
}
