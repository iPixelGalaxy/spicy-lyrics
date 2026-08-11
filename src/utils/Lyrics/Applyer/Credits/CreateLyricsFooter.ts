import { isExperimentEnabled } from "../../../experiments.ts";

export function CreateLyricsFooter(
  lyricsContainer: HTMLElement,
  lyricsContent: HTMLElement | null | undefined,
  spaceGravityMode = false
): HTMLElement {
  const footer = document.createElement("div");
  footer.classList.add("LyricsFooter");

  if (spaceGravityMode) {
    footer.classList.add("SpaceGravityFooter");
    lyricsContainer.appendChild(footer);
    return footer;
  }

  const pinnedFooterLayer = lyricsContent?.parentElement?.querySelector<HTMLElement>(
    ".LyricsPinnedFooter"
  );
  if (isExperimentEnabled("pinLyricsFooter") && pinnedFooterLayer) {
    footer.classList.add("PinnedLyricsFooter");
    pinnedFooterLayer.appendChild(footer);
    return footer;
  }

  lyricsContainer.appendChild(footer);
  return footer;
}
