export function PlaceLyricsFooter(
  footer: HTMLElement,
  lyricsContainer: HTMLElement,
  lyricsContent: HTMLElement | null | undefined,
  spaceGravityMode = false
): void {
  footer.classList.toggle("SpaceGravityFooter", spaceGravityMode);
  const page = lyricsContent?.closest<HTMLElement>("#SpicyLyricsPage");
  const cardMode = page?.classList.contains("CardMode") ?? false;

  if (spaceGravityMode) {
    footer.classList.remove("PinnedLyricsFooter");
    if (cardMode) {
      footer.remove();
      return;
    }
    const pinnedFooterLayer = lyricsContent?.parentElement?.querySelector<HTMLElement>(
      ".LyricsPinnedFooter"
    );
    pinnedFooterLayer?.querySelectorAll<HTMLElement>(".PinnedFooterDetail").forEach((detail) => {
      footer.appendChild(detail);
    });
    lyricsContainer.appendChild(footer);
    return;
  }

  const pinnedFooterLayer = lyricsContent?.parentElement?.querySelector<HTMLElement>(
    ".LyricsPinnedFooter"
  );
  // Footer placement must follow page class. CSS uses same class to reveal and
  // pin layer, while persisted experiment store can lag during page construction.
  const mode = page?.classList.contains("PinnedFooterMode_Full")
    ? "Full"
    : page?.classList.contains("PinnedFooterMode_NoWriters")
      ? "NoWriters"
      : "Off";
  const pinned = Boolean(!cardMode && mode === "Full" && pinnedFooterLayer);
  footer.dataset.pinnedFooterMode = mode;
  if (mode === "NoWriters" && pinnedFooterLayer) {
    noWriterPinnedLayers.set(footer, pinnedFooterLayer);
    footer.querySelectorAll<HTMLElement>(".PinnedFooterDetail").forEach((detail) => {
      pinnedFooterLayer.appendChild(detail);
    });
  }
  footer.classList.toggle("PinnedLyricsFooter", pinned);

  if (pinned && pinnedFooterLayer) {
    pinnedFooterLayer.appendChild(footer);
    return;
  }

  lyricsContainer.appendChild(footer);
}

/** Move source/community details into the pinned layer while writers stay scrollable. */
export function PinFooterDetailWithoutWriters(detail: HTMLElement, footer: HTMLElement): void {
  detail.classList.add("PinnedFooterDetail");
  if (footer.dataset.pinnedFooterMode !== "NoWriters") return;
  const pinnedFooterLayer = noWriterPinnedLayers.get(footer)
    ?? footer.closest<HTMLElement>(".LyricsContainer")?.querySelector<HTMLElement>(".LyricsPinnedFooter");
  pinnedFooterLayer?.appendChild(detail);
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
const noWriterPinnedLayers = new WeakMap<HTMLElement, HTMLElement>();
