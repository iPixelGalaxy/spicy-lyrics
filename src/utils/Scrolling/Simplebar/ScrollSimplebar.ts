import SimpleBar from "npm:simplebar";
import { IntervalManager } from "../../IntervalManager.ts";
import {
  IsMouseInLyricsPage,
  LyricsPageMouseEnter,
  LyricsPageMouseLeave,
  SetIsMouseInLyricsPage,
} from "../Page/IsHovering.ts";
import { PageContainer } from "../../../components/Pages/PageView.ts";

export let ScrollSimplebar: any | null = null;

const ElementEventQuery = ".ContentBox .LyricsContainer";

export function MountScrollSimplebar() {
  if (!PageContainer) {
    console.warn("Cannot mount ScrollSimplebar: PageContainer not found");
    return;
  }
  const LyricsContainer = PageContainer.querySelector<HTMLElement>(
    ".LyricsContainer .LyricsContent"
  );

  if (!LyricsContainer) {
    console.warn("Cannot mount ScrollSimplebar: LyricsContainer not found");
    return;
  }

  // @ts-expect-error abc
  ScrollSimplebar = new SimpleBar(LyricsContainer, { autoHide: false });

  PageContainer
    .querySelector<HTMLElement>(ElementEventQuery)
    ?.addEventListener("mouseenter", LyricsPageMouseEnter);
  PageContainer
    .querySelector<HTMLElement>(ElementEventQuery)
    ?.addEventListener("mouseleave", LyricsPageMouseLeave);
}

export function ClearScrollSimplebar() {
  ScrollSimplebar?.unMount();
  ScrollSimplebar = null;
  SetIsMouseInLyricsPage(false);
  if (PageContainer) {
    PageContainer
      .querySelector<HTMLElement>(ElementEventQuery)
      ?.removeEventListener("mouseenter", LyricsPageMouseEnter);
    PageContainer
      .querySelector<HTMLElement>(ElementEventQuery)
      ?.removeEventListener("mouseleave", LyricsPageMouseLeave);
  }
}

export function RecalculateScrollSimplebar() {
  ScrollSimplebar?.recalculate();
}

/**
 * Lock the scroll height by setting a minimum height on the content wrapper.
 * This prevents layout recalculation during playback.
 * Call after all lyrics lines are appended to the DOM.
 */
export function lockScrollHeight() {
  if (!ScrollSimplebar) return;
  const scrollEl = ScrollSimplebar.getScrollElement();
  if (!scrollEl) return;
  const contentWrapper = scrollEl.querySelector(".simplebar-content");
  if (!contentWrapper) return;
  // Set min-height to current scroll height to prevent layout shifts
  (contentWrapper as HTMLElement).style.minHeight = `${contentWrapper.scrollHeight}px`;
}

/**
 * Unlock the scroll height (call on song change, resize, etc.).
 */
export function unlockScrollHeight() {
  if (!ScrollSimplebar) return;
  const scrollEl = ScrollSimplebar.getScrollElement();
  if (!scrollEl) return;
  const contentWrapper = scrollEl.querySelector(".simplebar-content");
  if (!contentWrapper) return;
  (contentWrapper as HTMLElement).style.minHeight = "";
}

new IntervalManager(Infinity, () => {
  if (!PageContainer) return;
  const LyricsContainer = PageContainer.querySelector<HTMLElement>(
    ".LyricsContainer .LyricsContent"
  );
  if (!LyricsContainer || !ScrollSimplebar) return;
  if (IsMouseInLyricsPage) {
    LyricsContainer.classList.remove("hide-scrollbar");
  } else {
    if (ScrollSimplebar.isDragging) {
      LyricsContainer.classList.remove("hide-scrollbar");
    } else {
      LyricsContainer.classList.add("hide-scrollbar");
    }
  }
}).Start();
