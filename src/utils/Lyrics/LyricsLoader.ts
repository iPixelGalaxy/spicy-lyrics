import { PageContainer } from "../../components/Pages/PageView.ts";
import { SpotifyPlayer } from "../../components/Global/SpotifyPlayer.ts";
import { isCurrentTrack } from "./Sources/Track.ts";

let loaderHideTimeout: ReturnType<typeof setTimeout> | null = null;
let resolveLoaderHide: (() => void) | null = null;
let loaderOwnerUri: string | null = null;
let loaderTransitionId = 0;

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
export function ShowLoaderContainer(uri: string): void {
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
  lyricsContainer?.querySelector<HTMLElement>(".LyricsPinnedFooter")?.replaceChildren();
  PageContainer?.querySelector<HTMLElement>(".ContentBox")?.classList.remove("LyricsHidden");
  beginLoading(uri, loaderContainer);
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
  beginLoading(uri, loaderContainer);
  loaderContainer.classList.add("active", "queued");

  let messageEl = loaderContainer.querySelector<HTMLElement>(".loaderMessage");
  if (!messageEl) {
    messageEl = document.createElement("div");
    messageEl.className = "loaderMessage";
    loaderContainer.appendChild(messageEl);
  }
  messageEl.textContent = message;
}

function beginLoading(uri: string, loaderContainer: HTMLElement): void {
  if (loaderHideTimeout) clearTimeout(loaderHideTimeout);
  resolveLoaderHide?.();
  resolveLoaderHide = null;
  loaderHideTimeout = null;
  loaderTransitionId++;
  loaderOwnerUri = uri;
  loaderContainer.classList.remove("leaving");
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
    }, 150);
  });
}
