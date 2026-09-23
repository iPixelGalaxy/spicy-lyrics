import { PageContainer } from "../../components/Pages/PageView.ts";
import { SpotifyPlayer } from "../../components/Global/SpotifyPlayer.ts";
import { isCurrentTrack } from "./Sources/Track.ts";
import Defaults from "../../components/Global/Defaults.ts";
import { isRomanized } from "./lyrics.ts";
import { PickDisplayText } from "./Applyer/Utils/PickDisplayText.ts";
import isRtl from "./isRtl.ts";

let loaderHideTimeout: ReturnType<Window["setTimeout"]> | null = null;
let loaderHideWindow: Window | null = null;
let resolveLoaderHide: (() => void) | null = null;
let removeLoaderHideListeners: (() => void) | null = null;
let loaderOwnerUri: string | null = null;
let loaderTransitionId = 0;
let loaderShownAt = 0;
const LOADER_EXIT_MS = 140;

export const LYRICS_QUEUE_MESSAGE =
  "Waiting for lyrics. Retrying automatically.";

function getLoadingLineText(line: any): string {
  const text = PickDisplayText(line, isRomanized);
  if (typeof text === "string" && text.trim()) return text.trim();
  if (!Array.isArray(line?.Lead?.Syllables)) return "";
  return line.Lead.Syllables
    .map((syllable: any) => PickDisplayText(syllable, isRomanized))
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
    blob.hidden = false;
    blob.classList.toggle("OppositeAligned", Defaults.RightAlignLyrics);
  });
}

export function UpdateLoadingLyricsTemplate(lyrics: any, uri: string): void {
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
      opposite: Boolean(line?.OppositeAligned) !== Defaults.RightAlignLyrics,
    }))
    .filter((line: { text: string }) => line.text.length > 0);
  if (!lines.length) return;

  const playbackSeconds = SpotifyPlayer.GetPosition() / 1000;
  const currentLineIndex = lines.findIndex((line: { start: number | null; end: number | null }) =>
    line.start !== null && (line.end ?? line.start) >= playbackSeconds
  );
  const previewStart = Math.max(0, currentLineIndex < 0 ? 0 : currentLineIndex - 3);
  const previewLines = lines.slice(previewStart, previewStart + blobs.length);
  const previewBlocks = previewLines
    .flatMap((line: { text: string; start: number | null; end: number | null; opposite: boolean }, lineIndex: number) => {
      const segments = splitLoadingLine(line.text);
      const previous = previewLines[lineIndex - 1];
      const previousEnd = previous?.end ?? previous?.start;
      const gapSeconds =
        lineIndex > 0 && line.start !== null && previousEnd != null
          ? Math.max(0, line.start - previousEnd)
          : 0;

      return segments.map((text, segmentIndex) => ({
        text,
        gap: segmentIndex === 0 ? Math.min(gapSeconds * 8, 28) : 7,
        opposite: line.opposite !== isRtl(line.text),
      }));
    })
    .slice(0, blobs.length);
  const longestBlock = Math.max(...previewBlocks.map((block) => Array.from(block.text).length), 1);

  blobs.forEach((blob, index) => {
    const block = previewBlocks[index];
    blob.hidden = !block;
    if (!block) {
      return;
    }

    const width = Math.round(25 + (Array.from(block.text).length / longestBlock) * 68);
    blob.style.setProperty("--LyricsLoadingBlobWidth", `${Math.min(width, 92)}%`);
    blob.style.setProperty("--LyricsLoadingBlobGap", `${block.gap}px`);
    blob.classList.toggle("OppositeAligned", block.opposite);
  });
}

/**
 * Show lyric placeholders as soon as a remote fetch begins.
 */
export function ShowLoaderContainer(uri: string): void {
  if (!isCurrentTrack(uri)) return;
  const loaderContainer = PageContainer?.querySelector<HTMLElement>(
    ".LyricsContainer .loaderContainer"
  );
  if (!loaderContainer) return;

  beginLoading(uri, loaderContainer);
  resetLoadingLyricsTemplate(loaderContainer);
  // Automatic retries retain the queue message until they actually resolve.
  setLoaderMessage(loaderContainer, loaderContainer.classList.contains("queued") ? LYRICS_QUEUE_MESSAGE : "Loading lyrics");
}

export function ShowQueueLoader(message: string = LYRICS_QUEUE_MESSAGE): void {
  const uri = SpotifyPlayer.GetUri();
  if (!uri) return;
  const loaderContainer = PageContainer?.querySelector<HTMLElement>(
    ".LyricsContainer .loaderContainer"
  );
  if (!loaderContainer) return;

  beginLoading(uri, loaderContainer);
  loaderContainer.classList.add("queued");
  resetLoadingLyricsTemplate(loaderContainer);
  setLoaderMessage(loaderContainer, message);
}

function setLoaderMessage(loaderContainer: HTMLElement, message: string): void {
  const messageEl = loaderContainer.querySelector<HTMLElement>(".loaderMessage");
  if (messageEl && messageEl.textContent !== message) messageEl.textContent = message;
}

function cancelLoaderHide(): void {
  if (loaderHideTimeout !== null) {
    (loaderHideWindow ?? window).clearTimeout(loaderHideTimeout);
  }
  removeLoaderHideListeners?.();
  removeLoaderHideListeners = null;
  resolveLoaderHide?.();
  resolveLoaderHide = null;
  loaderHideTimeout = null;
  loaderHideWindow = null;
}

export function ClearLyricsLoader(): void {
  cancelLoaderHide();
  loaderTransitionId++;
  loaderOwnerUri = null;
}

function beginLoading(uri: string, loaderContainer: HTMLElement): void {
  const newLoad = loaderOwnerUri !== uri || !loaderContainer.classList.contains("active");
  cancelLoaderHide();
  loaderTransitionId++;
  loaderOwnerUri = uri;
  if (newLoad) {
    loaderShownAt = performance.now();
    loaderContainer.classList.remove("queued");
  }
  // Both fetching and queued views must reveal a pane hidden by the last track.
  const lyricsContainer = loaderContainer.closest<HTMLElement>(".LyricsContainer");
  lyricsContainer?.classList.remove("Hidden");
  lyricsContainer?.classList.add("LoadingLyrics");
  lyricsContainer?.querySelector(".LyricsContent")?.setAttribute("aria-busy", "true");
  lyricsContainer?.querySelector(".LyricsPinnedFooter")?.replaceChildren();
  PageContainer?.querySelector(".ContentBox")?.classList.remove("LyricsHidden");
  loaderContainer.classList.remove("leaving");
  loaderContainer.classList.add("active");
  loaderContainer.setAttribute("aria-hidden", "false");
}

/**
 * Fade the loader out before allowing the rendered lyrics to appear.
 */
export function HideLoaderContainer(uri: string): Promise<void> {
  if (loaderOwnerUri !== uri) return Promise.resolve();
  const loaderContainer = PageContainer?.querySelector<HTMLElement>(
    ".LyricsContainer .loaderContainer"
  );
  if (!loaderContainer || !loaderContainer.classList.contains("active")) return Promise.resolve();

  const lyricsContainer = loaderContainer.closest<HTMLElement>(".LyricsContainer");
  const ownerWindow = loaderContainer.ownerDocument.defaultView ?? window;
  const skipFade = ownerWindow.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    loaderContainer.ownerDocument.hidden || performance.now() - loaderShownAt < 100;
  cancelLoaderHide();
  const transitionId = ++loaderTransitionId;
  loaderContainer.classList.add("leaving");
  return new Promise((resolve) => {
    resolveLoaderHide = resolve;
    const finish = () => {
      if (loaderTransitionId !== transitionId) return;
      if (loaderOwnerUri === uri && loaderTransitionId === transitionId) {
        loaderContainer.classList.remove("active", "leaving", "queued");
        loaderContainer.setAttribute("aria-hidden", "true");
        setLoaderMessage(loaderContainer, "");
        lyricsContainer?.classList.remove("LoadingLyrics");
        lyricsContainer?.querySelector(".LyricsContent")?.setAttribute("aria-busy", "false");
        loaderOwnerUri = null;
      }
      cancelLoaderHide();
    };
    if (skipFade) {
      finish();
      return;
    }
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target === loaderContainer && event.propertyName === "opacity") finish();
    };
    loaderContainer.addEventListener("transitionend", onTransitionEnd);
    ownerWindow.addEventListener("pagehide", finish, { once: true });
    removeLoaderHideListeners = () => {
      loaderContainer.removeEventListener("transitionend", onTransitionEnd);
      ownerWindow.removeEventListener("pagehide", finish);
    };
    // Transition events follow the visible popout's frame clock even when the
    // Spotify host is hidden. The timeout also settles detached or unpainted views.
    loaderHideWindow = ownerWindow;
    loaderHideTimeout = ownerWindow.setTimeout(finish, LOADER_EXIT_MS + 50);
  });
}
