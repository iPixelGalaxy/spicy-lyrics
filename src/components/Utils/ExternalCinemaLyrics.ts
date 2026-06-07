// deno-lint-ignore-file no-explicit-any
import PageView, { PageContainer } from "../Pages/PageView.ts";
import Fullscreen from "./Fullscreen.ts";
import { IsPIP } from "./PopupLyrics.ts";
import { isSpicySidebarMode, CloseSidebarLyrics } from "./SidebarLyrics.ts";
import Session from "../Global/Session.ts";
import Global from "../Global/Global.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { IsPlaying } from "../../utils/Addons.ts";
import { TickLyricsRenderer } from "../../utils/Lyrics/lyrics.ts";
import { ScrollToActiveLine } from "../../utils/Scrolling/ScrollToActiveLine.ts";
import { ScrollSimplebar } from "../../utils/Scrolling/Simplebar/ScrollSimplebar.ts";
import ApplyDynamicBackground, { KawarpMap } from "../DynamicBG/dynamicBackground.ts";

export let IsExternalCinemaLyrics = false;

let currentExternalWindow: Window | null = null;
let externalPageHideHandler: ((event: Event) => void) | null = null;
let hostPageHideHandler: ((event: Event) => void) | null = null;
let closingExternalWindow = false;
let externalPlaybackPump: number | null = null;
let externalPlaybackPumpLastUri: string | null = null;
let externalRenderFrame: number | null = null;

function getExternalPlayerPosition(): number {
  const state = (Spicetify.Player as any)?.origin?._state ?? Spicetify.Platform?.PlayerAPI?._state;
  const rawProgress = Number(Spicetify.Player.getProgress?.());
  if (!state) {
    if (Number.isFinite(rawProgress)) return rawProgress;
    return SpotifyPlayer.GetPosition() ?? 0;
  }

  const position = Number(state.positionAsOfTimestamp ?? state.position);
  const timestamp = Number(state.timestamp);
  const isPaused = Boolean(state.isPaused) || !Spicetify.Player.isPlaying();

  if (Number.isFinite(position)) {
    if (isPaused || !Number.isFinite(timestamp)) return position;
    return Math.max(0, position + (Date.now() - timestamp));
  }

  if (Number.isFinite(rawProgress)) return rawProgress;
  return SpotifyPlayer.GetPosition() ?? 0;
}

function startExternalRenderLoop(targetWindow: Window) {
  stopExternalRenderLoop();
  const renderLoop = () => {
    TickLyricsRenderer();
    KawarpMap.forEach((kawarpInstance) => {
      kawarpInstance.renderFrame();
    });
    externalRenderFrame = targetWindow.requestAnimationFrame(renderLoop);
  };
  externalRenderFrame = targetWindow.requestAnimationFrame(renderLoop);
}

function stopExternalRenderLoop() {
  if (externalRenderFrame === null) return;
  (currentExternalWindow ?? window).cancelAnimationFrame(externalRenderFrame);
  externalRenderFrame = null;
}

function startExternalPlaybackPump(targetWindow: Window) {
  stopExternalPlaybackPump();
  externalPlaybackPumpLastUri = SpotifyPlayer.GetUri() ?? null;
  externalPlaybackPump = targetWindow.setInterval(() => {
    const currentUri = SpotifyPlayer.GetUri() ?? null;
    SpotifyPlayer.IsPlaying = IsPlaying();
    if (ScrollSimplebar) ScrollToActiveLine(ScrollSimplebar);
    const position = getExternalPlayerPosition();
    Global.Event.evoke("playback:position", position);
    Global.Event.evoke("playback:progress", { data: { position } });

    if (currentUri !== externalPlaybackPumpLastUri) {
      externalPlaybackPumpLastUri = currentUri;
      Global.Event.evoke("playback:songchange", { data: Spicetify.Player.data });
      targetWindow.setTimeout(() => {
        const contentBox = PageContainer?.querySelector<HTMLElement>(".ContentBox");
        if (contentBox) void ApplyDynamicBackground(contentBox, "lpagebg");
      }, 500);
    }
  }, 250);
}

function stopExternalPlaybackPump() {
  if (externalPlaybackPump === null) return;
  (currentExternalWindow ?? window).clearInterval(externalPlaybackPump);
  externalPlaybackPump = null;
  externalPlaybackPumpLastUri = null;
}

async function copyLyricsWindowStyles(targetWindow: Window, wrapperClass: string) {
  Array.from(document.querySelectorAll('link[rel="stylesheet"]')).forEach((link: HTMLLinkElement) => {
    const href = link.getAttribute("href") || "";
    const classList = Array.from(link.classList || []);
    const isFont = href.startsWith("https://fonts.spikerko.org");
    const isLocalCss = /^\/[a-zA-Z]{2}.*\.css$/.test(href);
    const isUserCss = (
      (href.endsWith("colors.css") || href.endsWith("user.css")) &&
      classList.length === 1 &&
      classList[0] === "userCSS"
    );

    if (!link.href || (!isFont && !isLocalCss && !isUserCss)) return;

    const externalLink = targetWindow.document.createElement("link");
    externalLink.rel = "stylesheet";
    externalLink.type = link.type || "text/css";
    externalLink.media = link.media || "";
    externalLink.href = link.href;
    if (isUserCss) externalLink.className = link.className;
    targetWindow.document.head.appendChild(externalLink);
  });

  const spicyLyricsStyleElement = document.querySelector("#slstyles");
  let spicyLyricsStyleContent: string | null = null;

  if (spicyLyricsStyleElement) {
    if (spicyLyricsStyleElement.tagName.toLowerCase() === "link") {
      const href = spicyLyricsStyleElement.getAttribute("href");
      if (href) {
        try {
          const res = await fetch(href);
          if (res.ok) spicyLyricsStyleContent = await res.text();
        } catch {
          spicyLyricsStyleContent = null;
        }
      }
    } else if (spicyLyricsStyleElement.tagName.toLowerCase() === "style") {
      spicyLyricsStyleContent = spicyLyricsStyleElement.textContent;
    }
  }

  if (spicyLyricsStyleContent) {
    const newStyleElement = targetWindow.document.createElement("style");
    newStyleElement.textContent = spicyLyricsStyleContent;
    targetWindow.document.head.appendChild(newStyleElement);
  }

  const additionalStyling = document.getElementById("spicyLyrics-additionalStyling");
  if (additionalStyling) {
    const newAdditionalStyling = targetWindow.document.createElement("style");
    newAdditionalStyling.id = "spicyLyrics-additionalStyling";
    newAdditionalStyling.textContent = additionalStyling.textContent;
    targetWindow.document.head.appendChild(newAdditionalStyling);
  }

  const externalStyle = targetWindow.document.createElement("style");
  externalStyle.textContent = `
    html,
    body,
    .${wrapperClass} {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: #000;
    }
  `;
  targetWindow.document.head.appendChild(externalStyle);

  const customFont = document.documentElement.style.getPropertyValue("--spicy-custom-font");
  if (customFont) {
    targetWindow.document.documentElement.style.setProperty("--spicy-custom-font", customFont);
  }
}

export const OpenExternalCinemaLyrics = async () => {
  if (IsPIP) return;

  if (PageView.IsOpened && !IsExternalCinemaLyrics) {
    if (Fullscreen.IsOpen) {
      await Fullscreen.Close();
      Session.GoBack();
    } else if (isSpicySidebarMode) {
      await CloseSidebarLyrics();
    } else {
      await PageView.Destroy();
      Session.GoBack();
    }

    OpenExternalCinemaLyrics();
    return;
  }

  if (IsExternalCinemaLyrics && currentExternalWindow && !currentExternalWindow.closed) {
    currentExternalWindow.focus();
    return;
  }

  if (PageView.IsOpened) return;

  const externalWindow = window.open(
    "",
    "SpicyLyricsCinema",
    "popup=yes,width=1280,height=720"
  );
  if (!externalWindow) return;

  currentExternalWindow = externalWindow;
  externalWindow.document.open();
  externalWindow.document.write(`<!doctype html><html><head></head><body><div class="spicy-external-cinema-wrapper"></div></body></html>`);
  externalWindow.document.close();
  await copyLyricsWindowStyles(externalWindow, "spicy-external-cinema-wrapper");

  const externalWrapper = externalWindow.document.body.querySelector(
    ".spicy-external-cinema-wrapper"
  ) as HTMLElement;

  IsExternalCinemaLyrics = true;
  PageView.Open(externalWrapper);
  PageContainer?.classList.add("ExternalCinemaMode");
  Fullscreen.Open(true, false);
  startExternalRenderLoop(externalWindow);
  startExternalPlaybackPump(externalWindow);
  externalWindow.focus();

  externalPageHideHandler = () => {
    if (!closingExternalWindow) CloseExternalCinemaLyrics(false);
  };
  hostPageHideHandler = () => {
    if (!closingExternalWindow) void CloseExternalCinemaLyrics(true);
  };
  externalWindow.addEventListener("pagehide", externalPageHideHandler);
  window.addEventListener("pagehide", hostPageHideHandler);
  window.addEventListener("beforeunload", hostPageHideHandler);
};

export const CloseExternalCinemaLyrics = async (closeWindow = true) => {
  if (!IsExternalCinemaLyrics) return;

  closingExternalWindow = true;

  if (Fullscreen.IsOpen) await Fullscreen.Close(true);
  await PageView.Destroy();
  stopExternalRenderLoop();
  stopExternalPlaybackPump();

  if (currentExternalWindow && externalPageHideHandler) {
    currentExternalWindow.removeEventListener("pagehide", externalPageHideHandler);
  }
  externalPageHideHandler = null;
  if (hostPageHideHandler) {
    window.removeEventListener("pagehide", hostPageHideHandler);
    window.removeEventListener("beforeunload", hostPageHideHandler);
  }
  hostPageHideHandler = null;

  if (closeWindow && currentExternalWindow && !currentExternalWindow.closed) {
    currentExternalWindow.close();
  }

  currentExternalWindow = null;
  IsExternalCinemaLyrics = false;
  closingExternalWindow = false;
};
