import { createProviderResult, buildLineLyrics, buildStaticLyrics, capitalize, normalizeText, parseTimestampToMilliseconds, removeExtraInfo, removeSongFeat } from "./Shared.ts";
import type { TrackLyricsInfo, ExternalLyricsResult } from "./Types.ts";

const NETEASE_REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:93.0) Gecko/20100101 Firefox/93.0",
};

const NETEASE_CREDIT_REGEX = new RegExp(
  `^(${[
    "\\s?作?\\s*词|\\s?作?\\s*曲|\\s?编\\s*曲?|\\s?监\\s*制?",
    ".*编写|.*和音|.*和声|.*合声|.*提琴|.*录|.*工程|.*工作室|.*设计|.*剪辑|.*制作|.*发行|.*出品|.*后期|.*混音|.*缩混",
    "原唱|翻唱|题字|文案|海报|古筝|二胡|钢琴|吉他|贝斯|笛子|鼓|弦乐",
    "lrc|publish|vocal|guitar|program|produce|write|mix",
  ].join("|")}).*(:|：)`,
  "i"
);

function containsNeteaseCredits(text: string): boolean {
  return NETEASE_CREDIT_REGEX.test(text);
}

function parseNeteaseTimestampedLine(row: string): {
  timestamps: number[];
  text: string;
} | null {
  const matches = Array.from(row.matchAll(/\[([0-9:.]+)\]/g));
  if (!matches.length) {
    return null;
  }

  const text = capitalize(
    normalizeText(row.replace(/\[[0-9:.]+\]/g, "").trim(), false)
  );

  if (!text || containsNeteaseCredits(text) || text === "纯音乐, 请欣赏") {
    return null;
  }

  const timestamps = matches
    .map((match) => parseTimestampToMilliseconds(match[1]))
    .filter((value): value is number => value !== null);

  if (!timestamps.length) {
    return null;
  }

  return {
    timestamps,
    text,
  };
}

export async function fetchNeteaseLyrics(
  trackInfo: TrackLyricsInfo
): Promise<ExternalLyricsResult | null> {
  try {
    const searchQuery = `${removeExtraInfo(removeSongFeat(normalizeText(trackInfo.title)))} ${
      trackInfo.artist
    }`.trim();
    const searchResponse = await Spicetify.CosmosAsync.get(
      `https://music.xianqiao.wang/neteaseapiv2/search?limit=10&type=1&keywords=${encodeURIComponent(
        searchQuery
      )}`,
      null,
      NETEASE_REQUEST_HEADERS
    );
    const songs = searchResponse?.result?.songs;

    if (!Array.isArray(songs) || songs.length === 0) {
      return null;
    }

    const normalizedAlbum = normalizeText(trackInfo.album);
    const normalizedTitle = normalizeText(removeExtraInfo(removeSongFeat(trackInfo.title)));
    const matchedSong =
      songs.find((song: any) => normalizeText(song?.album?.name) === normalizedAlbum) ??
      songs.find((song: any) => Math.abs(trackInfo.durationMs - Number(song?.duration ?? 0)) < 3000) ??
      songs.find((song: any) => normalizeText(song?.name) === normalizedTitle) ??
      songs[0];

    if (!matchedSong?.id) {
      return null;
    }

    const lyricsBody = await Spicetify.CosmosAsync.get(
      `https://music.xianqiao.wang/neteaseapiv2/lyric?id=${matchedSong.id}`,
      null,
      NETEASE_REQUEST_HEADERS
    );

    const syncedText = lyricsBody?.lrc?.lyric;
    if (typeof syncedText === "string") {
      const timedLines = syncedText
        .split(/\r?\n/)
        .map((row: string) => row.trim())
        .filter(Boolean)
        .flatMap((row: string) => {
          const parsed = parseNeteaseTimestampedLine(row);
          if (!parsed) return [];

          return parsed.timestamps.map((startTimeMs) => ({
            text: parsed.text,
            startTimeMs,
          }));
        });

      if (timedLines.length > 0) {
        const lineLyrics = buildLineLyrics(
          timedLines,
          trackInfo.durationMs,
          "netease",
          "Netease"
        );
        if (lineLyrics) {
          return createProviderResult(lineLyrics, "netease");
        }
      }
    }

    if (typeof syncedText === "string") {
      const staticLines = syncedText
        .split(/\r?\n/)
        .map((row: string) => row.trim())
        .map((row: string) => {
          const parsed = parseNeteaseTimestampedLine(row);
          return parsed?.text ?? "";
        })
        .filter(Boolean);

      const staticLyrics = buildStaticLyrics(staticLines, "netease", "Netease");
      if (staticLyrics) {
        return createProviderResult(staticLyrics, "netease");
      }
    }

    return null;
  } catch (error) {
    console.error("Failed to fetch lyrics from Netease provider:", error);
    return null;
  }
}
