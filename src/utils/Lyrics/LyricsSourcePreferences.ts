export type LyricsSourceProviderId =
  | "spicy"
  | "musixmatch"
  | "apple"
  | "spotify"
  | "lrclib"
  | "netease";

type LyricsSourceDefinition = {
  label: string;
  description: string;
};

export const DEFAULT_LYRICS_SOURCE_ORDER: LyricsSourceProviderId[] = [
  "spicy",
  "musixmatch",
  "apple",
  "spotify",
  "lrclib",
  "netease",
];

export const LYRICS_SOURCE_PROVIDER_DEFINITIONS: Record<
  LyricsSourceProviderId,
  LyricsSourceDefinition
> = {
  spicy: {
    label: "Spicy Lyrics",
    description:
      "Community-contributed lyrics sourced directly from the Spicy Lyrics community.",
  },
  musixmatch: {
    label: "Musixmatch",
    description:
      "Uses Musixmatch as a fallback and can provide richer synced or word-timed lyrics when available.",
  },
  apple: {
    label: "Apple Music",
    description:
      "Fetches Apple Music lyrics via the Spicy Lyrics backend when available.",
  },
  spotify: {
    label: "Spotify",
    description:
      "Fetches official Spotify lyrics directly as a fallback when available.",
  },
  lrclib: {
    label: "LRCLIB",
    description:
      "Uses lrclib.net for synced or plain lyrics from the open community library.",
  },
  netease: {
    label: "Netease",
    description:
      "Uses Netease community lyrics as an additional synced or plain fallback.",
  },
};

const LYRICS_SOURCE_LABELS: Record<string, string> = {
  spl: "Spicy Lyrics Community",
  spt: "Spotify",
  aml: "Apple Music",
  spicy: "Spicy Lyrics",
  spotify: "Spotify",
  lrclib: "LRCLIB",
  netease: "Netease",
  musixmatch: "Musixmatch",
  genius: "Genius",
};

export function normalizeLyricsSourceOrder(
  value: unknown
): LyricsSourceProviderId[] {
  let parsed: unknown = value;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value.split(",").map((entry) => entry.trim());
    }
  }

  const validIds = new Set(DEFAULT_LYRICS_SOURCE_ORDER);
  const normalized = Array.isArray(parsed)
    ? parsed.filter(
        (entry): entry is LyricsSourceProviderId =>
          typeof entry === "string" && validIds.has(entry as LyricsSourceProviderId)
      )
    : [];

  const deduped = Array.from(new Set(normalized));

  if (!deduped.includes("musixmatch")) {
    const spicyIndex = deduped.indexOf("spicy");
    if (spicyIndex >= 0) {
      deduped.splice(spicyIndex + 1, 0, "musixmatch");
    } else {
      deduped.unshift("musixmatch");
    }
  }

  if (!deduped.includes("apple")) {
    const musixmatchIndex = deduped.indexOf("musixmatch");
    if (musixmatchIndex >= 0) {
      deduped.splice(musixmatchIndex + 1, 0, "apple");
    } else {
      const spicyIndex = deduped.indexOf("spicy");
      deduped.splice(spicyIndex >= 0 ? spicyIndex + 1 : 0, 0, "apple");
    }
  }

  DEFAULT_LYRICS_SOURCE_ORDER.forEach((id) => {
    if (!deduped.includes(id)) {
      deduped.push(id);
    }
  });

  return deduped;
}

export function stringifyLyricsSourceOrder(
  order: LyricsSourceProviderId[]
): string {
  return JSON.stringify(normalizeLyricsSourceOrder(order));
}

export function normalizeDisabledLyricsSourceIds(
  value: unknown
): LyricsSourceProviderId[] {
  let parsed: unknown = value;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value.split(",").map((e) => e.trim());
    }
  }

  const validIds = new Set(DEFAULT_LYRICS_SOURCE_ORDER);
  const normalized = Array.isArray(parsed)
    ? parsed.filter(
        (e): e is LyricsSourceProviderId =>
          typeof e === "string" && validIds.has(e as LyricsSourceProviderId)
      )
    : [];

  return Array.from(new Set(normalized));
}

export function stringifyDisabledLyricsSourceIds(
  ids: LyricsSourceProviderId[]
): string {
  return JSON.stringify(normalizeDisabledLyricsSourceIds(ids));
}

export function resolveLyricsSourceLabel(
  source?: string,
  sourceDisplayName?: string,
  fetchProvider?: string
): string | null {
  if (sourceDisplayName?.trim()) {
    return sourceDisplayName.trim();
  }

  if (source && LYRICS_SOURCE_LABELS[source]) {
    return LYRICS_SOURCE_LABELS[source];
  }

  if (fetchProvider && LYRICS_SOURCE_LABELS[fetchProvider]) {
    return LYRICS_SOURCE_LABELS[fetchProvider];
  }

  if (source?.trim()) {
    return source.trim();
  }

  return null;
}
