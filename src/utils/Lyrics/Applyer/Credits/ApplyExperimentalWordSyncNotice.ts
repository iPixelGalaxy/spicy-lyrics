export function ApplyExperimentalWordSyncNotice(
  data:
    | {
        experimentalWordSync?: boolean;
        experimentalWordSyncSource?: "Line" | "Static" | string;
      }
    | undefined,
  LyricsContainer: HTMLElement
): void {
  if (!data?.experimentalWordSync || !LyricsContainer) return;

  const songInfoElement = document.createElement("div");
  songInfoElement.classList.add("SongInfo");

  const noticeSpan = document.createElement("span");
  noticeSpan.style.opacity = "0.5";
  noticeSpan.textContent =
    data.experimentalWordSyncSource === "Static"
      ? "These lyrics were automatically converted to word-by-word from static lyrics (Experimental)"
      : data.experimentalWordSyncSource === "Line"
        ? "These lyrics were automatically converted to word-by-word from line sync (Experimental)"
        : "These lyrics were automatically converted to word-by-word (Experimental)";

  songInfoElement.appendChild(noticeSpan);
  LyricsContainer.appendChild(songInfoElement);
}
