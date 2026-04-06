import Platform from "../../components/Global/Platform.ts";
import Defaults from "../../components/Global/Defaults.ts";
import { SpotifyPlayer } from "../../components/Global/SpotifyPlayer.ts";
import { Query } from "../API/Query.ts";
import storage from "../storage.ts";
import type { LyricsSourceProviderId } from "./LyricsSourcePreferences.ts";
import { resolveLyricsSourceLabel } from "./LyricsSourcePreferences.ts";

type TrackLyricsInfo = {
  uri: string;
  id: string;
  durationMs: number;
  title: string;
  artist: string;
  album: string;
};


type TimedLine = {
  text: string;
  startTimeMs: number;
  endTimeMs?: number;
};

type TimedWord = {
  text: string;
  startTimeMs: number;
  endTimeMs: number;
  isPartOfWord: boolean;
};

type TimedWordLine = {
  startTimeMs: number;
  endTimeMs: number;
  words: TimedWord[];
};

type ExternalLyricsResult = {
  lyrics: any;
  status: number;
};

type SpicyLyricsCreditSource = {
  SongWriters?: string[];
};

const DEFAULT_MUSIXMATCH_TOKEN =
  "21051986b9886beabe1ce01c3ce94c96319411f8f2c122676365e3";
const MUSIXMATCH_HEADERS = {
  authority: "apic-desktop.musixmatch.com",
  cookie: "x-mxm-token-guid=",
};
const MUSIXMATCH_NOTE_REGEX = /[♪♫♬♩]+/g;
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

/**
 * Returns true if the lyrics have at least one meaningful pause between consecutive
 * lines — i.e. a line's EndTime is noticeably earlier than the next line's StartTime.
 * Continuous/back-to-back syncs (typical of Musixmatch-sourced timings) return false.
 */
function hasLineGaps(lyrics: any, minGapSec = 0.05): boolean {
  const content = Array.isArray(lyrics?.Content) ? lyrics.Content : [];
  if (content.length < 2) return false;

  for (let i = 0; i < content.length - 1; i++) {
    const current = content[i];
    const next = content[i + 1];

    // Line type stores timing directly; Syllable type nests it under Lead.
    const currentEnd =
      typeof current.EndTime === "number"
        ? current.EndTime
        : typeof current.Lead?.EndTime === "number"
          ? current.Lead.EndTime
          : null;

    const nextStart =
      typeof next.StartTime === "number"
        ? next.StartTime
        : typeof next.Lead?.StartTime === "number"
          ? next.Lead.StartTime
          : null;

    if (currentEnd !== null && nextStart !== null && nextStart - currentEnd > minGapSec) {
      return true;
    }
  }

  return false;
}

function getLyricsTypeScore(lyrics: any): number {
  if (!lyrics || typeof lyrics !== "object") {
    return 0;
  }

  if (lyrics.Type === "Syllable") {
    return 3;
  }

  if (lyrics.Type === "Line") {
    return 2;
  }

  if (lyrics.Type === "Static") {
    return 1;
  }

  return 0;
}

function normalizeText(text: string | undefined, emptySymbol: boolean = true): string {
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

function removeSongFeat(text: string): string {
  return (
    text
      .replace(/-\s+(feat|with|prod).*/i, "")
      .replace(/(\(|\[)(feat|with|prod)\.?\s+.*(\)|\])$/i, "")
      .trim() || text
  );
}

function removeExtraInfo(text: string): string {
  return text.replace(/\s-\s.*/, "");
}

function capitalize(text: string): string {
  return text.replace(/^(\w)/, (match) => match.toUpperCase());
}

function capitalizeLeadingLetter(text: string | undefined): string | undefined {
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

function stripBracketCharacters(text: string | undefined): string {
  return (text ?? "").replace(/[()[\]{}（）【】]/g, "");
}

function countBracketCharacters(
  text: string | undefined,
  matcher: RegExp
): number {
  return ((text ?? "").match(matcher) ?? []).length;
}

function tryGetSongWriters(lyrics: SpicyLyricsCreditSource | null | undefined): string[] | null {
  return Array.isArray(lyrics?.SongWriters) && lyrics.SongWriters.length > 0
    ? lyrics.SongWriters
    : null;
}

function applySongWriters(
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

function getConfiguredMusixmatchToken(): string {
  const spicyToken = storage.get("musixmatchToken")?.toString().trim();
  if (spicyToken) {
    return spicyToken;
  }

  return DEFAULT_MUSIXMATCH_TOKEN;
}

function getMusixmatchUserToken(response: any): string | null {
  const tokenCandidates = [
    response?.message?.body?.user_token,
    response?.body?.user_token,
  ];

  for (const candidate of tokenCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

export async function refreshMusixmatchToken(
  persist: boolean = true
): Promise<string | null> {
  try {
    const response = await Spicetify.CosmosAsync.get(
      "https://apic-desktop.musixmatch.com/ws/1.1/token.get?app_id=web-desktop-app-v1.0",
      null,
      {
        authority: "apic-desktop.musixmatch.com",
      }
    );
    const token = getMusixmatchUserToken(response);
    if (token) {
      if (persist) {
        storage.set("musixmatchToken", token);
      }
      return token;
    }
  } catch (error) {
    console.error("Failed to refresh Musixmatch token:", error);
  }

  return null;
}

async function requestMusixmatch(
  buildUrl: (token: string) => string,
  retry: boolean = true
) {
  const currentToken = getConfiguredMusixmatchToken();

  try {
    const response = await Spicetify.CosmosAsync.get(
      buildUrl(currentToken),
      null,
      MUSIXMATCH_HEADERS
    );

    if (response?.message?.header?.status_code === 401 && retry) {
      const refreshedToken = await refreshMusixmatchToken();
      if (refreshedToken && refreshedToken !== currentToken) {
        return requestMusixmatch(buildUrl, false);
      }
    }

    return response;
  } catch (error) {
    if (retry) {
      const refreshedToken = await refreshMusixmatchToken();
      if (refreshedToken && refreshedToken !== currentToken) {
        return requestMusixmatch(buildUrl, false);
      }
    }

    throw error;
  }
}

function buildTrackLyricsInfo(
  uri: string,
  id: string,
  title: string,
  artist: string,
  album: string,
  durationMs: number
): TrackLyricsInfo | null {
  if (!id || !title || !artist || durationMs <= 0) {
    return null;
  }

  return {
    uri,
    id,
    durationMs,
    title,
    artist,
    album,
  };
}

async function getTrackLyricsInfo(uri: string): Promise<TrackLyricsInfo | null> {
  const id = uri.split(":")[2] ?? "";
  if (!id) return null;

  if (!Spicetify.URI.isTrack(uri) && !uri.startsWith("spotify:local:")) {
    return null;
  }

  const currentUri = SpotifyPlayer.GetUri() ?? "";
  const currentId = SpotifyPlayer.GetId() ?? "";
  if (uri !== currentUri && id !== currentId) return null;

  const title = SpotifyPlayer.GetName() ?? "";
  const artist =
    SpotifyPlayer.GetArtists()
      ?.map((entry) => entry.name)
      .filter(Boolean)
      .join(", ") ?? "";
  const album = SpotifyPlayer.GetAlbumName() ?? "";
  const durationMs = SpotifyPlayer.GetDuration();

  return buildTrackLyricsInfo(uri, id, title, artist, album, durationMs);
}

function buildStaticLyrics(
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

function buildLineLyrics(
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

function buildSyllableLyrics(
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

function applyMusixmatchBracketBackgrounds(lyrics: any) {
  if (lyrics?.Type !== "Syllable" || !Array.isArray(lyrics.Content)) {
    return lyrics;
  }

  const nextContent: any[] = [];

  lyrics.Content.forEach((entry: any) => {
    if (entry?.Type !== "Vocal" || !Array.isArray(entry?.Lead?.Syllables)) {
      nextContent.push(entry);
      return;
    }

    const leadSyllables: any[] = [];
    const backgroundGroups: any[] = [];
    let currentBackgroundGroup: any[] = [];
    let bracketDepth = 0;
    let strippedLeadingBackground = false;

    entry.Lead.Syllables.forEach((syllable: any) => {
      const rawText = typeof syllable?.Text === "string" ? syllable.Text : "";
      const openCount = countBracketCharacters(rawText, /[([{\uFF08【]/g);
      const closeCount = countBracketCharacters(rawText, /[)\]}\uFF09】]/g);
      const isBackground = bracketDepth > 0 || openCount > 0;
      const cleanedText = normalizeText(stripBracketCharacters(rawText), false);

      if (isBackground) {
        if (cleanedText) {
          currentBackgroundGroup.push({
            ...syllable,
            Text: cleanedText,
          });
        }
      } else if (cleanedText) {
        leadSyllables.push({
          ...syllable,
          Text: cleanedText,
        });
      }

      bracketDepth += openCount;
      bracketDepth = Math.max(0, bracketDepth - closeCount);

      if (isBackground && bracketDepth === 0 && currentBackgroundGroup.length > 0) {
        currentBackgroundGroup[0].Text =
          capitalizeLeadingLetter(currentBackgroundGroup[0].Text) ??
          currentBackgroundGroup[0].Text;

        backgroundGroups.push({
          StartTime: currentBackgroundGroup[0].StartTime,
          EndTime: currentBackgroundGroup[currentBackgroundGroup.length - 1].EndTime,
          Syllables: currentBackgroundGroup,
        });
        if (leadSyllables.length === 0) {
          strippedLeadingBackground = true;
        }
        currentBackgroundGroup = [];
      }
    });

    if (currentBackgroundGroup.length > 0) {
      currentBackgroundGroup[0].Text =
        capitalizeLeadingLetter(currentBackgroundGroup[0].Text) ??
        currentBackgroundGroup[0].Text;

      backgroundGroups.push({
        StartTime: currentBackgroundGroup[0].StartTime,
        EndTime: currentBackgroundGroup[currentBackgroundGroup.length - 1].EndTime,
        Syllables: currentBackgroundGroup,
      });
      if (leadSyllables.length === 0) {
        strippedLeadingBackground = true;
      }
    }

    if (backgroundGroups.length === 0) {
      nextContent.push(entry);
      return;
    }

    if (leadSyllables.length === 0) {
      const previousEntry = nextContent[nextContent.length - 1];
      if (previousEntry?.Type === "Vocal" && previousEntry?.Lead) {
        previousEntry.Background = [
          ...(previousEntry.Background ?? []),
          ...backgroundGroups,
        ];
        return;
      }

      nextContent.push({
        ...entry,
        Lead: {
          ...entry.Lead,
          StartTime: backgroundGroups[0].StartTime,
          EndTime: backgroundGroups[backgroundGroups.length - 1].EndTime,
          Syllables: backgroundGroups.flatMap((group) => group.Syllables),
        },
      });
      return;
    }

    if (strippedLeadingBackground && leadSyllables.length > 0) {
      leadSyllables[0].Text =
        capitalizeLeadingLetter(leadSyllables[0].Text) ?? leadSyllables[0].Text;
    }

    nextContent.push({
      ...entry,
      Lead: {
        ...entry.Lead,
        StartTime: entry.Lead.StartTime ?? leadSyllables[0].StartTime,
        EndTime: entry.Lead.EndTime ?? leadSyllables[leadSyllables.length - 1].EndTime,
        Syllables: leadSyllables,
      },
      Background: [...(entry.Background ?? []), ...backgroundGroups],
    });
  });

  return {
    ...lyrics,
    Content: nextContent,
  };
}

function stripMusixmatchNoteMarkers(text: string | undefined): string {
  return (text ?? "").replace(/\r/g, "").replace(MUSIXMATCH_NOTE_REGEX, " ");
}

function normalizeMusixmatchLineText(text: string | undefined): string {
  return normalizeText(stripMusixmatchNoteMarkers(text), false);
}

function isMusixmatchInstrumentalPlaceholder(text: string | undefined): boolean {
  const normalized = normalizeMusixmatchLineText(
    stripMusixmatchNoteMarkers(text).replace(/[()[\]{}\-–—:;,.!?_/\\]+/g, " ")
  );
  return !normalized || /^(instrumental|inst\.?)$/i.test(normalized);
}

function shouldJoinMusixmatchTokens(currentText: string, nextText: string): boolean {
  const current = currentText.trim();
  const next = nextText.trim();
  if (!current || !next) {
    return false;
  }

  if (/^['’\-–—/.,!?;:%)\]}]+/.test(next)) {
    return true;
  }

  if (/[(\[{'"“‘\-–—/]$/.test(current)) {
    return true;
  }

  return false;
}

function filterMusixmatchPlainLines(lines: string[]): string[] {
  return lines
    .map((line) => normalizeMusixmatchLineText(line))
    .filter(Boolean)
    .filter(
      (line) =>
        !/This Lyrics is NOT for Commercial use/i.test(line) &&
        !/^\*{3,}/.test(line)
    );
}

async function fetchMusixmatchMacro(
  trackInfo: TrackLyricsInfo,
  retry: boolean = true
) {
  const buildUrl = (token: string) =>
    "https://apic-desktop.musixmatch.com/ws/1.1/macro.subtitles.get?format=json&namespace=lyrics_richsynched&subtitle_format=mxm&app_id=web-desktop-app-v1.0&" +
    [
      ["q_album", trackInfo.album],
      ["q_artist", trackInfo.artist],
      ["q_artists", trackInfo.artist],
      ["q_track", trackInfo.title],
      ["track_spotify_id", trackInfo.uri],
      ["q_duration", String(trackInfo.durationMs / 1000)],
      ["f_subtitle_length", String(Math.floor(trackInfo.durationMs / 1000))],
      ["usertoken", token],
      ["part", "track_lyrics_translation_status,track_structure,track_performer_tagging"],
    ]
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");

  const body = await requestMusixmatch(buildUrl, retry);
  const macroCalls = body?.message?.body?.macro_calls;

  if (!macroCalls) {
    return null;
  }

  const matcherStatus =
    macroCalls?.["matcher.track.get"]?.message?.header?.status_code;

  if (matcherStatus === 401 && retry) {
    const refreshedToken = await refreshMusixmatchToken();
    if (refreshedToken) {
      return fetchMusixmatchMacro(trackInfo, false);
    }
  }

  if (matcherStatus !== 200) {
    return null;
  }

  if (macroCalls?.["track.lyrics.get"]?.message?.body?.lyrics?.restricted) {
    return null;
  }

  return macroCalls;
}

async function fetchMusixmatchRichsync(
  macroCalls: any,
  retry: boolean = true
) {
  const meta = macroCalls?.["matcher.track.get"]?.message?.body?.track;
  if (!meta?.has_richsync || meta?.instrumental || !meta?.commontrack_id) {
    return null;
  }

  const buildUrl = (token: string) =>
    "https://apic-desktop.musixmatch.com/ws/1.1/track.richsync.get?format=json&subtitle_format=mxm&app_id=web-desktop-app-v1.0&" +
    [
      ["f_subtitle_length", String(meta.track_length)],
      ["q_duration", String(meta.track_length)],
      ["commontrack_id", String(meta.commontrack_id)],
      ["usertoken", token],
    ]
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");

  const response = await requestMusixmatch(buildUrl, retry);
  if (response?.message?.header?.status_code !== 200) {
    return null;
  }

  const richsyncBody = response?.message?.body?.richsync?.richsync_body;
  if (typeof richsyncBody !== "string" || !richsyncBody.trim()) {
    return null;
  }

  try {
    return JSON.parse(richsyncBody);
  } catch (error) {
    console.error("Failed to parse Musixmatch richsync body:", error);
    return null;
  }
}

function getMusixmatchSyncedLines(macroCalls: any): TimedLine[] | null {
  const meta = macroCalls?.["matcher.track.get"]?.message?.body?.track;
  if (!meta) {
    return null;
  }

  if (meta.instrumental) {
    return null;
  }

  if (!meta.has_subtitles) {
    return null;
  }

  const subtitle =
    macroCalls?.["track.subtitles.get"]?.message?.body?.subtitle_list?.[0]?.subtitle;
  if (!subtitle?.subtitle_body) {
    return null;
  }

  try {
    const rawLines = JSON.parse(subtitle.subtitle_body);
    const syncedLines: TimedLine[] = [];

    rawLines.forEach((line: any) => {
      const originalText = typeof line?.text === "string" ? line.text : "♪";
      const text = normalizeMusixmatchLineText(originalText);
      const startTimeMs = Math.round((line?.time?.total ?? 0) * 1000);
      const isInstrumentalPlaceholder = isMusixmatchInstrumentalPlaceholder(
        originalText
      );

      if (isInstrumentalPlaceholder) {
        const previousVisibleLine = syncedLines[syncedLines.length - 1];
        if (previousVisibleLine) {
          previousVisibleLine.endTimeMs =
            typeof previousVisibleLine.endTimeMs === "number"
              ? Math.min(previousVisibleLine.endTimeMs, startTimeMs)
              : startTimeMs;
        }
        return;
      }

      if (!text) {
        return;
      }

      syncedLines.push({
        text,
        startTimeMs,
      });
    });

    return syncedLines.length > 0 ? syncedLines : null;
  } catch (error) {
    console.error("Failed to parse Musixmatch synced lyrics:", error);
    return null;
  }
}

function getMusixmatchUnsyncedLines(macroCalls: any): string[] | null {
  const meta = macroCalls?.["matcher.track.get"]?.message?.body?.track;
  if (!meta) {
    return null;
  }

  if (meta.instrumental) {
    return null;
  }

  if (!meta.has_lyrics && !meta.has_lyrics_crowd) {
    return null;
  }

  const lyrics =
    macroCalls?.["track.lyrics.get"]?.message?.body?.lyrics?.lyrics_body;
  if (typeof lyrics !== "string" || !lyrics.trim()) {
    return null;
  }

  const lines = filterMusixmatchPlainLines(lyrics.split("\n")).filter(
    (line) => !isMusixmatchInstrumentalPlaceholder(line)
  );
  return lines.length > 0 ? lines : null;
}

function getMusixmatchKaraokeLines(richsync: any): TimedWordLine[] | null {
  if (!Array.isArray(richsync)) {
    return null;
  }

  const lines: TimedWordLine[] = [];

  richsync.forEach((line: any) => {
    const lineStartTimeMs = Math.round((line?.ts ?? 0) * 1000);
    const lineEndTimeMs = Math.round((line?.te ?? 0) * 1000);
    const rawWords = Array.isArray(line?.l) ? line.l : [];

    const hasVisibleWord = rawWords.some((word: any) => {
      const rawText = typeof word?.c === "string" ? word.c : "";
      return !!normalizeMusixmatchLineText(rawText) && !isMusixmatchInstrumentalPlaceholder(rawText);
    });

    if (!hasVisibleWord) {
      const previousVisibleLine = lines[lines.length - 1];
      if (previousVisibleLine) {
        previousVisibleLine.endTimeMs = Math.min(previousVisibleLine.endTimeMs, lineStartTimeMs);
      }
      return;
    }

    const words = rawWords
      .map((word: any, index: number) => {
        const rawText = typeof word?.c === "string" ? word.c : "";
        const text = normalizeMusixmatchLineText(rawText);
        if (!text || isMusixmatchInstrumentalPlaceholder(rawText)) {
          return null;
        }

        const relativeStartMs = Math.round((word?.o ?? 0) * 1000);
        const nextRelativeStartMs = Math.round(
          ((rawWords[index + 1]?.o ?? Number.NaN) as number) * 1000
        );
        const startTimeMs = lineStartTimeMs + relativeStartMs;
        const endTimeMs = Number.isFinite(nextRelativeStartMs)
          ? lineStartTimeMs + nextRelativeStartMs
          : lineEndTimeMs;
        const nextRawText =
          typeof rawWords[index + 1]?.c === "string" ? rawWords[index + 1].c : "";

        return {
          text,
          startTimeMs,
          endTimeMs: Math.max(startTimeMs, endTimeMs),
          isPartOfWord: shouldJoinMusixmatchTokens(rawText, nextRawText),
        } satisfies TimedWord;
      })
      .filter((word: TimedWord | null): word is TimedWord => word !== null);

    if (!words.length) {
      return;
    }

    lines.push({
      startTimeMs: words[0].startTimeMs,
      endTimeMs: Math.max(words[words.length - 1].endTimeMs, lineEndTimeMs),
      words,
    } satisfies TimedWordLine);
  });

  return lines.length > 0 ? lines : null;
}

async function fetchSpicyLyricsRaw(trackId: string): Promise<ExternalLyricsResult | null> {
  try {
    const token = await Platform.GetSpotifyAccessToken();
    const queries = await Query(
      [
        {
          operation: "lyrics",
          variables: {
            id: trackId,
            auth: "SpicyLyrics-WebAuth",
          },
        },
      ],
      {
        "SpicyLyrics-WebAuth": `Bearer ${token}`,
      }
    );

    const lyricsQuery = queries.get("0");
    if (!lyricsQuery || lyricsQuery.httpStatus !== 200 || lyricsQuery.format !== "json") {
      return null;
    }

    const lyrics = lyricsQuery.data;
    if (!lyrics) {
      return null;
    }

    return {
      lyrics: {
        ...lyrics,
        fetchProvider: "spicy",
        sourceDisplayName: resolveLyricsSourceLabel(
          lyrics.source,
          lyrics.sourceDisplayName,
          "spicy"
        ),
      },
      status: 200,
    };
  } catch (error) {
    console.error("Failed to fetch lyrics from Spicy Lyrics provider:", error);
    return null;
  }
}

async function fetchSpicyLyrics(trackId: string): Promise<ExternalLyricsResult | null> {
  const raw = await fetchSpicyLyricsRaw(trackId);
  if (!raw) return null;
  // Community-only: source must be "spl"
  if (raw.lyrics?.source !== "spl") return null;
  return raw;
}

async function fetchAppleMusicLyrics(trackId: string): Promise<ExternalLyricsResult | null> {
  const raw = await fetchSpicyLyricsRaw(trackId);
  if (!raw) return null;
  // Apple Music only: source must be "aml"
  if (raw.lyrics?.source !== "aml") return null;
  return raw;
}

async function fetchSpicySongWriters(trackId: string): Promise<string[] | null> {
  const spicyResult = await fetchSpicyLyricsRaw(trackId);
  return tryGetSongWriters(spicyResult?.lyrics);
}

async function fetchSpotifyLyrics(
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
        ? "Musixmatch"
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
        return {
          lyrics: {
            ...lineLyrics,
            fetchProvider: "spotify",
          },
          status: 200,
        };
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

    return {
      lyrics: {
        ...staticLyrics,
        fetchProvider: "spotify",
      },
      status: 200,
    };
  } catch (error) {
    console.error("Failed to fetch lyrics from Spotify provider:", error);
    return null;
  }
}

async function fetchMusixmatchLyrics(
  trackInfo: TrackLyricsInfo
): Promise<ExternalLyricsResult | null> {
  try {
    const macroCalls = await fetchMusixmatchMacro(trackInfo);
    if (!macroCalls) {
      return null;
    }

    const richsync = Defaults.IgnoreMusixmatchWordSync
      ? null
      : await fetchMusixmatchRichsync(macroCalls);
    const karaokeLines = Defaults.IgnoreMusixmatchWordSync
      ? null
      : getMusixmatchKaraokeLines(richsync);
    if (karaokeLines) {
      const spicySongWriters = await fetchSpicySongWriters(trackInfo.id);
      const syllableLyrics = applySongWriters(
        applyMusixmatchBracketBackgrounds(
          buildSyllableLyrics(
            karaokeLines,
            "musixmatch",
            "Musixmatch"
          )
        ),
        spicySongWriters
      );

      if (syllableLyrics) {
        return {
          lyrics: {
            ...syllableLyrics,
            fetchProvider: "musixmatch",
          },
          status: 200,
        };
      }
    }

    const syncedLines = getMusixmatchSyncedLines(macroCalls);
    if (syncedLines) {
      const spicySongWriters = await fetchSpicySongWriters(trackInfo.id);
      const lineLyrics = applySongWriters(
        buildLineLyrics(
          syncedLines,
          trackInfo.durationMs,
          "musixmatch",
          "Musixmatch"
        ),
        spicySongWriters
      );
      if (lineLyrics) {
        return {
          lyrics: {
            ...lineLyrics,
            fetchProvider: "musixmatch",
          },
          status: 200,
        };
      }
    }

    const unsyncedLines = getMusixmatchUnsyncedLines(macroCalls);
    if (unsyncedLines) {
      const staticLyrics = buildStaticLyrics(
        unsyncedLines,
        "musixmatch",
        "Musixmatch"
      );
      if (staticLyrics) {
        return {
          lyrics: {
            ...staticLyrics,
            fetchProvider: "musixmatch",
          },
          status: 200,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Failed to fetch lyrics from Musixmatch provider:", error);
    return null;
  }
}

function parseTimestampToMilliseconds(timestamp: string): number | null {
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

async function fetchLRCLIBLyrics(
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

      return {
        lyrics: {
          ...instrumentalLyrics,
          fetchProvider: "lrclib",
        },
        status: 200,
      };
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
          return {
            lyrics: {
              ...lineLyrics,
              fetchProvider: "lrclib",
            },
            status: 200,
          };
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
        return {
          lyrics: {
            ...staticLyrics,
            fetchProvider: "lrclib",
          },
          status: 200,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Failed to fetch lyrics from LRCLIB provider:", error);
    return null;
  }
}

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

async function fetchNeteaseLyrics(
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
          return {
            lyrics: {
              ...lineLyrics,
              fetchProvider: "netease",
            },
            status: 200,
          };
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
        return {
          lyrics: {
            ...staticLyrics,
            fetchProvider: "netease",
          },
          status: 200,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Failed to fetch lyrics from Netease provider:", error);
    return null;
  }
}

const FALLBACK_PROVIDER_TIMEOUT_MS = 4000;

function withProviderTimeout<T>(
  promise: Promise<T | null>,
  ms: number
): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export async function fetchLyricsFromProviders(
  uri: string,
  order: LyricsSourceProviderId[]
): Promise<ExternalLyricsResult | null> {
  const trackInfo = await getTrackLyricsInfo(uri);
  if (!trackInfo) {
    return null;
  }

  const prioritizeApple = Defaults.PrioritizeAppleMusicQuality;
  const appleIsInOrder = order.includes("apple");

  let bestResult: ExternalLyricsResult | null = null;
  let bestScore = 0;
  let hadPreferredResult = false;
  let appleResult: ExternalLyricsResult | null = null;
  let appleScore = 0;
  let appleTried = false;

  for (const provider of order) {
    // If a preferred source (spicy/musixmatch) already gave us something,
    // lrclib and netease are unlikely to improve on it — skip them.
    if (hadPreferredResult && (provider === "lrclib" || provider === "netease")) {
      continue;
    }

    const result =
      provider === "spicy"
        ? await fetchSpicyLyrics(trackInfo.id)
        : provider === "musixmatch"
          ? await fetchMusixmatchLyrics(trackInfo)
          : provider === "apple"
            ? await fetchAppleMusicLyrics(trackInfo.id)
            : provider === "spotify"
              ? await fetchSpotifyLyrics(trackInfo)
              : provider === "lrclib"
                ? await withProviderTimeout(fetchLRCLIBLyrics(trackInfo), FALLBACK_PROVIDER_TIMEOUT_MS)
                : provider === "netease"
                  ? await withProviderTimeout(fetchNeteaseLyrics(trackInfo), FALLBACK_PROVIDER_TIMEOUT_MS)
                  : null;

    if (provider === "apple") {
      appleTried = true;
      if (result?.lyrics) {
        appleResult = result;
        appleScore = getLyricsTypeScore(result.lyrics);
      }
    }

    if (!result?.lyrics) {
      continue;
    }

    const score = getLyricsTypeScore(result.lyrics);
    if (score > bestScore) {
      bestResult = result;
      bestScore = score;
    }

    if (provider === "spicy" || provider === "musixmatch" || provider === "apple") {
      hadPreferredResult = true;
    }

    if (score >= 3) {
      // When prioritizing Apple Music quality, don't early-exit until apple has been tried.
      if (prioritizeApple && appleIsInOrder && !appleTried) {
        continue;
      }
      // Prefer Apple Music if it scored strictly higher, or tied and has real line-ending gaps.
      if (prioritizeApple && appleResult) {
        if (appleScore > score || (appleScore === score && hasLineGaps(appleResult.lyrics))) {
          return appleResult;
        }
      }
      return result;
    }
  }

  // Final tiebreak: prefer Apple Music if it scored strictly higher, or tied and has real gaps.
  if (prioritizeApple && appleResult) {
    if (appleScore > bestScore || (appleScore === bestScore && hasLineGaps(appleResult.lyrics))) {
      return appleResult;
    }
  }

  return bestResult;
}
