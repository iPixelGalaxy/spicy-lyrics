import { $lyricsContainerExists } from "../../../utils/stores.ts";
import { PageContainer } from "../../../components/Pages/PageView.ts";
import { type StyleProperties, applyStyles, removeAllStyles } from "../../CSS/Styles.ts";
import {
  ClearScrollSimplebar,
  MountScrollSimplebar,
  RecalculateScrollSimplebar,
  ScrollSimplebar,
} from "../../Scrolling/Simplebar/ScrollSimplebar.ts";
import { ClearLyricsPageContainer } from "../fetchLyrics.ts";
import isRtl from "../isRtl.ts";
import {
  ClearLyricsContentArrays,
  LyricsObject,
  type LyricsStatic,
  setRomanizedStatus,
} from "../lyrics.ts";
import { CreateLyricsContainer, DestroyAllLyricsContainers } from "./CreateLyricsContainer.ts";
import { initLyricsVirtualizer, type LyricsViewportAnchor } from "../LyricsVirtualizer.ts";
import { StripZeroWidth } from "./Utils/StripZeroWidth.ts";
import { ApplyIsByCommunity } from "./Credits/ApplyIsByCommunity.tsx";
import { ApplyLyricsCredits } from "./Credits/ApplyLyricsCredits.ts";
import { ApplyExperimentalWordSyncNotice } from "./Credits/ApplyExperimentalWordSyncNotice.ts";
import { EmitApply, EmitNotApplyed } from "./OnApply.ts";
import { ApplyLyricsProvider } from "./Credits/ApplyProvider.ts";
import { CreateLyricsFooter } from "./Credits/CreateLyricsFooter.ts";
import Defaults from "../../../components/Global/Defaults.ts";

/**
 * Interface for static lyrics data
 */
export interface StaticLyricsData {
  Type: string;
  Lines: Array<{
    Text: string;
    TransliteratedText?: string;
    GibberishText?: string;
  }>;
  offline?: boolean;
  classes?: string;
  styles?: StyleProperties;
  source?: string;
  sourceDisplayName?: string;
  fetchProvider?: string;
  experimentalWordSync?: boolean;
  experimentalWordSyncSource?: "Line" | "Static" | string;
}

function getDisplayText(
  line: StaticLyricsData["Lines"][number],
  useRomanized: boolean
): string {
  if (Defaults.MemeFormat !== "Off" && line.GibberishText !== undefined) {
    return line.GibberishText;
  }
  return useRomanized && line.TransliteratedText !== undefined
    ? line.TransliteratedText
    : line.Text;
}

export function UpdateStaticLyricsRomanization(useRomanized: boolean): void {
  for (const line of LyricsObject.Types.Static.Lines) {
    const element = line.HTMLElement;
    const text = useRomanized
      ? element.dataset.lyricsRomanizedText
      : element.dataset.lyricsOriginalText;
    if (text !== undefined) element.textContent = StripZeroWidth(text);
  }
}

/**
 * Apply static lyrics to the lyrics container
 * @param data - Static lyrics data
 */
export function ApplyStaticLyrics(
  data: StaticLyricsData,
  UseRomanized: boolean = false,
  viewportAnchor: LyricsViewportAnchor | null = null
): void {
  if (!$lyricsContainerExists.get()) return;

  EmitNotApplyed();

  DestroyAllLyricsContainers();

  const LyricsContainerParent = PageContainer?.querySelector<HTMLElement>(
    ".LyricsContainer .LyricsContent"
  );
  const LyricsContainerInstance = CreateLyricsContainer(viewportAnchor !== null);
  const LyricsContainer = LyricsContainerInstance.Container;

  if (!LyricsContainer) {
    console.error("Cannot apply static lyrics: LyricsContainer not found");
    return;
  }

  LyricsContainer.classList.remove("HasDuetLines");
  const hasRtlLines = data.Lines.some(line => isRtl(line.Text));
  LyricsContainer.classList.toggle("HasRtlLines", hasRtlLines);

  LyricsContainer.setAttribute("data-lyrics-type", "Static");

  ClearLyricsContentArrays();
  ClearScrollSimplebar();
  ClearLyricsPageContainer();

  const virtualContainer = document.createElement("div");
  virtualContainer.classList.add("VirtualLyricsContainer");
  LyricsContainer.appendChild(virtualContainer);

  const lineElements: HTMLElement[] = [];

  data.Lines.forEach((line) => {
    const lineElem = document.createElement("div");

    lineElem.textContent = StripZeroWidth(getDisplayText(line, UseRomanized));
    lineElem.dataset.lyricsOriginalText = getDisplayText(line, false);
    lineElem.dataset.lyricsRomanizedText = getDisplayText(line, true);

    if (isRtl(line.Text) && !lineElem.classList.contains("rtl")) {
      lineElem.classList.add("rtl");
    }

    lineElem.classList.add("line");
    lineElem.classList.add("static");

    // Add the line element to the lyrics object
    const staticLine: LyricsStatic = {
      HTMLElement: lineElem,
    };

    LyricsObject.Types.Static.Lines.push(staticLine);
    lineElements.push(lineElem);
  });

  const footer = CreateLyricsFooter(LyricsContainer, LyricsContainerParent);
  ApplyLyricsCredits(data, footer);
  ApplyLyricsProvider(data, footer);
  ApplyExperimentalWordSyncNotice(data, footer);
  ApplyIsByCommunity(data, footer);
  if (LyricsContainerParent) {
    LyricsContainerInstance.Append(LyricsContainerParent);
  }

  // Handle scrollbar
  if (ScrollSimplebar) {
    RecalculateScrollSimplebar();
  } else {
    MountScrollSimplebar();
  }

  const scrollEl = ScrollSimplebar?.getScrollElement() as HTMLElement | undefined;
  if (scrollEl) initLyricsVirtualizer(scrollEl, virtualContainer, lineElements, viewportAnchor);

  // Apply styling to the content container
  const LyricsStylingContainer = PageContainer?.querySelector<HTMLElement>(
    ".LyricsContainer .LyricsContent .simplebar-content"
  );

  if (LyricsStylingContainer) {
    if (data.offline) {
      LyricsStylingContainer.classList.add("offline");
    }

    removeAllStyles(LyricsStylingContainer);

    if (data.classes) {
      LyricsStylingContainer.className = data.classes;
    }

    if (data.styles) {
      applyStyles(LyricsStylingContainer, data.styles);
    }
  }

  EmitApply(data.Type, data.Lines);

  setRomanizedStatus(UseRomanized);
}
