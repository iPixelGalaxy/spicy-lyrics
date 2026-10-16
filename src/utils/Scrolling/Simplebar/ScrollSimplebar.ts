import SimpleBar from "simplebar";
import { PageContainer } from "../../../components/Pages/PageView.ts";

export let ScrollSimplebar: any | null = null;

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

  // The popup's lyrics can be a few hundred px tall over a very long list, where
  // the default 25px thumb is a hard target.
  const scrollbarMinSize = LyricsContainer.closest(".spicy-pip-wrapper") ? 36 : 25;
  ScrollSimplebar = new SimpleBar(LyricsContainer, { autoHide: false, scrollbarMinSize });
}

export function ClearScrollSimplebar() {
  ScrollSimplebar?.unMount();
  ScrollSimplebar = null;
}

export function RecalculateScrollSimplebar() {
  ScrollSimplebar?.recalculate();
}

// SimpleBar puts this class on its root for the whole of a thumb drag.
export function IsScrollbarDragging(): boolean {
  return ScrollSimplebar?.el?.classList.contains("simplebar-dragging") ?? false;
}
