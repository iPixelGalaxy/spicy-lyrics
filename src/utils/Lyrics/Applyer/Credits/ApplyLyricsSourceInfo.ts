import { resolveLyricsSourceLabel } from "../../LyricsSourcePreferences.ts";

type LyricsData = {
  source?: string;
  sourceDisplayName?: string;
  fetchProvider?: string;
};

export function ApplyLyricsSourceInfo(
  data: LyricsData | undefined,
  LyricsContainer: HTMLElement
): void {
  if (!data || !LyricsContainer) return;
  if (data.source === "spl") return;

  const sourceLabel = resolveLyricsSourceLabel(
    data.source,
    data.sourceDisplayName,
    data.fetchProvider
  );

  if (!sourceLabel) return;

  const songInfoElement = document.createElement("div");
  songInfoElement.classList.add("SongInfo");

  const sourceSpan = document.createElement("span");
  sourceSpan.style.opacity = "0.5";
  sourceSpan.textContent = `These lyrics were provided by ${sourceLabel}`;

  songInfoElement.appendChild(sourceSpan);
  LyricsContainer.appendChild(songInfoElement);
}
