import { createProviderResult, buildLineLyrics, buildStaticLyrics } from "./Shared.ts";
import type { TrackLyricsInfo, ExternalLyricsResult, TimedLine } from "./Types.ts";

export async function fetchSpotifyLyrics(
  trackInfo: TrackLyricsInfo
): Promise<ExternalLyricsResult | null> {
  try {
    const body = await Spicetify.CosmosAsync.get(
      `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackInfo.id}?format=json&vocalRemoval=false&market=from_token`
    );
    const lyrics = body?.lyrics;
    const lines = Array.isArray(lyrics?.lines) ? lyrics.lines : [];

    if (!lyrics || !lines.length) {
      return null;
    }

    const rawProvider =
      typeof lyrics.provider === "string" ? lyrics.provider.trim() : "";
    const providerName =
      rawProvider.toLowerCase() === "musixmatch"
        ? "Spotify (through Musixmatch)"
        : rawProvider || "Spotify";

    const isNoteOnlyLine = (text: string) => /^[♪♫♬♩\s]*$/.test(text);

    if (lyrics.syncType === "LINE_SYNCED") {
      const timedLines = lines
        .map((line: any) => ({
          text: line.words,
          startTimeMs: Number.parseInt(line.startTimeMs ?? "0", 10),
        }))
        .filter((line: TimedLine) => !!line.text && !isNoteOnlyLine(line.text));

      const lineLyrics = buildLineLyrics(
        timedLines,
        trackInfo.durationMs,
        "spotify",
        providerName
      );

      if (lineLyrics) {
        return createProviderResult(lineLyrics, "spotify");
      }
    }

    const staticLines = lines
      .map((line: any) => line.words)
      .filter((text: any) => typeof text === "string" && !isNoteOnlyLine(text));

    const staticLyrics = buildStaticLyrics(
      staticLines,
      "spotify",
      providerName
    );

    if (!staticLyrics) {
      return null;
    }

    return createProviderResult(staticLyrics, "spotify");
  } catch (error) {
    console.error("Failed to fetch lyrics from Spotify provider:", error);
    return null;
  }
}
