const ProviderMap = {
    "spt": "Spotify",
    "aml": "Apple Music",
    "spl": "Spicy Lyrics",
    "ldb": "Local DB",
    "spicy": "Spicy Lyrics",
    "spotify": "Spotify",
    "apple": "Apple Music",
    "musixmatch": "Musixmatch",
    "lrclib": "LRCLIB",
    "netease": "Netease",
}

export function ApplyLyricsProvider(data: any, LyricsContainer: HTMLElement): void {
  if ((!data?.source && !data?.fetchProvider && !data?.sourceDisplayName) || !LyricsContainer) return;

  const ProviderElement = document.createElement("div");
  ProviderElement.classList.add("LyricsProvider");

  let providerLabel = "";
  if (
    typeof data.sourceDisplayName === "string"
  ) {
    providerLabel = data.sourceDisplayName;
  } else if (
    typeof data.source === "string" &&
    Object.prototype.hasOwnProperty.call(ProviderMap, data.source)
  ) {
    providerLabel = ProviderMap[data.source];
  } else if (
    typeof data.fetchProvider === "string" &&
    Object.prototype.hasOwnProperty.call(ProviderMap, data.fetchProvider)
  ) {
    providerLabel = ProviderMap[data.fetchProvider];
  } else {
    providerLabel = "Unknown";
  }
  const experimentalWordSplittingHelp =
    providerLabel === "Apple Music" && data.experimentalAppleWordSplitting;
  ProviderElement.textContent = `Lyrics provided by: ${providerLabel}${
    experimentalWordSplittingHelp
      ? " (with some experimental word splitting help)"
      : ""
  }`;
  LyricsContainer.appendChild(ProviderElement);
  PinFooterDetailWithoutWriters(ProviderElement, LyricsContainer);
}
import { PinFooterDetailWithoutWriters } from "./CreateLyricsFooter.ts";
