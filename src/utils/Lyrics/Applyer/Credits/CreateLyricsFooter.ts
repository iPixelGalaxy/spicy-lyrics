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
  // Footer placement must follow the page class. CSS uses this same class to
  // reveal and pin the layer, while the persisted experiment store can lag one
  // render behind during page construction.
  const pinFooterEnabled = lyricsContent
    ?.closest<HTMLElement>("#SpicyLyricsPage")
    ?.classList.contains("Exp_PinLyricsFooter");
  if (pinFooterEnabled && pinnedFooterLayer) {
    footer.classList.add("PinnedLyricsFooter");
    pinnedFooterLayer.appendChild(footer);
    return footer;
  }

  lyricsContainer.appendChild(footer);
  return footer;
}
