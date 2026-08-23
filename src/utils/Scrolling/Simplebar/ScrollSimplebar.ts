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

  ScrollSimplebar = new SimpleBar(LyricsContainer, { autoHide: false });
}

export function ClearScrollSimplebar() {
  ScrollSimplebar?.unMount();
  ScrollSimplebar = null;
}

export function RecalculateScrollSimplebar() {
  ScrollSimplebar?.recalculate();
}
