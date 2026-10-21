import { RegisterLyricsFooterDetail } from "./CreateLyricsFooter.ts";
import { CreditsRow } from "./CreditsRow.ts";

interface LyricsData {
  SongWriters?: string[];
  Type?: string;
  Content?: any;
  classes?: string;
  styles?: Record<string, string>;
}

/**
 * Marks `container` when the song ends on a duet line sung from the right, so the
 * credits under it can follow it there (the CreditsFollowLastLine page class).
 * Read from the data: the virtualizer may not have the last line mounted.
 */
export function MarkLastLineSide(container: HTMLElement, opposite: boolean, rtl: boolean): void {
  container.classList.toggle("EndsOnOppositeLine", opposite && !rtl);
}

export function ApplyLyricsCredits(data: LyricsData, LyricsContainer: HTMLElement): void {
  if (!data?.SongWriters || !LyricsContainer) return;

  const CreditsElement = document.createElement("div");
  CreditsElement.classList.add("Credits");

  CreditsRow(CreditsElement, "Written by", data.SongWriters.join(", "));
  LyricsContainer.appendChild(CreditsElement);
  RegisterLyricsFooterDetail(CreditsElement, LyricsContainer);
}
