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
let loaderHideTimeout: ReturnType<typeof setTimeout> | null = null;
let resolveLoaderHide: (() => void) | null = null;
let loaderOwnerUri: string | null = null;
let loaderTransitionId = 0;

function isCurrentTrack(uri: string): boolean {
  return SpotifyPlayer.GetUri() === uri;
}

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
  //if (!PageContainer) return;
  const LyricsContent =
    PageContainer?.querySelector(".LyricsContainer .LyricsContent") ?? undefined;
  if (LyricsContent?.classList.contains("offline")) {
    LyricsContent.classList.remove("offline");
  }

  //if (!Fullscreen.IsOpen) PageView.AppendViewControls(true);

  if (SpotifyPlayer.IsDJ()) {
    finishFetching(uri);
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

  if (isCurrentTrack(uri)) $currentlyFetching.set(true);

  if (isCurrentTrack(uri) && !options.keepCurrentLyricsVisible) {
    LyricsContent?.classList.add("HiddenTransitioned");
    ShowLoaderContainer(uri);
  }


  // Check if there's already data in localStorage
  const savedLyricsData = $currentLyricsData.get();

  if (savedLyricsData && !isDev) {
    try {
      if (savedLyricsData.includes("NO_LYRICS")) {
        const split = savedLyricsData.split(":");
        const id = split[1];
        if (id === trackId && getActiveLyricsSourceOrder().length <= 1) {
          finishFetching(uri);
          HideLoaderContainer(uri);
          return ["lyrics-not-found", 404];
        }
      } else {
        const lyricsData = JSON.parse(savedLyricsData);
        // Return the stored lyrics if the ID matches the track ID
        if (lyricsData?.id === trackId && isLyricsCacheCompatible(lyricsData)) {
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

  if (songKey && SessionTTMLStore.has(songKey)) {
    const sessionLyric = SessionTTMLStore.get(songKey);
    if (sessionLyric) {
      const lyricsData = { ...sessionLyric, id: trackId, fromCache: true };
      if (isCurrentTrack(uri) && !options.keepCurrentLyricsVisible) UpdateLoadingLyricsTemplate(lyricsData, uri);
      const preparedLyrics = await prepareLyricsForPresentation(lyricsData);
      if (isCurrentTrack(uri)) $currentLyricsData.set(JSON.stringify(preparedLyrics));
      await presentLyrics(uri, preparedLyrics);
      return [preparedLyrics, 200];
    }
  }

  const localLyric = await LocalLyricsManager.get(uri);
  if (localLyric) {
    const lyricsData = { ...localLyric, id: trackId };
    if (isCurrentTrack(uri) && !options.keepCurrentLyricsVisible) UpdateLoadingLyricsTemplate(lyricsData, uri);
    const preparedLyrics = await prepareLyricsForPresentation(lyricsData);
    if (isCurrentTrack(uri)) $currentLyricsData.set(JSON.stringify(preparedLyrics));
    await presentLyrics(uri, preparedLyrics);
    return [preparedLyrics, 200];
  }

  // Local files have no real track id (uri.split(":")[2] is the URL-encoded
  // artist name), so they can't be looked up in LyricsStore or fetched from the
  // API. Bail out here — after LocalLyricsManager.get() (which serves any
  // user-uploaded TTML) but before the meaningless remote cache read.
  if (uri.startsWith("spotify:local:")) {
    finishFetching(uri);
    HideLoaderContainer(uri);
    return ["local-track", 400];
  }

  if (LyricsStore) {
    try {
      const lyricsFromCacheRes = await LyricsStore.GetItem(trackId);
      if (lyricsFromCacheRes) {
        if (lyricsFromCacheRes?.Value === "NO_LYRICS") {
          finishFetching(uri);
          HideLoaderContainer(uri);
          return ["lyrics-not-found", 404];
        }
        const lyricsFromCache = lyricsFromCacheRes ?? {};
        if (!isLyricsCacheCompatible(lyricsFromCache)) {
          void LyricsStore.RemoveItem(trackId).catch(() => {});
          throw { isOutdatedLyricsCache: true };
        }
        if (isCurrentTrack(uri) && !options.keepCurrentLyricsVisible) UpdateLoadingLyricsTemplate(lyricsFromCache, uri);
        const preparedLyrics = await prepareLyricsForPresentation({
          ...lyricsFromCache,
          fromCache: true,
        });
        if (isCurrentTrack(uri)) $currentLyricsData.set(JSON.stringify(preparedLyrics));
        await presentLyrics(uri, preparedLyrics);
        return [preparedLyrics, 200];
      }
    } catch (error) {
      if ((error as any)?.isOutdatedLyricsCache) {
        // fall through to fresh provider fetch
      } else {
      lyricsCacheLogger.error("Error parsing cache entry", error);
      finishFetching(uri);
      HideLoaderContainer(uri);
      return ["unknown-error", 0];
      }
    }
  }


  if (!navigator.onLine) {
    finishFetching(uri);
    HideLoaderContainer(uri);
    return ["offline", 400];
  }

  // Fetch new lyrics if no match in localStorage
  /* const lyricsApi = storage.get("customLyricsApi") ?? Defaults.LyricsContent.api.url;
    const lyricsAccessToken = storage.get("lyricsApiAccessToken") ?? Defaults.LyricsContent.api.accessToken; */

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

export const LYRICS_QUEUE_MESSAGE =
  "Your request is in the queue - hang tight, your lyrics are on the way!";

function getLoadingLineText(line: any): string {
  if (typeof line?.Text === "string") return line.Text.trim();
  if (!Array.isArray(line?.Lead?.Syllables)) return "";
  return line.Lead.Syllables
    .map((syllable: any) => typeof syllable?.Text === "string" ? syllable.Text : "")
    .join("")
    .trim();
}

function getLoadingLineStart(line: any): number | null {
  const start = line?.StartTime ?? line?.Lead?.StartTime;
  return typeof start === "number" && Number.isFinite(start) ? start : null;
}

function getLoadingLineEnd(line: any): number | null {
  const end = line?.EndTime ?? line?.Lead?.EndTime;
  return typeof end === "number" && Number.isFinite(end) ? end : null;
}

function splitLoadingLine(text: string, maxCharacters: number = 26): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  if (words.length === 1) {
    const characters = Array.from(words[0]);
    return Array.from({ length: Math.ceil(characters.length / maxCharacters) }, (_, index) =>
      characters.slice(index * maxCharacters, (index + 1) * maxCharacters).join("")
    );
  }

  const segments: string[] = [];
  let segment = "";
  for (const word of words) {
    const next = segment ? `${segment} ${word}` : word;
    if (segment && next.length > maxCharacters) {
      segments.push(segment);
      segment = word;
      continue;
    }
    segment = next;
  }
  if (segment) segments.push(segment);
  return segments;
}

function resetLoadingLyricsTemplate(loaderContainer: HTMLElement): void {
  loaderContainer.querySelectorAll<HTMLElement>(".LyricsLoadingBlobs span").forEach((blob) => {
    blob.style.removeProperty("--LyricsLoadingBlobWidth");
    blob.style.removeProperty("--LyricsLoadingBlobGap");
  });
}

function UpdateLoadingLyricsTemplate(lyrics: any, uri: string): void {
  if (loaderOwnerUri !== uri || !isCurrentTrack(uri)) return;
  const loaderContainer = PageContainer?.querySelector<HTMLElement>(
    ".LyricsContainer .loaderContainer.active:not(.queued)"
  );
  const content = Array.isArray(lyrics?.Content) ? lyrics.Content : [];
  const blobs = loaderContainer?.querySelectorAll<HTMLElement>(".LyricsLoadingBlobs span");
  if (!loaderContainer || !blobs?.length || !content.length) return;

  const lines = content
    .map((line: any) => ({
      text: getLoadingLineText(line),
      start: getLoadingLineStart(line),
      end: getLoadingLineEnd(line),
    }))
    .filter((line: { text: string }) => line.text.length > 0);
  if (!lines.length) return;

  const playbackSeconds = SpotifyPlayer.GetPosition() / 1000;
  const currentLineIndex = lines.findIndex((line: { start: number | null; end: number | null }) =>
    line.start !== null && (line.end ?? line.start) >= playbackSeconds
  );
  const previewStart = Math.max(0, currentLineIndex < 0 ? 0 : currentLineIndex - 2);
  const previewLines = lines.slice(previewStart, previewStart + blobs.length);
  const previewBlocks = previewLines
    .flatMap((line: { text: string; start: number | null; end: number | null }, lineIndex: number) => {
      const segments = splitLoadingLine(line.text);
      const previous = previewLines[lineIndex - 1];
      const previousEnd = previous?.end ?? previous?.start;
      const gapSeconds =
        lineIndex > 0 && line.start !== null && previousEnd !== null
          ? Math.max(0, line.start - previousEnd)
          : 0;

      return segments.map((text, segmentIndex) => ({
        text,
        gap: segmentIndex === 0 ? Math.min(gapSeconds * 8, 28) : 7,
      }));
    })
    .slice(0, blobs.length);
  const longestBlock = Math.max(...previewBlocks.map((block) => block.text.length), 1);

  blobs.forEach((blob, index) => {
    const block = previewBlocks[index];
    if (!block) {
      blob.style.setProperty("--LyricsLoadingBlobWidth", "0%");
      return;
    }

    const width = Math.round(25 + (block.text.length / longestBlock) * 68);
    blob.style.setProperty("--LyricsLoadingBlobWidth", `${Math.min(width, 92)}%`);
    blob.style.setProperty("--LyricsLoadingBlobGap", `${block.gap}px`);
  });
}

/**
 * Show lyric placeholders as soon as a remote fetch begins.
 */
function ShowLoaderContainer(uri: string): void {
  if (!isCurrentTrack(uri)) return;
  const loaderContainer = PageContainer?.querySelector<HTMLElement>(
    ".LyricsContainer .loaderContainer"
  );
  if (!loaderContainer) return;

  // The loader lives inside this pane, which is normally held hidden until lyrics
  // finish processing. Reveal it first so the loading state can actually render.
  const lyricsContainer = PageContainer?.querySelector<HTMLElement>(".ContentBox .LyricsContainer");
  lyricsContainer?.classList.remove("Hidden");
  lyricsContainer?.classList.add("LoadingLyrics");
  PageContainer?.querySelector<HTMLElement>(".ContentBox")?.classList.remove("LyricsHidden");
  if (loaderHideTimeout) clearTimeout(loaderHideTimeout);
  resolveLoaderHide?.();
  resolveLoaderHide = null;
  loaderHideTimeout = null;
  loaderTransitionId++;
  loaderOwnerUri = uri;
  loaderContainer.classList.remove("leaving");
  resetLoadingLyricsTemplate(loaderContainer);
  loaderContainer.classList.add("active");
}

export function ShowQueueLoader(message: string = LYRICS_QUEUE_MESSAGE): void {
  const uri = SpotifyPlayer.GetUri();
  if (!uri) return;
  const loaderContainer = PageContainer?.querySelector<HTMLElement>(
    ".LyricsContainer .loaderContainer"
  );
  if (!loaderContainer) return;

  PageContainer?.querySelector<HTMLElement>(".ContentBox .LyricsContainer")?.classList.add("LoadingLyrics");
  if (loaderHideTimeout) clearTimeout(loaderHideTimeout);
  resolveLoaderHide?.();
  resolveLoaderHide = null;
  loaderHideTimeout = null;
  loaderTransitionId++;
  loaderOwnerUri = uri;
  loaderContainer.classList.remove("leaving");
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
 * Fade the loader out before allowing the rendered lyrics to appear.
 */
function HideLoaderContainer(uri: string): Promise<void> {
  if (loaderOwnerUri !== uri) return Promise.resolve();
  const loaderContainer = PageContainer?.querySelector<HTMLElement>(
    ".LyricsContainer .loaderContainer"
  );
  if (!loaderContainer || !loaderContainer.classList.contains("active")) return Promise.resolve();

  const lyricsContainer = PageContainer?.querySelector<HTMLElement>(".ContentBox .LyricsContainer");
  if (loaderHideTimeout) clearTimeout(loaderHideTimeout);
  resolveLoaderHide?.();
  const transitionId = ++loaderTransitionId;
  loaderContainer.classList.add("leaving");
  return new Promise((resolve) => {
    resolveLoaderHide = resolve;
    loaderHideTimeout = setTimeout(() => {
      if (loaderOwnerUri === uri && loaderTransitionId === transitionId) {
        loaderContainer.classList.remove("active", "leaving", "queued");
        loaderContainer.querySelector(".loaderMessage")?.remove();
        lyricsContainer?.classList.remove("LoadingLyrics");
        loaderOwnerUri = null;
        loaderHideTimeout = null;
      }
      if (resolveLoaderHide === resolve) resolveLoaderHide = null;
      resolve();
    }, 450);
  });
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
