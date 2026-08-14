export function PlaceLyricsFooter(
  footer: HTMLElement,
  lyricsContainer: HTMLElement,
  lyricsContent: HTMLElement | null | undefined,
  spaceGravityMode = false
): void {
  footer.classList.toggle("SpaceGravityFooter", spaceGravityMode);

  if (spaceGravityMode) {
    footer.classList.remove("PinnedLyricsFooter");
    lyricsContainer.appendChild(footer);
    return;
  }

  const pinnedFooterLayer = lyricsContent?.parentElement?.querySelector<HTMLElement>(
    ".LyricsPinnedFooter"
  );
  // Footer placement must follow page class. CSS uses same class to reveal and
  // pin layer, while persisted experiment store can lag during page construction.
  const pinFooterEnabled = lyricsContent
    ?.closest<HTMLElement>("#SpicyLyricsPage")
    ?.classList.contains("Exp_PinLyricsFooter");
  const pinned = Boolean(pinFooterEnabled && pinnedFooterLayer);
  footer.classList.toggle("PinnedLyricsFooter", pinned);

  if (pinned && pinnedFooterLayer) {
    pinnedFooterLayer.appendChild(footer);
    return;
  }

  lyricsContainer.appendChild(footer);
}

export function CreateLyricsFooter(
  lyricsContainer: HTMLElement,
  lyricsContent: HTMLElement | null | undefined,
  spaceGravityMode = false
): HTMLElement {
  const footer = document.createElement("div");
  footer.classList.add("LyricsFooter");
  PlaceLyricsFooter(footer, lyricsContainer, lyricsContent, spaceGravityMode);
  return footer;
}
