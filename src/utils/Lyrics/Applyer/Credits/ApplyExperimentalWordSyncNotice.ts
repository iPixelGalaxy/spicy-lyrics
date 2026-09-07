import { IsPIP } from "../../../../components/Utils/PopupLyrics.ts";

export function ApplyExperimentalWordSyncNotice(
  data:
    | {
        experimentalWordSync?: boolean;
        experimentalWordSyncSource?: "Line" | "Static" | string;
        experimentalWordSyncReason?: "SpaceGravity" | string;
      }
    | undefined,
  LyricsContainer: HTMLElement
): void {
  if (IsPIP) return;
  if (!data?.experimentalWordSync || !LyricsContainer) return;

  if (data.experimentalWordSyncReason !== "SpaceGravity") return;

  const songInfoElement = document.createElement("div");
  songInfoElement.classList.add("SongInfo");

  const noticeSpan = document.createElement("span");
  noticeSpan.style.opacity = "0.5";
  noticeSpan.textContent =
    data.experimentalWordSyncReason === "SpaceGravity"
      ? "Experimental word sync enabled due to Space Gravity mode"
      : "(+ experimental splitting)";

  songInfoElement.appendChild(noticeSpan);
  LyricsContainer.appendChild(songInfoElement);
}
