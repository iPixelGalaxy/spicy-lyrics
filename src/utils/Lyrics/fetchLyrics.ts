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

const lyricsLogger = new Logger("Lyrics Pipeline");
const lyricsCacheLogger = new Logger("Lyrics Cache");

export const LyricsStore = GetExpireStore<any>("SpicyLyrics_LyricsStore", 13, {
  Unit: "Days",
  Duration: 3,
}, isDev as true);

export const SessionTTMLStore = new Map<string, any>();
const LYRICS_SOURCE_CACHE_VERSION = 3;
const inFlightLyricsFetches = new Map<string, Promise<[object | string, number] | null>>();

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
  if (hasTransliterations) {
    PageContainer?.classList.add("Lyrics_RomanizationAvailable");
  } else {
    PageContainer?.classList.remove("Lyrics_RomanizationAvailable");
  }
}

/**
 * Shared "lyrics are ready" presentation: toggle the romanization class, hide the
 * loader, publish the type, reveal the containers and view controls, and clear the
 * fetching flag. Used by every successful return path.
 */
function presentLyrics(lyricsData: any): void {
  setRomanizationClass(lyricsData?.HasTransliterations);
  HideLoaderContainer();
  $currentLyricsType.set(lyricsData.Type);
  PageContainer?.querySelector<HTMLElement>(".ContentBox")?.classList.remove("LyricsHidden");
  PageContainer?.querySelector(".ContentBox .LyricsContainer")?.classList.remove("Hidden");
  PageView.AppendViewControls(true);
  $currentlyFetching.set(false);
}

export default async function fetchLyrics(uri: string): Promise<[object | string, number] | null> {
  const fetchKey = getSongKey(uri) || uri;
  const existingFetch = inFlightLyricsFetches.get(fetchKey);
  if (existingFetch) return existingFetch;

  const promise = fetchLyricsInternal(uri);
  inFlightLyricsFetches.set(fetchKey, promise);
  try {
    return await promise;
  } finally {
    if (inFlightLyricsFetches.get(fetchKey) === promise) {
      inFlightLyricsFetches.delete(fetchKey);
    }
  }
}

async function fetchLyricsInternal(uri: string): Promise<[object | string, number] | null> {
  lyricsLogger.debug("Fetch requested", uri);
  //if (!PageContainer) return;
  const LyricsContent =
    PageContainer?.querySelector(".LyricsContainer .LyricsContent") ?? undefined;
  if (LyricsContent?.classList.contains("offline")) {
    LyricsContent.classList.remove("offline");
  }

  //if (!Fullscreen.IsOpen) PageView.AppendViewControls(true);

  if (SpotifyPlayer.IsDJ()) {
    $currentlyFetching.set(false);
    return ["dj", 400];
  }

  const mediaType = SpotifyPlayer.GetMediaType();

  if (
    mediaType &&
    mediaType !== "audio"
  ) {
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

  if ($currentlyFetching.get()) {
    $currentlyFetching.set(false);
    return null;
  }

  $currentlyFetching.set(true);

  if (LyricsContent) {
    LyricsContent.classList.add("HiddenTransitioned");
  }


  // Check if there's already data in localStorage
  const savedLyricsData = $currentLyricsData.get();

  if (savedLyricsData && !isDev) {
    try {
      if (savedLyricsData.includes("NO_LYRICS")) {
        const split = savedLyricsData.split(":");
        const id = split[1];
        if (id === trackId && getActiveLyricsSourceOrder().length <= 1) {
          $currentlyFetching.set(false);
          return ["lyrics-not-found", 404];
        }
      } else {
        const lyricsData = JSON.parse(savedLyricsData);
        // Return the stored lyrics if the ID matches the track ID
        if (lyricsData?.id === trackId && isLyricsCacheCompatible(lyricsData)) {
          const preparedLyrics = await prepareLyricsForPresentation(lyricsData);
          presentLyrics(preparedLyrics);
          return [preparedLyrics, 200];
        }
      }
    } catch (error) {
      lyricsCacheLogger.error("Error parsing saved lyrics data", error);
      $currentlyFetching.set(false);
      HideLoaderContainer();
    }
  }

  if (songKey && SessionTTMLStore.has(songKey)) {
    const sessionLyric = SessionTTMLStore.get(songKey);
    if (sessionLyric) {
      const lyricsData = { ...sessionLyric, id: trackId, fromCache: true };
      const preparedLyrics = await prepareLyricsForPresentation(lyricsData);
      $currentLyricsData.set(JSON.stringify(preparedLyrics));
      presentLyrics(preparedLyrics);
      return [preparedLyrics, 200];
    }
  }

  const localLyric = await LocalLyricsManager.get(uri);
  if (localLyric) {
    const lyricsData = { ...localLyric, id: trackId };
    const preparedLyrics = await prepareLyricsForPresentation(lyricsData);
    $currentLyricsData.set(JSON.stringify(preparedLyrics));
    presentLyrics(preparedLyrics);
    return [preparedLyrics, 200];
  }

  // Local files have no real track id (uri.split(":")[2] is the URL-encoded
  // artist name), so they can't be looked up in LyricsStore or fetched from the
  // API. Bail out here — after LocalLyricsManager.get() (which serves any
  // user-uploaded TTML) but before the meaningless remote cache read.
  if (uri.startsWith("spotify:local:")) {
    $currentlyFetching.set(false);
    return ["local-track", 400];
  }

  if (LyricsStore) {
    try {
      const lyricsFromCacheRes = await LyricsStore.GetItem(trackId);
      if (lyricsFromCacheRes) {
        if (lyricsFromCacheRes?.Value === "NO_LYRICS") {
          $currentlyFetching.set(false);
          return ["lyrics-not-found", 404];
        }
        const lyricsFromCache = lyricsFromCacheRes ?? {};
        if (!isLyricsCacheCompatible(lyricsFromCache)) {
          void LyricsStore.RemoveItem(trackId).catch(() => {});
          throw { isOutdatedLyricsCache: true };
        }
        const preparedLyrics = await prepareLyricsForPresentation({
          ...lyricsFromCache,
          fromCache: true,
        });
        $currentLyricsData.set(JSON.stringify(preparedLyrics));
        presentLyrics(preparedLyrics);
        return [preparedLyrics, 200];
      }
    } catch (error) {
      if ((error as any)?.isOutdatedLyricsCache) {
        // fall through to fresh provider fetch
      } else {
      lyricsCacheLogger.error("Error parsing cache entry", error);
      $currentlyFetching.set(false);
      return ["unknown-error", 0];
      }
    }
  }


  if (!navigator.onLine) {
    $currentlyFetching.set(false);
    return ["offline", 400];
  }

  ShowLoaderContainer();

  // Fetch new lyrics if no match in localStorage
  /* const lyricsApi = storage.get("customLyricsApi") ?? Defaults.LyricsContent.api.url;
    const lyricsAccessToken = storage.get("lyricsApiAccessToken") ?? Defaults.LyricsContent.api.accessToken; */

  try {
    const providerResult = await fetchLyricsFromProviders(uri, getActiveLyricsSourceOrder());
    const lyrics = providerResult?.lyrics;

    if (lyrics === null || lyrics === undefined || lyrics === "") {
      HideLoaderContainer();
      $currentlyFetching.set(false);
      return ["lyrics-not-found", 404];
    }

    await ProcessLyrics(lyrics);

    const lyricsWithId = attachLyricsSourceCacheMetadata({ ...lyrics, id: trackId });
    $currentLyricsData.set(JSON.stringify(lyricsWithId));

    if (LyricsStore) {
      try {
        await LyricsStore.SetItem(trackId, lyricsWithId);
      } catch (error) {
        lyricsCacheLogger.error("Error saving lyrics to cache", error);
      }
    }

    presentLyrics(lyricsWithId);
    return [{ ...lyricsWithId, fromCache: false }, 200];
  } catch (error) {
    lyricsLogger.error("Error fetching lyrics", error);
    $currentlyFetching.set(false);
    HideLoaderContainer();
    return ["unknown-error", 0];
  }
}

let ContainerShowLoaderTimeout: ReturnType<typeof setTimeout> | null = null;

export const LYRICS_QUEUE_MESSAGE =
  "Your request is in the queue - hang tight, your lyrics are on the way!";

/**
 * Show the loader container after a delay
 */
function ShowLoaderContainer(): void {
  const loaderContainer = PageContainer?.querySelector<HTMLElement>(
    ".LyricsContainer .loaderContainer"
  );
  if (loaderContainer) {
    ContainerShowLoaderTimeout = setTimeout(() => {
      loaderContainer.classList.add("active");
    }, 2000);
  }
}

export function ShowQueueLoader(message: string = LYRICS_QUEUE_MESSAGE): void {
  const loaderContainer = PageContainer?.querySelector<HTMLElement>(
    ".LyricsContainer .loaderContainer"
  );
  if (!loaderContainer) return;

  if (ContainerShowLoaderTimeout) {
    clearTimeout(ContainerShowLoaderTimeout);
    ContainerShowLoaderTimeout = null;
  }

  loaderContainer.classList.add("active", "queued");

  let messageEl = loaderContainer.querySelector<HTMLElement>(".loaderMessage");
  if (!messageEl) {
    messageEl = document.createElement("div");
    messageEl.className = "loaderMessage";
    loaderContainer.appendChild(messageEl);
  }
  messageEl.textContent = message;
}

/**
 * Hide the loader container and clear any pending timeout
 */
function HideLoaderContainer(): void {
  const loaderContainer = PageContainer?.querySelector<HTMLElement>(
    ".LyricsContainer .loaderContainer"
  );
  if (loaderContainer) {
    if (ContainerShowLoaderTimeout) {
      clearTimeout(ContainerShowLoaderTimeout);
      ContainerShowLoaderTimeout = null;
    }
    loaderContainer.classList.remove("active", "queued");
    loaderContainer.querySelector(".loaderMessage")?.remove();
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
}
