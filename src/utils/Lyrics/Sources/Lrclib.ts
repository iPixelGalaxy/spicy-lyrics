import { createProviderResult, buildLineLyrics, buildStaticLyrics, parseTimestampToMilliseconds } from "./Shared.ts";
import type { TrackLyricsInfo, ExternalLyricsResult, TimedLine } from "./Types.ts";

function parseLRCLikeLyrics(text: string): {
  synced: TimedLine[] | null;
  unsynced: string[] | null;
} {
  const rows = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);

  const synced: TimedLine[] = [];
  const unsynced: string[] = [];

  rows.forEach((row) => {
    const matches = Array.from(row.matchAll(/\[([0-9:.]+)\]/g));
    const lyricText = row.replace(/\[[0-9:.]+\]/g, "").trim();

    if (!lyricText) {
      return;
    }

    if (matches.length > 0) {
      matches.forEach((match) => {
        const startTimeMs = parseTimestampToMilliseconds(match[1]);
        if (startTimeMs !== null) {
          synced.push({
            text: lyricText,
            startTimeMs,
          });
        }
      });
      return;
    }

    unsynced.push(lyricText);
  });

  return {
    synced: synced.length > 0 ? synced : null,
    unsynced: unsynced.length > 0 ? unsynced : null,
  };
}

export async function fetchLRCLIBLyrics(
  trackInfo: TrackLyricsInfo
): Promise<ExternalLyricsResult | null> {
  try {
    const finalURL = `https://lrclib.net/api/get?${[
      ["track_name", trackInfo.title],
      ["artist_name", trackInfo.artist],
      ["album_name", trackInfo.album],
      ["duration", String(trackInfo.durationMs / 1000)],
    ]
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&")}`;

    const response = await fetch(finalURL, {
      headers: {
        "x-user-agent": `spicetify v${Spicetify.Config.version} (https://github.com/spicetify/cli)`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const body = await response.json();
    if (body?.instrumental) {
      const instrumentalLyrics = buildStaticLyrics(
        ["♪ Instrumental ♪"],
        "lrclib",
        "LRCLIB"
      );
      if (!instrumentalLyrics) return null;

      return createProviderResult(instrumentalLyrics, "lrclib");
    }

    if (typeof body?.syncedLyrics === "string") {
      const parsed = parseLRCLikeLyrics(body.syncedLyrics);
      if (parsed.synced) {
        const lineLyrics = buildLineLyrics(
          parsed.synced,
          trackInfo.durationMs,
          "lrclib",
          "LRCLIB"
        );
        if (lineLyrics) {
          return createProviderResult(lineLyrics, "lrclib");
        }
      }
    }

    if (typeof body?.plainLyrics === "string") {
      const plainLines = body.plainLyrics
        .split(/\r?\n/)
        .map((line: string) => line.trim())
        .filter(Boolean);
      const staticLyrics = buildStaticLyrics(plainLines, "lrclib", "LRCLIB");
      if (staticLyrics) {
        return createProviderResult(staticLyrics, "lrclib");
      }
    }

    return null;
  } catch (error) {
    console.error("Failed to fetch lyrics from LRCLIB provider:", error);
    return null;
  }
}
