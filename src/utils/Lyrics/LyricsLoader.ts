import { PageContainer } from "../../components/Pages/PageView.ts";
import { SpotifyPlayer } from "../../components/Global/SpotifyPlayer.ts";
import { isCurrentTrack } from "./Sources/Track.ts";
import { IsLyricsSkeletonEnabled } from "./LyricsSkeleton.ts";
import { onExperimentChange } from "../experiments.ts";

export const LYRICS_QUEUE_MESSAGE = "Waiting for lyrics. Retrying automatically.";
const DEFAULT_LABEL = "Loading Lyrics";
const SPINNER_DELAY_MS = 2000;
let ownerUri: string | null = null;
let ownerContainer: HTMLElement | null = null;
let shownAt = 0;
let queuedMessage: string | null = null;
let transitionId = 0;
let revealTimer: number | null = null;
let revealWindow: Window | null = null;
let cancelHide: (() => void) | null = null;
let finishHide: (() => void) | null = null;

function cancelReveal(): void {
  if (revealTimer !== null) revealWindow?.clearTimeout(revealTimer);
  revealTimer = null;
  revealWindow = null;
}

function resetPresentation(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>(".loaderContainer, .LyricsSkeleton").forEach((el) => {
    el.classList.remove("active", "leaving", "queued", "LongLabel");
    el.setAttribute("aria-hidden", "true");
  });
  container.classList.remove("LoadingLyrics");
  container.querySelector(".LyricsContent")?.setAttribute("aria-busy", "false");
}

/** Cancel timers on their owning window before a page or track is replaced. */
export function ClearLyricsLoader(): void {
  transitionId++;
  cancelReveal();
  cancelHide?.();
  if (ownerContainer) resetPresentation(ownerContainer);
  ownerContainer = null;
  ownerUri = null;
  queuedMessage = null;
}

function showPresentation(immediateSpinner = false): void {
  const container = ownerContainer;
  const uri = ownerUri;
  if (!container || !uri) return;
  cancelReveal();
  const skeleton = container.querySelector<HTMLElement>(".LyricsSkeleton");
  const spinner = container.querySelector<HTMLElement>(".loaderContainer");
  const useSkeleton = IsLyricsSkeletonEnabled();
  const text = skeleton?.querySelector(".SkeletonLabel");
  if (text) text.textContent = queuedMessage ?? DEFAULT_LABEL;
  skeleton?.classList.toggle("LongLabel", queuedMessage !== null);
  skeleton?.classList.toggle("active", useSkeleton);
  skeleton?.classList.remove("leaving");
  skeleton?.setAttribute("aria-hidden", String(!useSkeleton));
  spinner?.classList.remove("active", "leaving");
  spinner?.classList.toggle("queued", queuedMessage !== null);
  spinner?.setAttribute("aria-hidden", "true");
  const message = spinner?.querySelector<HTMLElement>(".loaderMessage");
  if (message) {
    message.textContent = queuedMessage ?? "";
    message.hidden = queuedMessage === null;
  }
  if (useSkeleton || !spinner) return;
  const reveal = () => {
    revealTimer = null;
    revealWindow = null;
    if (ownerContainer !== container || ownerUri !== uri || !isCurrentTrack(uri)) return;
    spinner.classList.add("active");
    spinner.setAttribute("aria-hidden", "false");
  };
  const delay = immediateSpinner || queuedMessage ? 0 : Math.max(0, SPINNER_DELAY_MS - (performance.now() - shownAt));
  if (delay === 0) reveal();
  else {
    revealWindow = container.ownerDocument.defaultView ?? window;
    revealTimer = revealWindow.setTimeout(reveal, delay);
  }
}

export function ShowLoaderContainer(uri: string): void {
  if (!isCurrentTrack(uri)) return;
  const container = PageContainer?.querySelector<HTMLElement>(".LyricsContainer");
  if (!container) return;
  if (ownerUri !== uri || ownerContainer !== container) {
    ClearLyricsLoader();
    shownAt = performance.now();
  } else {
    cancelHide?.();
    transitionId++;
  }
  ownerUri = uri;
  ownerContainer = container;
  container.classList.remove("Hidden");
  container.classList.add("LoadingLyrics");
  container.querySelector(".LyricsContent")?.setAttribute("aria-busy", "true");
  container.querySelector(".LyricsPinnedFooter")?.replaceChildren();
  PageContainer?.querySelector(".ContentBox")?.classList.remove("LyricsHidden");
  showPresentation();
}

export function ShowQueueLoader(message = LYRICS_QUEUE_MESSAGE): void {
  const uri = SpotifyPlayer.GetUri();
  if (!uri) return;
  ShowLoaderContainer(uri);
  if (ownerUri !== uri) return;
  queuedMessage = message;
  showPresentation(true);
}

/** Paint before synchronous lyric construction, using the visible page's clock. */
export async function PaintLyricsLoader(uri: string): Promise<void> {
  if (!IsLyricsSkeletonEnabled() || !isCurrentTrack(uri)) return;
  ShowLoaderContainer(uri);
  const container = ownerContainer;
  if (!container || container.ownerDocument.hidden) return;
  const targetWindow = container.ownerDocument.defaultView ?? window;
  await new Promise<void>((resolve) => {
    let firstFrame: number | null = null;
    let secondFrame: number | null = null;
    const finish = () => {
      targetWindow.clearTimeout(fallback);
      if (firstFrame !== null) targetWindow.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) targetWindow.cancelAnimationFrame(secondFrame);
      targetWindow.removeEventListener("pagehide", finish);
      resolve();
    };
    const fallback = targetWindow.setTimeout(finish, 100);
    targetWindow.addEventListener("pagehide", finish, { once: true });
    firstFrame = targetWindow.requestAnimationFrame(() => {
      firstFrame = null;
      secondFrame = targetWindow.requestAnimationFrame(finish);
    });
  });
}

/** Superseded hides cannot clear a new load. */
export function HideLoaderContainer(uri: string): Promise<void> {
  const container = ownerContainer;
  if (ownerUri !== uri || !container) return Promise.resolve();
  cancelReveal();
  cancelHide?.();
  const id = ++transitionId;
  const targetWindow = container.ownerDocument.defaultView ?? window;
  const skin = container.querySelector<HTMLElement>(IsLyricsSkeletonEnabled() ? ".LyricsSkeleton" : ".loaderContainer");
  const skipFade = !skin?.classList.contains("active") || container.ownerDocument.hidden ||
    targetWindow.matchMedia("(prefers-reduced-motion: reduce)").matches || performance.now() - shownAt < 100;
  const exitMs = IsLyricsSkeletonEnabled() ? 250 : 140;
  return new Promise<void>((resolve) => {
    let timer: number | null = null;
    const cleanup = () => {
      if (timer !== null) targetWindow.clearTimeout(timer);
      skin?.removeEventListener("transitionend", onEnd);
      targetWindow.removeEventListener("pagehide", finish);
      if (cancelHide === cleanup) {
        cancelHide = null;
        finishHide = null;
      }
      resolve();
    };
    const finish = () => {
      if (id === transitionId && ownerUri === uri && ownerContainer === container) {
        resetPresentation(container);
        ownerUri = null;
        ownerContainer = null;
        queuedMessage = null;
      }
      cleanup();
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target === skin && event.propertyName === "opacity") finish();
    };
    cancelHide = cleanup;
    finishHide = finish;
    if (skipFade) { finish(); return; }
    skin?.classList.add("leaving");
    skin?.addEventListener("transitionend", onEnd);
    targetWindow.addEventListener("pagehide", finish, { once: true });
    timer = targetWindow.setTimeout(finish, exitMs + 50);
  });
}

onExperimentChange((experiment) => {
  if (experiment.id !== "lyricsSkeleton" || !ownerContainer) return;
  if (finishHide) finishHide();
  else showPresentation(true);
});
