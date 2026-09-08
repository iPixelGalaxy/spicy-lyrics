import { resolveLyricsSourceLabel, type LyricsSourceProviderId } from "../LyricsSourcePreferences.ts";
import type { ExternalLyricsResult, TimedLine, TimedWordLine, SpicyLyricsCreditSource } from "./Types.ts";

export function normalizeText(text: string | undefined, emptySymbol: boolean = true): string {
  let result = (text ?? "")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/【/g, "[")
    .replace(/】/g, "]")
    .replace(/。/g, ". ")
    .replace(/；/g, "; ")
    .replace(/：/g, ": ")
    .replace(/？/g, "? ")
    .replace(/！/g, "! ")
    .replace(/、|，/g, ", ")
    .replace(/‘|’|′|＇/g, "'")
    .replace(/“|”/g, '"')
    .replace(/〜/g, "~")
    .replace(/·|・/g, "•");

  if (emptySymbol) {
    result = result.replace(/-/g, " ").replace(/\//g, " ");
  }

  return result.replace(/\s+/g, " ").trim();
}

export function removeSongFeat(text: string): string {
  return (
    text
      .replace(/-\s+(feat|with|prod).*/i, "")
      .replace(/(\(|\[)(feat|with|prod)\.?\s+.*(\)|\])$/i, "")
      .trim() || text
  );
}

export function removeExtraInfo(text: string): string {
  return text.replace(/\s-\s.*/, "");
}

export function capitalize(text: string): string {
  return text.replace(/^(\w)/, (match) => match.toUpperCase());
}

export function capitalizeLeadingLetter(text: string | undefined): string | undefined {
  if (typeof text !== "string" || !text) {
    return text;
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (!/[A-Za-z]/.test(character)) {
      continue;
    }

    if (character === character.toUpperCase()) {
      return text;
    }

    return `${text.slice(0, index)}${character.toUpperCase()}${text.slice(index + 1)}`;
  }

  return text;
}

export function stripBracketCharacters(text: string | undefined): string {
  return (text ?? "").replace(/[()[\]{}（）【】]/g, "");
}

export function countBracketCharacters(
  text: string | undefined,
  matcher: RegExp
): number {
  return ((text ?? "").match(matcher) ?? []).length;
}

export function tryGetSongWriters(lyrics: SpicyLyricsCreditSource | null | undefined): string[] | null {
  return Array.isArray(lyrics?.SongWriters) && lyrics.SongWriters.length > 0
    ? lyrics.SongWriters
    : null;
}

export function applySongWriters(
  lyrics: any,
  songWriters: string[] | null | undefined
): any {
  if (!Array.isArray(songWriters) || songWriters.length === 0) {
    return lyrics;
  }

  return {
    ...lyrics,
    SongWriters: songWriters,
  };
}

export function buildStaticLyrics(
  lines: string[],
  source: string,
  sourceDisplayName?: string
) {
  const normalizedLines = lines
    .map((line) => normalizeText(line, false))
    .filter(Boolean)
    .map((Text) => ({ Text }));

  if (!normalizedLines.length) {
    return null;
  }

  return {
    Type: "Static",
    Lines: normalizedLines,
    source,
    sourceDisplayName: resolveLyricsSourceLabel(source, sourceDisplayName),
  };
}

export function buildLineLyrics(
  lines: TimedLine[],
  durationMs: number,
  source: string,
  sourceDisplayName?: string
) {
  const normalizedLines = lines
    .map((line) => ({
      text: normalizeText(line.text, false),
      startTimeMs: line.startTimeMs,
      endTimeMs: line.endTimeMs,
    }))
    .filter((line) => line.text && !Number.isNaN(line.startTimeMs))
    .sort((left, right) => left.startTimeMs - right.startTimeMs);

  if (!normalizedLines.length) {
    return null;
  }

  const durationSec = durationMs / 1000;
  const content = normalizedLines.map((line, index) => {
    const nextStartSec =
      index < normalizedLines.length - 1
        ? normalizedLines[index + 1].startTimeMs / 1000
        : durationSec;
    const startSec = Math.max(0, line.startTimeMs / 1000);
    const fallbackEnd =
      index < normalizedLines.length - 1
        ? nextStartSec
        : Math.max(startSec + 4, durationSec);
    const explicitEndSec =
      typeof line.endTimeMs === "number" && Number.isFinite(line.endTimeMs)
        ? Math.max(startSec, line.endTimeMs / 1000)
        : null;
    const endSec = Math.max(startSec, explicitEndSec ?? fallbackEnd);

    return {
      Type: "Vocal",
      Text: line.text,
      StartTime: startSec,
      EndTime: endSec,
      OppositeAligned: false,
    };
  });

  return {
    Type: "Line",
    StartTime: content[0]?.StartTime ?? 0,
    Content: content,
    source,
    sourceDisplayName: resolveLyricsSourceLabel(source, sourceDisplayName),
  };
}

export function buildSyllableLyrics(
  lines: TimedWordLine[],
  source: string,
  sourceDisplayName?: string
) {
  const content = lines
    .filter((line) => line.words.length > 0)
    .map((line) => ({
      Type: "Vocal",
      OppositeAligned: false,
      Lead: {
        StartTime: line.startTimeMs / 1000,
        EndTime: line.endTimeMs / 1000,
        Syllables: line.words.map((word) => ({
          Text: word.text,
          StartTime: word.startTimeMs / 1000,
          EndTime: word.endTimeMs / 1000,
          IsPartOfWord: word.isPartOfWord,
        })),
      },
    }));

  if (!content.length) {
    return null;
  }

  return {
    Type: "Syllable",
    StartTime: content[0]?.Lead.StartTime ?? 0,
    Content: content,
    source,
    sourceDisplayName: resolveLyricsSourceLabel(source, sourceDisplayName),
  };
}

export function parseTimestampToMilliseconds(timestamp: string): number | null {
  const normalized = timestamp.trim();
  if (!normalized) return null;

  const pieces = normalized.split(":");
  if (pieces.length < 2) {
    return null;
  }

  const minutes = Number.parseInt(pieces[0], 10);
  const seconds = Number.parseFloat(pieces[1]);

  if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
    return null;
  }

  return Math.round((minutes * 60 + seconds) * 1000);
}

export function createProviderResult(
  lyrics: any,
  fetchProvider: LyricsSourceProviderId
): ExternalLyricsResult {
  return { lyrics: { ...lyrics, fetchProvider }, status: 200 };
}
