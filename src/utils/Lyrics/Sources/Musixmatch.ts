import Defaults from "../../../components/Global/Defaults.ts";
import storage from "../../storage.ts";
import {
  createProviderResult,
  applySongWriters,
  buildLineLyrics,
  buildStaticLyrics,
  buildSyllableLyrics,
  capitalizeLeadingLetter,
  countBracketCharacters,
  normalizeText,
  removeSongFeat,
  stripBracketCharacters,
} from "./Shared.ts";
import { fetchSpicySongWriters } from "./Spicy.ts";
import type { TrackLyricsInfo, ExternalLyricsResult, TimedLine, TimedWord, TimedWordLine } from "./Types.ts";

const DEFAULT_MUSIXMATCH_TOKEN =
  "21051986b9886beabe1ce01c3ce94c96319411f8f2c122676365e3";

const MUSIXMATCH_HEADERS = {
  authority: "apic-desktop.musixmatch.com",
  cookie: "x-mxm-token-guid=",
};

const MUSIXMATCH_NOTE_REGEX = /[♪♫♬♩]+/g;

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

function isMusixmatchInstrumental(track: any): boolean {
  return track?.instrumental === true || track?.instrumental === 1 || track?.instrumental === "1";
}

function normalizeMusixmatchTrackName(text: string): string {
  return removeSongFeat(normalizeText(text, false))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isMusixmatchTrackMatch(track: any, trackInfo: TrackLyricsInfo): boolean {
  const expected = normalizeMusixmatchTrackName(trackInfo.title);
  const actual = normalizeMusixmatchTrackName(track?.track_name ?? "");
  return !!expected && !!actual && (expected === actual || expected.includes(actual) || actual.includes(expected));
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
  if (!meta?.has_richsync || isMusixmatchInstrumental(meta) || !meta?.commontrack_id) {
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

  if (isMusixmatchInstrumental(meta)) {
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

  if (isMusixmatchInstrumental(meta)) {
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

        const timedWord: TimedWord = {
          text,
          startTimeMs,
          endTimeMs: Math.max(startTimeMs, endTimeMs),
          isPartOfWord: shouldJoinMusixmatchTokens(rawText, nextRawText),
        };
        return timedWord;
      })
      .filter((word: TimedWord | null): word is TimedWord => word !== null);

    if (!words.length) {
      return;
    }

    const timedLine: TimedWordLine = {
      startTimeMs: words[0].startTimeMs,
      endTimeMs: Math.max(words[words.length - 1].endTimeMs, lineEndTimeMs),
      words,
    };
    lines.push(timedLine);
  });

  return lines.length > 0 ? lines : null;
}

export async function fetchMusixmatchLyrics(
  trackInfo: TrackLyricsInfo,
  getSpicyRaw: () => Promise<ExternalLyricsResult | null>
): Promise<ExternalLyricsResult | null> {
  try {
    const macroCalls = await fetchMusixmatchMacro(trackInfo);
    if (!macroCalls) {
      return null;
    }

    const track = macroCalls?.["matcher.track.get"]?.message?.body?.track;
    if (!isMusixmatchTrackMatch(track, trackInfo) || isMusixmatchInstrumental(track)) {
      return null;
    }

    const richsync = Defaults.IgnoreMusixmatchWordSync
      ? null
      : await fetchMusixmatchRichsync(macroCalls);
    const karaokeLines = Defaults.IgnoreMusixmatchWordSync
      ? null
      : getMusixmatchKaraokeLines(richsync);
    if (karaokeLines) {
      const spicySongWriters = await fetchSpicySongWriters(getSpicyRaw());
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
        return createProviderResult(syllableLyrics, "musixmatch");
      }
    }

    const syncedLines = getMusixmatchSyncedLines(macroCalls);
    if (syncedLines) {
      const spicySongWriters = await fetchSpicySongWriters(getSpicyRaw());
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
        return createProviderResult(lineLyrics, "musixmatch");
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
        return createProviderResult(staticLyrics, "musixmatch");
      }
    }

    return null;
  } catch (error) {
    console.error("Failed to fetch lyrics from Musixmatch provider:", error);
    return null;
  }
}
