import Defaults from "../../components/Global/Defaults.ts";
import type { LyricsSourceProviderId } from "./LyricsSourcePreferences.ts";
import type { ExternalLyricsResult } from "./Sources/Types.ts";
import { getTrackLyricsInfo } from "./Sources/Track.ts";
import { fetchSpicyLyricsRaw, fetchSpicyLyrics, fetchAppleMusicLyrics } from "./Sources/Spicy.ts";
import { fetchMusixmatchLyrics } from "./Sources/Musixmatch.ts";
import { fetchSpotifyLyrics } from "./Sources/Spotify.ts";
import { fetchLRCLIBLyrics } from "./Sources/Lrclib.ts";
import { fetchNeteaseLyrics } from "./Sources/Netease.ts";

export { refreshMusixmatchToken } from "./Sources/Musixmatch.ts";

/**
 * Returns true if the lyrics have at least one genuine line-ending pause — a gap
 * between consecutive lines that falls within a meaningful window.
 *
 * Gaps below minGapSec are timing artifacts from back-to-back Musixmatch-sourced
 * syncs and are ignored. Gaps at or above maxGapSec are instrumental sections/tags,
 * not line pauses, and are also ignored. Only gaps strictly within the window
 * [minGapSec, maxGapSec) are counted as real Apple Music line-ending data.
 */
function hasLineGaps(lyrics: any, minGapSec = 0.3, maxGapSec = 5.0): boolean {
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

    if (currentEnd === null || nextStart === null) continue;

    const gap = nextStart - currentEnd;
    if (gap >= minGapSec && gap < maxGapSec) {
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

const FALLBACK_PROVIDER_TIMEOUT_MS = 4000;

type FetchLyricsFromProvidersOptions = {
  onFirstLyrics?: (lyrics: any) => void;
};

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
  order: LyricsSourceProviderId[],
  options: FetchLyricsFromProvidersOptions = {}
): Promise<ExternalLyricsResult | null> {
  const trackInfo = await getTrackLyricsInfo(uri);
  if (!trackInfo) {
    return null;
  }

  const prioritizeApple = Defaults.PrioritizeAppleMusicQuality;
  const appleIsInOrder = order.includes("apple");
  let spicyRawPromise: Promise<ExternalLyricsResult | null> | null = null;
  const getSpicyRaw = () => {
    spicyRawPromise ??= fetchSpicyLyricsRaw(trackInfo.id);
    return spicyRawPromise;
  };
  const fetchers = new Map<LyricsSourceProviderId, () => Promise<ExternalLyricsResult | null>>([
    ["spicy", () => fetchSpicyLyrics(getSpicyRaw())],
    ["musixmatch", () => fetchMusixmatchLyrics(trackInfo, getSpicyRaw)],
    ["apple", () => fetchAppleMusicLyrics(getSpicyRaw())],
    ["spotify", () => fetchSpotifyLyrics(trackInfo)],
    ["lrclib", () => withProviderTimeout(fetchLRCLIBLyrics(trackInfo), FALLBACK_PROVIDER_TIMEOUT_MS)],
    ["netease", () => withProviderTimeout(fetchNeteaseLyrics(trackInfo), FALLBACK_PROVIDER_TIMEOUT_MS)],
  ]);

  // Start every enabled provider now. Results are still consumed in configured
  // order below, so this removes serial fallback wait without changing source
  // preference or quality selection.
  const providerRequests = new Map<
    LyricsSourceProviderId,
    Promise<ExternalLyricsResult | null>
  >();
  let firstLyricsDelivered = false;
  for (const provider of order) {
    const request = fetchers.get(provider)?.() ?? Promise.resolve(null);
    providerRequests.set(provider, request);
    void request
      .then((result) => {
        if (firstLyricsDelivered || !result?.lyrics) return;
        firstLyricsDelivered = true;
        options.onFirstLyrics?.(result.lyrics);
      })
      .catch(() => {});
  }

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

    const result = await (providerRequests.get(provider) ?? Promise.resolve(null));

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
