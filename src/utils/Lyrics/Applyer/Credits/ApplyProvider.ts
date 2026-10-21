import { CreditsRow } from "./CreditsRow.ts";
import { PinFooterDetailWithoutWriters } from "./CreateLyricsFooter.ts";

const ProviderMap = {
    "spt": "Spotify",
    "aml": "Apple Music",
    "spl": "Spicy Lyrics",
    "ldb": "Local DB",
    "uns": "Unison",
    "spicy": "Spicy Lyrics",
    "spotify": "Spotify",
    "apple": "Apple Music",
    "musixmatch": "Musixmatch",
    "lrclib": "LRCLIB",
    "netease": "Netease",
}

const ViaMap: Record<string, { label: string; url?: string }> = {
  "lrc-red": { label: "lrc.red", url: "https://lrc.red/?utm_source=spicylyrics" },
};

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
  const experimentalWordSyncHelp =
    data.experimentalWordSync && data.experimentalWordSyncReason !== "SpaceGravity";
  CreditsRow(ProviderElement, "Provided by", `${providerLabel}${
    experimentalWordSplittingHelp
      ? " (+ extra splits)"
      : ""
  }${experimentalWordSyncHelp ? " (+ automatic experimental splitting)" : ""}`);

  const via = typeof data.source_via === "string" && Object.hasOwn(ViaMap, data.source_via)
    ? ViaMap[data.source_via]
    : undefined;
  if (via) {
    const viaElement = LyricsContainer.ownerDocument.createElement("span");
    viaElement.classList.add("LyricsProviderVia");
    const viaLabel = LyricsContainer.ownerDocument.createElement("span");
    viaLabel.classList.add("LyricsProviderViaLabel");
    viaLabel.textContent = "via ";
    viaElement.appendChild(viaLabel);

    if (via.url) {
      const link = LyricsContainer.ownerDocument.createElement("a");
      link.classList.add("LyricsProviderViaLink");
      link.href = via.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = via.label;
      // Open through the main window so popouts use the external browser too.
      link.addEventListener("click", (event) => {
        event.preventDefault();
        window.open(via.url!, "_blank", "noopener,noreferrer");
      });
      viaElement.appendChild(link);
    } else {
      viaLabel.append(via.label);
    }

    ProviderElement.append(" ", viaElement);
  }

  LyricsContainer.appendChild(ProviderElement);
  PinFooterDetailWithoutWriters(ProviderElement, LyricsContainer);
}
