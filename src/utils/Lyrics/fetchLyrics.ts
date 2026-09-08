import Defaults, { isDev } from "../../components/Global/Defaults.ts";
import { $currentLyricsData, $currentLyricsType, $currentlyFetching } from "../stores.ts";
import { SpotifyPlayer } from "../../components/Global/SpotifyPlayer.ts";
import PageView, { PageContainer } from "../../components/Pages/PageView.ts";
import { ProcessLyrics } from "./ProcessLyrics.ts";
import Logger from "../Logger.ts";
import { LocalLyricsManager } from "./manager/index.ts";
import { GetExpireStore } from "../../modules/Store.ts";
import { fetchLyricsFromProviders } from "./ExternalSources.ts";
import {
  normalizeLyricsSourceOrder,
  type LyricsSourceProviderId,
} from "./LyricsSourcePreferences.ts";

import { isCurrentTrack } from "./Sources/Track.ts";
import { HideLoaderContainer, ShowLoaderContainer, UpdateLoadingLyricsTemplate } from "./LyricsLoader.ts";

export { LYRICS_QUEUE_MESSAGE, ShowQueueLoader } from "./LyricsLoader.ts";

const lyricsLogger = new Logger("Lyrics Pipeline");
const lyricsCacheLogger = new Logger("Lyrics Cache");

export const LyricsStore = GetExpireStore<any>("SpicyLyrics_LyricsStore_g1", 4, {
  Unit: "Days",
  Duration: 3,
}, isDev as true);

export const SessionTTMLStore = new Map<string, any>();
const LYRICS_SOURCE_CACHE_VERSION = 4;
const inFlightLyricsFetches = new Map<string, Promise<[object | string, number] | null>>();

function finishFetching(uri: string): void {
  if (isCurrentTrack(uri)) $currentlyFetching.set(false);
}

async function prepareLyricsForPresentation<T extends Record<string, any>>(lyrics: T): Promise<T> {
  const prepared =
    typeof structuredClone === "function"
      ? structuredClone(lyrics)
      : JSON.parse(JSON.stringify(lyrics));
  await ProcessLyrics(prepared);
  return prepared;
}

export function getSongKey(uri: string): string {
  if (!uri || !uri.trim() || !uri.startsWith("spotify:")) return "";
  if (uri.startsWith("spotify:local:")) return uri;
  return uri.split(":")[2] ?? "";
}

function getActiveLyricsSourceOrder(): LyricsSourceProviderId[] {
  const order = normalizeLyricsSourceOrder(Defaults.LyricsSourceOrder);
  const disabled = new Set(Defaults.DisabledLyricsSourceIds);
  return order.filter((provider) => !disabled.has(provider));
}

function getLyricsSourceCacheSignature(): string {
  return JSON.stringify({
    version: LYRICS_SOURCE_CACHE_VERSION,
    order: normalizeLyricsSourceOrder(Defaults.LyricsSourceOrder),
    disabled: Defaults.DisabledLyricsSourceIds,
    ignoreMusixmatchWordSync: Defaults.IgnoreMusixmatchWordSync,
    prioritizeAppleMusicQuality: Defaults.PrioritizeAppleMusicQuality,
  });
}

function isProviderFetchedLyricsCache(data: any): boolean {
  return !!data && typeof data === "object" && (
    typeof data.fetchProvider === "string" ||
    typeof data.source === "string" ||
    typeof data.sourceDisplayName === "string"
  );
}

function attachLyricsSourceCacheMetadata(lyrics: any): any {
  if (!isProviderFetchedLyricsCache(lyrics)) return lyrics;
  return {
    ...lyrics,
    LyricsSourceCacheSignature: getLyricsSourceCacheSignature(),
  };
}

function isLyricsCacheCompatible(data: any): boolean {
  if (!isProviderFetchedLyricsCache(data)) return true;
  return data.LyricsSourceCacheSignature === getLyricsSourceCacheSignature();
}

function setRomanizationClass(hasTransliterations: boolean | undefined): void {
  PageContainer?.classList.toggle("Lyrics_RomanizationAvailable", Boolean(hasTransliterations));
}

/**
 * Shared "lyrics are ready" presentation: toggle the romanization class, hide the
 * loader, publish the type, reveal the containers and view controls, and clear the
 * fetching flag. Used by every successful return path.
 */
async function presentLyrics(uri: string, lyricsData: any): Promise<void> {
  if (!isCurrentTrack(uri)) return;
  setRomanizationClass(lyricsData?.HasTransliterations);
  $currentLyricsType.set(lyricsData.Type);
  PageContainer?.querySelector<HTMLElement>(".ContentBox")?.classList.remove("LyricsHidden");
  PageContainer?.querySelector(".ContentBox .LyricsContainer")?.classList.remove("Hidden");
  PageView.AppendViewControls(true);
  await HideLoaderContainer(uri);
  finishFetching(uri);
}

type FetchLyricsOptions = {
  keepCurrentLyricsVisible?: boolean;
};

async function presentStoredLyrics(
  uri: string,
  lyricsData: Record<string, any>,
  options: FetchLyricsOptions
): Promise<[object, number]> {
  if (isCurrentTrack(uri) && !options.keepCurrentLyricsVisible) {
    UpdateLoadingLyricsTemplate(lyricsData, uri);
  }
  const preparedLyrics = await prepareLyricsForPresentation(lyricsData);
  if (isCurrentTrack(uri)) $currentLyricsData.set(JSON.stringify(preparedLyrics));
  await presentLyrics(uri, preparedLyrics);
  return [preparedLyrics, 200];
}

export default async function fetchLyrics(
  uri: string,
  options: FetchLyricsOptions = {}
): Promise<[object | string, number] | null> {
  const fetchKey = getSongKey(uri) || uri;
  const existingFetch = inFlightLyricsFetches.get(fetchKey);
  if (existingFetch) {
    if (isCurrentTrack(uri) && !options.keepCurrentLyricsVisible) ShowLoaderContainer(uri);
    const result = await existingFetch;
    return isCurrentTrack(uri) ? result : null;
  }

  const promise = fetchLyricsInternal(uri, options);
  inFlightLyricsFetches.set(fetchKey, promise);
  try {
    const result = await promise;
    return isCurrentTrack(uri) ? result : null;
  } finally {
    if (inFlightLyricsFetches.get(fetchKey) === promise) {
      inFlightLyricsFetches.delete(fetchKey);
    }
  }
}

async function fetchLyricsInternal(
  uri: string,
  options: FetchLyricsOptions
): Promise<[object | string, number] | null> {
  lyricsLogger.debug("Fetch requested", uri);
  const LyricsContent =
    PageContainer?.querySelector(".LyricsContainer .LyricsContent") ?? undefined;
  if (LyricsContent?.classList.contains("offline")) {
    LyricsContent.classList.remove("offline");
  }

  if (SpotifyPlayer.IsDJ()) {
    finishFetching(uri);
    return ["dj", 400];
  }

  const mediaType = SpotifyPlayer.GetMediaType();

  if (mediaType && mediaType !== "audio") {
    $currentlyFetching.set(false);
    if (mediaType === "video") {
      return ["video-track", 400];
    } else if (mediaType === "mixed") {
      return ["mixed-track", 400];
    }
    return ["unknown-track", 400];
  }

  const isLocalTrack = uri.startsWith("spotify:local:");
  const contentType = SpotifyPlayer.GetContentType();
  if (!isLocalTrack && contentType !== "track") {
    $currentlyFetching.set(false);
    if (contentType === "episode") {
      return ["episode-track", 400];
    }
    return ["unknown-track", 400];
  }

  const songKey = getSongKey(uri);
  const trackId = isLocalTrack ? songKey : uri.split(":")[2];

  if (isCurrentTrack(uri)) $currentlyFetching.set(true);

  if (isCurrentTrack(uri) && !options.keepCurrentLyricsVisible) {
    LyricsContent?.classList.add("HiddenTransitioned");
    ShowLoaderContainer(uri);
  }


  // Check if there's already data in localStorage
  const savedLyricsData = $currentLyricsData.get();

  if (savedLyricsData && !isDev) {
    try {
      if (savedLyricsData.startsWith("NO_LYRICS:")) {
        const savedUri = savedLyricsData.slice("NO_LYRICS:".length);
        if ((savedUri === uri || getSongKey(savedUri) === trackId) && getActiveLyricsSourceOrder().length <= 1) {
          finishFetching(uri);
          HideLoaderContainer(uri);
          return ["lyrics-not-found", 404];
        }
      } else {
        const lyricsData = JSON.parse(savedLyricsData);
        // Return the stored lyrics if the ID matches the track ID
        if ((lyricsData?.id === trackId || lyricsData?.uri === uri) && isLyricsCacheCompatible(lyricsData)) {
          if (isCurrentTrack(uri) && !options.keepCurrentLyricsVisible) UpdateLoadingLyricsTemplate(lyricsData, uri);
          const preparedLyrics = await prepareLyricsForPresentation(lyricsData);
          await presentLyrics(uri, preparedLyrics);
          return [preparedLyrics, 200];
        }
      }
    } catch (error) {
      lyricsCacheLogger.error("Error parsing saved lyrics data", error);
      finishFetching(uri);
      HideLoaderContainer(uri);
    }
  }

  const sessionLyric = songKey ? SessionTTMLStore.get(songKey) : undefined;
  if (sessionLyric) {
    return presentStoredLyrics(uri, { ...sessionLyric, id: trackId, fromCache: true }, options);
  }

  const localLyric = await LocalLyricsManager.get(uri);
  if (localLyric) {
    return presentStoredLyrics(uri, { ...localLyric, id: trackId }, options);
  }

  // Local files have no real track id (uri.split(":")[2] is the URL-encoded
  // artist name), so they can't be looked up in LyricsStore or fetched from the
  // API. Bail out here — after LocalLyricsManager.get() (which serves any
  // user-uploaded TTML) but before the meaningless remote cache read.
  if (isLocalTrack) {
    finishFetching(uri);
    HideLoaderContainer(uri);
    return ["local-track", 400];
  }

  if (LyricsStore) {
    try {
      const lyricsFromCache = await LyricsStore.GetItem(trackId);
      if (lyricsFromCache) {
        if (lyricsFromCache.Value === "NO_LYRICS") {
          finishFetching(uri);
          HideLoaderContainer(uri);
          return ["lyrics-not-found", 404];
        }
        if (isLyricsCacheCompatible(lyricsFromCache)) {
          return await presentStoredLyrics(uri, { ...lyricsFromCache, fromCache: true }, options);
        }
        void LyricsStore.RemoveItem(trackId).catch(() => {});
      }
    } catch (error) {
      lyricsCacheLogger.error("Error parsing cache entry", error);
      finishFetching(uri);
      HideLoaderContainer(uri);
      return ["unknown-error", 0];
    }
  }


  if (!navigator.onLine) {
    finishFetching(uri);
    HideLoaderContainer(uri);
    return ["offline", 400];
  }

  try {
    const providerResult = await fetchLyricsFromProviders(
      uri,
      getActiveLyricsSourceOrder(),
      {
        onFirstLyrics: (lyrics) => {
          if (isCurrentTrack(uri)) UpdateLoadingLyricsTemplate(lyrics, uri);
        },
      }
    );
    const lyrics = providerResult?.lyrics;

    if (lyrics === null || lyrics === undefined || lyrics === "") {
      HideLoaderContainer(uri);
      finishFetching(uri);
      return ["lyrics-not-found", 404];
    }

    await ProcessLyrics(lyrics);

    const lyricsWithId = attachLyricsSourceCacheMetadata({ ...lyrics, id: trackId });
    if (isCurrentTrack(uri)) $currentLyricsData.set(JSON.stringify(lyricsWithId));

    if (LyricsStore) {
      try {
        await LyricsStore.SetItem(trackId, lyricsWithId);
      } catch (error) {
        lyricsCacheLogger.error("Error saving lyrics to cache", error);
      }
    }

    await presentLyrics(uri, lyricsWithId);
    return [{ ...lyricsWithId, fromCache: false }, 200];
  } catch (error) {
    lyricsLogger.error("Error fetching lyrics", error);
    finishFetching(uri);
    HideLoaderContainer(uri);
    return ["unknown-error", 0];
  }
}

/**
 * Clear the lyrics container content
 */
export function ClearLyricsPageContainer(): void {
  const lyricsContent = PageContainer?.querySelector<HTMLElement>(
    ".LyricsContainer .LyricsContent"
  );
  if (lyricsContent) {
    lyricsContent.innerHTML = "";
  }
  PageContainer?.querySelector<HTMLElement>(".LyricsContainer .LyricsPinnedFooter")?.replaceChildren();
}
