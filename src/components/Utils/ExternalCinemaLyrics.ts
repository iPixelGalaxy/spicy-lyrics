// deno-lint-ignore-file no-explicit-any
import PageView, { PageContainer } from "../Pages/PageView.ts";
import Fullscreen from "./Fullscreen.ts";
import { IsPIP } from "./PopupLyrics.ts";
import { DeRenderNPVCard, NPVCardOwnsPage, RequestNPVCardEvaluate } from "./NPVLyrics.ts";
import Session from "../Global/Session.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { ScrollToActiveLine } from "../../utils/Scrolling/ScrollToActiveLine.ts";
import { ScrollSimplebar } from "../../utils/Scrolling/Simplebar/ScrollSimplebar.ts";
import ApplyDynamicBackground, { KawarpMap } from "../DynamicBG/dynamicBackground.ts";

export let IsExternalCinemaLyrics = false;
export let IsExternalCinemaOpening = false;

type CinemaSession = {
  window: Window;
  cancelled: boolean;
  renderFrame: number | null;
  playbackPump: number | null;
  lastUri: string | null;
  externalPageHideHandler: (event: Event) => void;
};

let currentSession: CinemaSession | null = null;
let hostPageHideHandler: ((event: Event) => void) | null = null;
let externalCinemaOpenPromise: Promise<void> | null = null;
let externalCinemaClosePromise: Promise<void> | null = null;

const isCurrent = (session: CinemaSession) =>
  currentSession === session && !session.cancelled && !session.window.closed;

function stopSessionLoops(session: CinemaSession): void {
  if (session.renderFrame !== null) {
    try { session.window.cancelAnimationFrame(session.renderFrame); } catch { /* closed window */ }
    session.renderFrame = null;
  }
  if (session.playbackPump !== null) {
    try { session.window.clearInterval(session.playbackPump); } catch { /* closed window */ }
    session.playbackPump = null;
  }
}

function startSessionLoops(session: CinemaSession): void {
  const renderLoop = () => {
    if (!isCurrent(session)) return;
    try {
      // Kawarp owns its normal loop. Only drive the popout page background here.
      KawarpMap.get("lpagebg")?.renderFrame();
    } catch (error) {
      console.warn("Cinema background frame failed", error);
    } finally {
      if (isCurrent(session)) session.renderFrame = session.window.requestAnimationFrame(renderLoop);
    }
  };
  session.renderFrame = session.window.requestAnimationFrame(renderLoop);

  session.lastUri = SpotifyPlayer.GetUri() ?? null;
  session.playbackPump = session.window.setInterval(() => {
    if (!isCurrent(session)) return;
    try {
      if (ScrollSimplebar) ScrollToActiveLine(ScrollSimplebar);
      const uri = SpotifyPlayer.GetUri() ?? null;
      if (uri !== session.lastUri) {
        session.lastUri = uri;
        session.window.setTimeout(() => {
          if (!isCurrent(session)) return;
          const contentBox = PageContainer?.querySelector<HTMLElement>(".ContentBox");
          if (contentBox) void ApplyDynamicBackground(contentBox, "lpagebg");
        }, 250);
      }
    } catch (error) {
      console.warn("Cinema playback pump failed", error);
    }
  }, 250);
}

async function copyLyricsWindowStyles(targetWindow: Window, wrapperClass: string) {
  Array.from(document.querySelectorAll('link[rel="stylesheet"]')).forEach((link: HTMLLinkElement) => {
    const href = link.getAttribute("href") || "";
    const classList = Array.from(link.classList || []);
    const isFont = href.startsWith("https://fonts.spikerko.org");
    const isLocalCss = /^\/[a-zA-Z]{2}.*\.css$/.test(href);
    const isUserCss = (href.endsWith("colors.css") || href.endsWith("user.css")) && classList.length === 1 && classList[0] === "userCSS";
    if (!link.href || (!isFont && !isLocalCss && !isUserCss)) return;
    const externalLink = targetWindow.document.createElement("link");
    externalLink.rel = "stylesheet";
    externalLink.type = link.type || "text/css";
    externalLink.media = link.media || "";
    externalLink.href = link.href;
    if (isUserCss) externalLink.className = link.className;
    targetWindow.document.head.appendChild(externalLink);
  });

  const style = document.querySelector("#slstyles");
  let content: string | null = null;
  if (style?.tagName.toLowerCase() === "link") {
    const href = style.getAttribute("href");
    if (href) {
      try { const response = await fetch(href); if (response.ok) content = await response.text(); } catch { /* optional stylesheet */ }
    }
  } else if (style?.tagName.toLowerCase() === "style") {
    content = style.textContent;
  }
  if (content) {
    const targetStyle = targetWindow.document.createElement("style");
    targetStyle.textContent = content;
    targetWindow.document.head.appendChild(targetStyle);
  }
  const additionalStyle = document.getElementById("spicyLyrics-additionalStyling");
  if (additionalStyle) {
    const targetStyle = targetWindow.document.createElement("style");
    targetStyle.id = "spicyLyrics-additionalStyling";
    targetStyle.textContent = additionalStyle.textContent;
    targetWindow.document.head.appendChild(targetStyle);
  }
  const layoutStyle = targetWindow.document.createElement("style");
  layoutStyle.textContent = `html,body,.${wrapperClass}{width:100%;height:100%;margin:0;overflow:hidden;background:#000}`;
  targetWindow.document.head.appendChild(layoutStyle);
  const customFont = document.documentElement.style.getPropertyValue("--spicy-custom-font");
  if (customFont) targetWindow.document.documentElement.style.setProperty("--spicy-custom-font", customFont);
}

async function closeSession(session: CinemaSession, closeWindow: boolean): Promise<void> {
  session.cancelled = true;
  stopSessionLoops(session);
  try { session.window.removeEventListener("pagehide", session.externalPageHideHandler); } catch { /* closed window */ }
  if (hostPageHideHandler) {
    window.removeEventListener("pagehide", hostPageHideHandler);
    window.removeEventListener("beforeunload", hostPageHideHandler);
    hostPageHideHandler = null;
  }
  try { if (Fullscreen.IsOpen) await Fullscreen.Close(true); } catch (error) { console.warn("Cinema fullscreen cleanup failed", error); }
  try { if (PageView.IsOpened) await PageView.Destroy(); } catch (error) { console.warn("Cinema page cleanup failed", error); }
  if (closeWindow && !session.window.closed) {
    try { session.window.close(); } catch (error) { console.warn("Cinema window close failed", error); }
  }
  if (currentSession === session) currentSession = null;
  IsExternalCinemaLyrics = false;
  IsExternalCinemaOpening = false;
  RequestNPVCardEvaluate();
}

export const OpenExternalCinemaLyrics = (): Promise<void> => {
  if (IsPIP) return Promise.resolve();
  if (externalCinemaOpenPromise) return externalCinemaOpenPromise;
  if (externalCinemaClosePromise) return externalCinemaClosePromise.then(OpenExternalCinemaLyrics);
  if (currentSession && isCurrent(currentSession)) {
    currentSession.window.focus();
    return Promise.resolve();
  }
  IsExternalCinemaOpening = true;
  externalCinemaOpenPromise = openExternalCinemaLyrics().catch(async (error) => {
    console.warn("Cinema open failed", error);
    await CloseExternalCinemaLyrics();
  }).finally(() => {
    externalCinemaOpenPromise = null;
    if (!currentSession) IsExternalCinemaOpening = false;
    RequestNPVCardEvaluate();
  });
  return externalCinemaOpenPromise;
};

async function openExternalCinemaLyrics(): Promise<void> {
  if (NPVCardOwnsPage()) await DeRenderNPVCard();
  if (PageView.IsOpened && !IsExternalCinemaLyrics) {
    if (Fullscreen.IsOpen && !(await Fullscreen.Close())) return;
    await PageView.Destroy();
    Session.GoBackFrom("/SpicyLyrics");
  }
  if (PageView.IsOpened) return;
  const targetWindow = window.open("", "SpicyLyricsCinema", "popup=yes,width=1280,height=720");
  if (!targetWindow) return;
  const session: CinemaSession = {
    window: targetWindow, cancelled: false, renderFrame: null, playbackPump: null, lastUri: null,
    externalPageHideHandler: () => { void CloseExternalCinemaLyrics(false); },
  };
  currentSession = session;
  IsExternalCinemaLyrics = true;
  targetWindow.addEventListener("pagehide", session.externalPageHideHandler);
  hostPageHideHandler = () => { void CloseExternalCinemaLyrics(true); };
  window.addEventListener("pagehide", hostPageHideHandler);
  window.addEventListener("beforeunload", hostPageHideHandler);
  targetWindow.document.open();
  targetWindow.document.write(`<!doctype html><html><head></head><body><div class="spicy-external-cinema-wrapper"></div></body></html>`);
  targetWindow.document.close();
  await copyLyricsWindowStyles(targetWindow, "spicy-external-cinema-wrapper");
  if (!isCurrent(session)) return;
  const wrapper = targetWindow.document.body.querySelector<HTMLElement>(".spicy-external-cinema-wrapper");
  if (!wrapper) throw new Error("Cinema window wrapper was not created");
  await PageView.Open(wrapper);
  if (!isCurrent(session)) return;
  PageContainer?.classList.add("ExternalCinemaMode");
  Fullscreen.Open(true, false);
  startSessionLoops(session);
  targetWindow.focus();
  IsExternalCinemaOpening = false;
}

export const CloseExternalCinemaLyrics = (closeWindow = true): Promise<void> => {
  if (externalCinemaClosePromise) return externalCinemaClosePromise;
  const session = currentSession;
  if (!session) return Promise.resolve();
  externalCinemaClosePromise = closeSession(session, closeWindow).finally(() => { externalCinemaClosePromise = null; });
  return externalCinemaClosePromise;
};
