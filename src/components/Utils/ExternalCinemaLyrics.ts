// deno-lint-ignore-file no-explicit-any
import PageView from "../Pages/PageView.ts";
import Fullscreen from "./Fullscreen.ts";
import { IsPIP } from "./PopupLyrics.ts";
import { isSpicySidebarMode, CloseSidebarLyrics } from "./SidebarLyrics.ts";
import Session from "../Global/Session.ts";

export let IsExternalCinemaLyrics = false;

let currentExternalWindow: Window | null = null;
let externalPageHideHandler: ((event: Event) => void) | null = null;
let closingExternalWindow = false;

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
  externalWindow.document.title = "Spicy Lyrics Cinema";
  await copyLyricsWindowStyles(externalWindow, "spicy-external-cinema-wrapper");

  externalWindow.document.body.innerHTML = `<div class="spicy-external-cinema-wrapper"></div>`;
  const externalWrapper = externalWindow.document.body.querySelector(
    ".spicy-external-cinema-wrapper"
  ) as HTMLElement;

  IsExternalCinemaLyrics = true;
  PageView.Open(externalWrapper);
  Fullscreen.Open(true, false);
  externalWindow.focus();

  externalPageHideHandler = () => {
    if (!closingExternalWindow) CloseExternalCinemaLyrics(false);
  };
  externalWindow.addEventListener("pagehide", externalPageHideHandler);
};

export const CloseExternalCinemaLyrics = async (closeWindow = true) => {
  if (!IsExternalCinemaLyrics) return;

  closingExternalWindow = true;

  if (Fullscreen.IsOpen) await Fullscreen.Close(true);
  await PageView.Destroy();

  if (currentExternalWindow && externalPageHideHandler) {
    currentExternalWindow.removeEventListener("pagehide", externalPageHideHandler);
  }
  externalPageHideHandler = null;

  if (closeWindow && currentExternalWindow && !currentExternalWindow.closed) {
    currentExternalWindow.close();
  }

  currentExternalWindow = null;
  IsExternalCinemaLyrics = false;
  closingExternalWindow = false;
};
