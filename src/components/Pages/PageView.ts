import fetchLyrics, { ShowQueueLoader } from "../../utils/Lyrics/fetchLyrics.ts";
import { LyricsQueueRetry } from "../../utils/Lyrics/LyricsQueueRetry.ts";
import { $forceCompactMode } from "../../utils/uiState.ts";
import "../../css/Loaders/DotLoader.css";
import { DestroyAllLyricsContainers } from "../../utils/Lyrics/Applyer/CreateLyricsContainer.ts";
import ApplyLyrics, {
  cleanupApplyLyricsAbortController,
  UpdateRenderedRomanization,
} from "../../utils/Lyrics/Global/Applyer.ts";
import {
  addLinesEvListener,
  isRomanized,
  removeLinesEvListener,
  setRomanizedStatus,
} from "../../utils/Lyrics/lyrics.ts";
import {
  CleanupScrollEvents,
  InitializeScrollEvents,
  ResetLastLine,
} from "../../utils/Scrolling/ScrollToActiveLine.ts";
import { ScrollSimplebar } from "../../utils/Scrolling/Simplebar/ScrollSimplebar.ts";
import { toCssFontFamily } from "../../utils/cssFontFamily.ts";
import ApplyDynamicBackground, { KawarpMap } from "../DynamicBG/dynamicBackground.ts";
import {
  $currentLyricsData,
  $customFont,
  $customFontEnabled,
  $displayLyricsHoverPill,
  $enableExperimentalWordSync,
  $memeFormat,
  $lyricsContainerExists,
  $lyricsRendererPaused,
  $minimalLyricsMode,
  $rightAlignLyrics,
  $simpleLyricsMode,
  $lyricsCacheAction,
  $showLyricsCacheActionButton,
  $ttmlMakerMode,
  $viewControlsPosition,
} from "../../utils/stores.ts";
import Global from "../Global/Global.ts";
import Session from "../Global/Session.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { Icons } from "../Styling/Icons.ts";
import {
  DisableCompactMode,
  EnableCompactMode,
  IsCompactMode,
} from "../Utils/CompactMode.ts";
import Fullscreen, {
  EnterSpicyLyricsFullscreen,
  ExitFullscreenElement,
} from "../Utils/Fullscreen.ts";
import {
  NowBarObj,
  NowBar_SwapSides,
  Session_NowBar_SetSide,
  Session_OpenNowBar,
  ToggleNowBar,
  OpenNowBar,
} from "../Utils/NowBar.ts";
import TransferElement from "../Utils/TransferElement.ts";
import { IsPIP, _IsPIP_after, ClosePopupLyrics } from "../Utils/PopupLyrics.ts";
import { IsExternalCinemaLyrics, CloseExternalCinemaLyrics } from "../Utils/ExternalCinemaLyrics.ts";
import { NPVCardOwnsPage, DeRenderNPVCard } from "../Utils/NPVLyrics.ts";
import { CleanUpIsByCommunity } from "../../utils/Lyrics/Applyer/Credits/ApplyIsByCommunity.tsx";
import { OpenLyricsDBPanel } from "../../utils/openLyricsDBPanel.tsx";
import { openSettingsPanel } from "../../utils/settings.ts";
import Logger from "../../utils/Logger.ts";
import { triggerRemeasureLV } from "../../utils/Lyrics/LyricsVirtualizer.ts";
import {
  getLyricsCacheActionLabel,
  normalizeLyricsCacheAction,
  RunLyricsCacheAction,
} from "../../utils/LyricsCacheTools.ts";

const pageLogger = new Logger("Page View");
const controlsLogger = new Logger("View Controls");

interface TippyInstance {
  destroy: () => void;
  [key: string]: any;
}

export const Tooltips: {
  Close: TippyInstance | null;
  NowBarToggle: TippyInstance | null;
  FullscreenToggle: TippyInstance | null;
  CinemaView: TippyInstance | null;
  NowBarSideToggle: TippyInstance | null;
  LyricsManager: TippyInstance | null;
  Settings: TippyInstance | null;
  CacheAction: TippyInstance | null;
} = {
  Close: null,
  NowBarToggle: null,
  FullscreenToggle: null,
  CinemaView: null,
  NowBarSideToggle: null,
  LyricsManager: null,
  Settings: null,
  CacheAction: null,
};

let cacheActionRunning = false;

const PageView = {
  Open: OpenPage,
  Destroy: DestroyPage,
  AppendViewControls,
  IsOpened: false,
  IsTippyCapable: true,
};

export const GetPageRoot = () =>
  /* document.querySelector<HTMLElement>(".QdB2YtfEq0ks5O4QbtwX .WRGTOibB8qNEkgPNtMxq") ?? */
  document.querySelector<HTMLElement>(
    ".Root__main-view .main-view-container div[data-overlayscrollbars-viewport]"
  ) ??
  (() => {
    const child = document.querySelector<HTMLElement>(
      ".Root__main-view .main-view-container .main-view-container__scroll-node-child"
    );
    return child?.parentElement as HTMLElement | null;
  })() ??
  document.querySelector<HTMLElement>(
    ".Root__main-view .main-view-container .os-host"
  ) ??
  document.querySelector<HTMLElement>(
    ".Root__main-view .main-view-container .uGZUPBPcDpzSYqKcQT8r > div"
  );

let PageResizeListener: ResizeObserver | null = null;
export let PageContainer: HTMLElement | null = null;
export let IsCardMode = false;

function applyCustomFontSetting(fontFamily: string, targetDocument: Document = PageContainer?.ownerDocument ?? document) {
  const cssFontFamily = toCssFontFamily(fontFamily);
  if ($customFontEnabled.get() && cssFontFamily) {
    targetDocument.documentElement.style.setProperty("--spicy-custom-font", cssFontFamily);
  } else {
    targetDocument.documentElement.style.removeProperty("--spicy-custom-font");
  }
}

async function OpenPage(
  AppendTo: HTMLElement | undefined = undefined,
  options?: { cardMode?: boolean }
) {

  if (_IsPIP_after) {
    await ClosePopupLyrics();
    // After closing, open again with the same arguments
    return OpenPage(AppendTo, options);
  }

  if (!options?.cardMode && NPVCardOwnsPage()) {
    // The NPV card holds the global page; hand it over to the real requester.
    await DeRenderNPVCard();
    return OpenPage(AppendTo, options);
  }

  if (PageView.IsOpened) return;

  IsCardMode = !!options?.cardMode;
  /* if (!HoverMode) {
        PageView.IsTippyCapable = false;
    } */
  const targetDocument = AppendTo?.ownerDocument ?? document;
  const elem = targetDocument.createElement("div");
  elem.id = "SpicyLyricsPage";

  elem.classList.add("SpicyRenderer");

  if (IsCardMode) {
    elem.classList.add("CardMode");
  }

  /* if (HoverMode) {
        elem.classList.add("TippyMode");
    } */
  //const extractedColors = ((await Spicetify.colorExtractor(SpotifyPlayer.GetUri() ?? "spotify:track:31CsSZ9KlQmEu0JvWSkM3j")) as any) ?? { VIBRANT_NON_ALARMING: "#999999" };
  //const vibrantNonAlarmingColor = extractedColors?.VIBRANT_NON_ALARMING ?? "#999999";
  elem.innerHTML = `
        <div class="ContentBox">
            <div class="NowBar">
                <div class="CenteredView">
                    <div class="Header">
                        <div class="MediaBox">
                            <div class="MediaContent"></div>
                            <div class="MediaImageContainer">
                              <div class="fi_FromImage ib_ImageBox"></div>
                              <div class="ti_ToImage ib_ImageBox"></div>
                            </div>
                        </div>
                        <div class="Metadata">
                            <div class="SongName">
                                <span></span>
                            </div>
                            <div class="Artists">
                                <span></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="LyricsContainer">
                <div class="loaderContainer">
                    <div id="DotLoader"></div>
                </div>
                <div class="LyricsContent ScrollbarScrollable"></div>
            </div>
            <div class="ViewControls"></div>
        </div>
    `;

  if ($viewControlsPosition.get() === "Top") {
    elem.classList.add("ViewControlsPosition_Top")
  } else if ($viewControlsPosition.get() === "Bottom") {
    elem.classList.add("ViewControlsPosition_Bottom")
  }

  /* 
        <div class="SongMoreInfo">
            <div class="Content">
                <div class="SongMetadata">
                    <img src="" class="SongArtwork">
                    <div class="SongMetadataTextContent">
                        <p class="SongName">
                            <span></span>
                        </p>
                        <p class="ArtistsNames">
                            <span></span>
                        </p>
                    </div>
                </div>
                <div class="SongAnnotation">
                    <div class="BackgroundVisualizer">    
                        <p class="Annotation">
                            <span></span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    */

  
  PageContainer = elem;

  if (!$customFontEnabled.get()) {
    elem.classList.add("UseSpicyFont");
  }
  applyCustomFontSetting($customFont.get(), targetDocument);

  elem.classList.toggle("DisplayLyricsHoverPill", $displayLyricsHoverPill.get());
  elem.classList.toggle("GibberishLyricsMode", $memeFormat.get() === "Gibberish");

  if ($simpleLyricsMode.get()) {
    elem.classList.add("SimpleLyricsMode");
  }

  if ($minimalLyricsMode.get()) {
    elem.classList.add("MinimalLyricsMode");
  }

  const contentBox = elem.querySelector<HTMLElement>(
    ".ContentBox"
  );
  // Card mode stays transparent — the NPV's own dynamic background shows through.
  if (contentBox && !IsCardMode) {
    try {
      ApplyDynamicBackground(contentBox, "lpagebg");
    } catch (err) {
      pageLogger.error("Error applying dynamic background", err);
    }
  }

  if (AppendTo !== undefined) {
    AppendTo?.appendChild(elem);
  } else {
    GetPageRoot()?.appendChild(elem);
  }

  addLinesEvListener();

  {
    const currentUri = Spicetify?.Player?.data?.item?.uri;
    if (currentUri) {
      // If a 503 retry loop is already running for this track, re-show the
      // queue loader right away so reopening the page / swapping views restores
      // the queued state with no flash of empty content.
      if (LyricsQueueRetry.IsRetryingFor(currentUri)) {
        ShowQueueLoader();
      }
      fetchLyrics(currentUri).then(ApplyLyrics);
    }
  }

  if (!IsCardMode) {
    Session_OpenNowBar();

    /* const ArtworkButton = document.querySelector<HTMLElement>("#SpicyLyricsPage .ContentBox .NowBar .Header .Artwork");

      ArtworkButton.addEventListener("click", () => {
          NowBar_SwapSides();
      }) */

    Session_NowBar_SetSide();

    AppendViewControls();

    DisableCompactMode();
  } else if (IsCompactMode()) {
    // A previous PiP/fullscreen open left the module flag set; the card page
    // never enables compact mode, and a stale flag makes ScrollToActiveLine
    // pin the active line to the top instead of centering it.
    DisableCompactMode();
  }

  PageResizeListener = new ResizeObserver(() => {
    if (!Fullscreen.IsOpen || !Fullscreen.CinemaViewOpen) return;
    Compactify(elem);
  });

  PageResizeListener.observe(elem);

  if (AppendTo === undefined) {
    const legacyPage = document.querySelector<HTMLElement>(
      ".Root__main-view .main-view-container .os-host"
    );
    if (legacyPage) {
      legacyPage.style.containerType = "inline-size";
    }
  }

  // UpdateSongMoreInfo()

  $lyricsContainerExists.set(true);
  $lyricsRendererPaused.set(false);
  PageView.IsOpened = true;

  if (IsPIP) {
    elem?.classList.add("ForcedCompactMode");
    OpenNowBar(true);
    EnableCompactMode();
  }

  PageContainer = elem;

  const contentType = SpotifyPlayer.GetContentType();
  if (contentType === "episode") {
    elem?.classList.add("episode-content-type");
  } else {
    elem?.classList.remove("episode-content-type");
  }

  Global.Event.evoke("page:open", { cardMode: IsCardMode });
}

/* Global.Event.listen("playback:songchange", () => {
    if (!PageView.IsOpened) return;
    UpdateSongMoreInfo();
}) */

export const isSizeReadyToBeCompacted = () =>
  (PageContainer?.ownerDocument.defaultView ?? window).matchMedia("(max-width: 70.812rem)").matches;

export function Compactify(Element: HTMLElement | undefined = undefined) {
  if (!Fullscreen.IsOpen) return;
  const elem = Element ?? PageContainer;
  if (!elem) return;
  if (isSizeReadyToBeCompacted()) {
    elem.classList.add("CompactifyEnabledCompactMode");
    EnableCompactMode();
  } else {
    if (!elem.classList.contains("CompactifyEnabledCompactMode")) return;
    elem.classList.remove("CompactifyEnabledCompactMode");
    if (elem.classList.contains("ForcedCompactMode")) return;
    DisableCompactMode();
  }
}

async function DestroyPage() {
  if (!PageView.IsOpened) return;
  pageLogger.debug("Destroying page");

  cleanupApplyLyricsAbortController();

  if (Fullscreen.IsOpen) await Fullscreen.Close();
  if (!PageContainer) return;

  KawarpMap.get("lpagebg")?.dispose();
  KawarpMap.delete("lpagebg");
  ResetLastLine();
  CleanupScrollEvents();
  PageResizeListener?.disconnect(); // Disconnect the observer
  PageView.IsOpened = false;
  $lyricsContainerExists.set(false);
  $lyricsRendererPaused.set(false);
  DestroyAllLyricsContainers();
  CleanUpIsByCommunity();

  const legacyPage = document.querySelector<HTMLElement>(
    ".Root__main-view .main-view-container .os-host"
  );
  if (legacyPage) {
    legacyPage.style.containerType = "";
  }

  PageContainer?.remove();
  removeLinesEvListener();
  Object.values(Tooltips).forEach((a) => {
    a?.destroy();
  });
  ScrollSimplebar?.unMount();
  IsCardMode = false;
  Global.Event.evoke("page:destroy", null);
  PageView.IsTippyCapable = true;
  PageContainer = null;
}

export let LyricsApplied = false;

Global.Event.listen("lyrics:not-apply", () => {
  CleanupScrollEvents();
  LyricsApplied = false;
  CleanUpIsByCommunity();
});

Global.Event.listen("lyrics:apply", ({ Type }: { Type: string }) => {
  CleanupScrollEvents();

  if (!Type || Type === "Static") return;
  if (ScrollSimplebar) {
    InitializeScrollEvents(ScrollSimplebar);
    //QueueForceScroll(); // Queue a force scroll instead of directly calling with true
    LyricsApplied = true;
  }

  setTimeout(() => triggerRemeasureLV(), 1000);
  setTimeout(() => triggerRemeasureLV(), 1500);
});

function AppendViewControls(ReAppend: boolean = false) {
  if (IsCardMode) return;
  if (!PageContainer) return;
  controlsLogger.debug("Append view controls");
  const elem = PageContainer.querySelector<HTMLElement>(
    ".ContentBox .ViewControls"
  );
  if (!elem) return;

  // Safely destroy existing tooltips first
  Object.keys(Tooltips).forEach((key) => {
    const tippy = Tooltips[key as keyof typeof Tooltips];
    if (tippy?.destroy && typeof tippy.destroy === "function") {
      tippy.destroy();
      Tooltips[key as keyof typeof Tooltips] = null;
    }
  });

  if (ReAppend) elem.innerHTML = "";
  const isNoLyrics =
    $currentLyricsData.get() === `NO_LYRICS:${SpotifyPlayer.GetUri()}`;
  const isTTMLMakerMode = $ttmlMakerMode.get();
  const cacheAction = normalizeLyricsCacheAction($lyricsCacheAction.get());
  const showCacheActionButton = $showLyricsCacheActionButton.get() && !IsPIP;
  elem.innerHTML = `
        ${
          Fullscreen.IsOpen || Fullscreen.CinemaViewOpen
            ? ""
            : IsPIP ? "" : `<button id="CinemaView" class="ViewControl">${Icons.CinemaView}</button>`
        }
        ${
          Fullscreen.IsOpen || Fullscreen.CinemaViewOpen || NowBarObj.Open
            ? IsPIP ? "" : `<button id="CompactModeToggle" class="ViewControl">${
                IsCompactMode()
                  ? Icons.DisableCompactModeIcon
                  : Icons.EnableCompactModeIcon
              }</button>`
            : ""
        }
        <button id="RomanizationToggle" class="ViewControl">
          ${
            isRomanized
              ? Icons.DisableRomanization
              : Icons.EnableRomanization
          }
        </button>
        ${
          !Fullscreen.IsOpen &&
          !Fullscreen.CinemaViewOpen
            ? IsPIP ? "" : `<button id="NowBarToggle" class="ViewControl">${Icons.NowBar}</button>`
            : ""
        }
        ${
          NowBarObj.Open
            ? IsPIP ? "" : `<button id="NowBarSideToggle" class="ViewControl">${Icons.NowBarSideSwap}</button>`
            : ""
        }
        ${
          Fullscreen.IsOpen
            ? (IsPIP ? "" : `<button id="FullscreenToggle" class="ViewControl">${
                Fullscreen.CinemaViewOpen
                  ? Icons.Fullscreen
                  : Icons.CloseFullscreen
              }</button>`)
            : ""
        }
        ${
          isTTMLMakerMode && !IsPIP
            ? `<button id="LyricsManager" class="ViewControl">${Icons.LoadTTML}</button>`
            : ""
        }
        ${
          showCacheActionButton
            ? `<button id="CacheAction" class="ViewControl" ${
                cacheActionRunning ? "disabled aria-busy=\"true\"" : ""
              }>${Icons.ClearCache}</button>`
            : ""
        }
        ${IsPIP ? "" : `<button id="SettingsToggle" class="ViewControl">${Icons.Settings}</button>`}
        <button id="Close" class="ViewControl">${Icons.Close}</button>
    `;

  let targetElem: HTMLElement | null = elem;
  if (Fullscreen.IsOpen) {
    const mediaContent = PageContainer?.querySelector<HTMLElement>(
      ".ContentBox .NowBar .Header .MediaBox .MediaContent"
    );
    if (mediaContent) {
      TransferElement(elem, mediaContent);
      const viewControls =
        mediaContent.querySelector<HTMLElement>(".ViewControls");
      if (viewControls) {
        targetElem = viewControls;
      }
    }
  } else {
    const contentBox = PageContainer?.querySelector<HTMLElement>(".ContentBox");
    if (
      PageContainer?.querySelector<HTMLElement>(
        ".ContentBox .NowBar .Header .ViewControls"
      ) &&
      contentBox
    ) {
      TransferElement(elem, contentBox);
    }
  }

  if (targetElem) {
    SetupTippy(targetElem);
  }

  function SetupTippy(elem: HTMLElement) {
    // If in PIP mode, do not create any Tippy tooltips, but still wire up click handlers
    const isDetachedWindow = IsPIP || IsExternalCinemaLyrics;

    const closeButton = elem.querySelector("#Close");
    if (closeButton) {
      try {
        if (!isDetachedWindow) {
          Tooltips.Close = Spicetify.Tippy(closeButton, {
            ...Spicetify.TippyProps,
            content: `Close Page`,
          });
        }
        closeButton.addEventListener("click", async () => {
          if (IsPIP) {
            await ClosePopupLyrics();
            globalThis.focus();
            return;
          }
          if (IsExternalCinemaLyrics) {
            await CloseExternalCinemaLyrics();
            globalThis.focus();
            return;
          }

          if (Fullscreen.IsOpen) {
            await Fullscreen.Close();
          }

          Session.GoBack();
        });
      } catch (err) {
        controlsLogger.warn("Failed to setup Close tooltip", err);
      }
    }

    const compactModeToggle = elem.querySelector("#CompactModeToggle");
    if (compactModeToggle) {
      try {
        if (!isDetachedWindow) {
          Tooltips.Close = Spicetify.Tippy(compactModeToggle, {
            ...Spicetify.TippyProps,
            content: `${
              IsCompactMode() ? "Disable Compact Mode" : "Enable Compact Mode"
            }`,
          });
        }
        compactModeToggle.addEventListener("click", () => {
          // Use PageContainer instead of document.querySelector
          const SpicyLyricsPage = PageContainer;
          if (Fullscreen.IsOpen || Fullscreen.CinemaViewOpen) {
            if (IsCompactMode()) {
              SpicyLyricsPage?.classList.remove("ForcedCompactMode");
              DisableCompactMode();
              $forceCompactMode.set(false);
            } else {
              SpicyLyricsPage?.classList.add("ForcedCompactMode");
              EnableCompactMode();
              $forceCompactMode.set(true);
            }

            setTimeout(() => {
              AppendViewControls(true);
            }, 65);
            return;
          }

          if (IsCompactMode()) {
            DisableCompactMode();
          } else {
            EnableCompactMode();
          }

          setTimeout(() => {
            AppendViewControls(true);
          }, 65);
        });
      } catch (err) {
        controlsLogger.warn("Failed to setup Compact Mode tooltip", err);
      }
    }

    const romanizationToggle = elem.querySelector("#RomanizationToggle");
    if (romanizationToggle) {
      try {
        if (!isDetachedWindow) {
          Tooltips.Close = Spicetify.Tippy(romanizationToggle, {
            ...Spicetify.TippyProps,
            content: isRomanized ? `Disable Romanization` : `Enable Romanization`,
          });
        }
        romanizationToggle.addEventListener("click", async () => {
          const songUri = SpotifyPlayer.GetUri();
          if (!songUri) return;
          const useRomanized = !isRomanized;

          if (UpdateRenderedRomanization(useRomanized)) {
            AppendViewControls();
            return;
          }

          const lyrics = await fetchLyrics(songUri, {
            keepCurrentLyricsVisible: true,
          });

          setRomanizedStatus(useRomanized);

          await ApplyLyrics(lyrics);
          AppendViewControls();
        });
      } catch (err) {
        controlsLogger.warn("Failed to setup Romanization tooltip", err);
      }
    }

    if (!Fullscreen.IsOpen && !Fullscreen.CinemaViewOpen) {
      const nowBarButton = elem.querySelector("#NowBarToggle");
      if (nowBarButton) {
        try {
          if (!isDetachedWindow) {
            Tooltips.NowBarToggle = Spicetify.Tippy(nowBarButton, {
              ...Spicetify.TippyProps,
              content: `NowBar`,
            });
          }
          nowBarButton.addEventListener("click", () => ToggleNowBar());
        } catch (err) {
          controlsLogger.warn("Failed to setup NowBar tooltip", err);
        }
      }

    }

    const fullscreenBtn = elem.querySelector("#FullscreenToggle");
    if (fullscreenBtn) {
      try {
        if (!isDetachedWindow) {
          Tooltips.FullscreenToggle = Spicetify.Tippy(fullscreenBtn, {
            ...Spicetify.TippyProps,
            content: `${
              Fullscreen.CinemaViewOpen ? "Fullscreen" : "Cinema View"
            }`,
          });
        }
        fullscreenBtn.addEventListener("click", async () => {
          // If we're in cinema view, go to full fullscreen
          if (Fullscreen.CinemaViewOpen) {
            Fullscreen.CinemaViewOpen = false;
            await EnterSpicyLyricsFullscreen();
            PageView.AppendViewControls(true);
          } else {
            Fullscreen.CinemaViewOpen = true;
            await ExitFullscreenElement();
            PageView.AppendViewControls(true);
          }
          setTimeout(Compactify, 250);
        });
      } catch (err) {
        controlsLogger.warn("Failed to setup Fullscreen tooltip", err);
      }
    }

    const cinemaViewBtn = elem.querySelector("#CinemaView");
    if (cinemaViewBtn && !Fullscreen.IsOpen) {
      try {
        if (!isDetachedWindow) {
          Tooltips.CinemaView = Spicetify.Tippy(cinemaViewBtn, {
            ...Spicetify.TippyProps,
            content: `Cinema View`,
          });
        }
        cinemaViewBtn.addEventListener("click", async () => {
          Fullscreen.Open(true);
        });
      } catch (err) {
        controlsLogger.warn("Failed to setup Cinema View tooltip", err);
      }
    }

    const nowBarSideToggleBtn = elem.querySelector("#NowBarSideToggle");
    if (
      nowBarSideToggleBtn &&
      NowBarObj.Open &&
      !(isNoLyrics && (Fullscreen.IsOpen || Fullscreen.CinemaViewOpen))
    ) {
      try {
        if (!isDetachedWindow) {
          Tooltips.NowBarSideToggle = Spicetify.Tippy(nowBarSideToggleBtn, {
            ...Spicetify.TippyProps,
            content: `Swap NowBar Side`,
          });
        }
        nowBarSideToggleBtn.addEventListener("click", () => NowBar_SwapSides());
      } catch (err) {
        controlsLogger.warn("Failed to setup NowBar Side Toggle tooltip", err);
      }
    }

    const settingsButton = elem.querySelector("#SettingsToggle");
    if (settingsButton && !IsPIP) {
      try {
        if (!isDetachedWindow) {
          Tooltips.Settings = Spicetify.Tippy(settingsButton, {
            ...Spicetify.TippyProps,
            content: `Spicy Lyrics Settings`,
          });
        }
        settingsButton.addEventListener("click", () => {
          openSettingsPanel(PageContainer?.ownerDocument ?? document);
        });
      } catch (err) {
        controlsLogger.warn("Failed to setup Settings tooltip", err);
      }
    }

    const cacheActionButton = elem.querySelector<HTMLButtonElement>("#CacheAction");
    if (cacheActionButton) {
      try {
        if (!isDetachedWindow) {
          Tooltips.CacheAction = Spicetify.Tippy(cacheActionButton, {
            ...Spicetify.TippyProps,
            content: getLyricsCacheActionLabel(cacheAction),
          });
        }
        cacheActionButton.setAttribute("aria-label", getLyricsCacheActionLabel(cacheAction));
        cacheActionButton.addEventListener("click", async () => {
          if (cacheActionRunning) return;
          cacheActionRunning = true;
          cacheActionButton.disabled = true;
          cacheActionButton.setAttribute("aria-busy", "true");
          try {
            await RunLyricsCacheAction(cacheAction, true);
          } finally {
            cacheActionRunning = false;
            if (cacheActionButton.isConnected) {
              cacheActionButton.disabled = false;
              cacheActionButton.removeAttribute("aria-busy");
            }
          }
        });
      } catch (err) {
        controlsLogger.warn("Failed to setup cache action", err);
      }
    }

    const lyricsManagerButton = elem.querySelector("#LyricsManager");
    if (lyricsManagerButton && isTTMLMakerMode) {
      try {
        if (!isDetachedWindow) {
          Tooltips.LyricsManager = Spicetify.Tippy(lyricsManagerButton, {
            ...Spicetify.TippyProps,
            content: `Load TTML`,
          });
        }
        lyricsManagerButton.addEventListener("click", () => {
          if (IsPIP) {
            globalThis.focus();
          }
          
          OpenLyricsDBPanel();
        });
      } catch (err) {
        controlsLogger.warn("Failed to setup Load TTML tooltip", err);
      }
    }
  }
}

// --- Reactive setting subscriptions ---

function RefreshRightAlignedLyrics() {
  const lyricsContainer = PageContainer?.querySelector<HTMLElement>(
    ".LyricsContainer .LyricsContent .SpicyLyricsScrollContainer"
  );
  if (!lyricsContainer || lyricsContainer.dataset.lyricsType === "Static") return;

  const lines = lyricsContainer.querySelectorAll<HTMLElement>(".line");
  lines.forEach((line) => {
    line.classList.toggle("OppositeAligned");
  });

  lyricsContainer.classList.toggle(
    "HasDuetLines",
    Boolean(lyricsContainer.querySelector(".line.OppositeAligned"))
  );
  triggerRemeasureLV();
}

$simpleLyricsMode.listen((v) => {
  if (!PageContainer) return;
  PageContainer.classList.toggle("SimpleLyricsMode", v);
  const uri = SpotifyPlayer.GetUri();
  $currentLyricsData.set("");
  if (uri) fetchLyrics(uri).then(ApplyLyrics);
});

$minimalLyricsMode.listen((v) => {
  if (!PageContainer) return;
  PageContainer.classList.toggle("MinimalLyricsMode", v);
  const uri = SpotifyPlayer.GetUri();
  $currentLyricsData.set("");
  if (uri) fetchLyrics(uri).then(ApplyLyrics);
});

$enableExperimentalWordSync.listen(() => {
  if (!PageContainer) return;
  const uri = SpotifyPlayer.GetUri();
  $currentLyricsData.set("");
  if (uri) fetchLyrics(uri).then(ApplyLyrics);
});

$memeFormat.listen((v) => {
  if (!PageContainer) return;
  PageContainer.classList.toggle("GibberishLyricsMode", v === "Gibberish");
  const uri = SpotifyPlayer.GetUri();
  $currentLyricsData.set("");
  if (uri) fetchLyrics(uri).then(ApplyLyrics);
});

$rightAlignLyrics.listen(() => {
  if (!PageContainer) return;
  RefreshRightAlignedLyrics();
});

$customFontEnabled.listen((v) => {
  if (!PageContainer) return;
  PageContainer.classList.toggle("UseSpicyFont", !v);
  applyCustomFontSetting($customFont.get());
});

$customFont.listen((v) => {
  applyCustomFontSetting(v);
});

$displayLyricsHoverPill.listen((v) => {
  PageContainer?.classList.toggle("DisplayLyricsHoverPill", v);
});

$viewControlsPosition.listen((v) => {
  if (!PageContainer) return;
  PageContainer.classList.toggle("ViewControlsPosition_Top", v === "Top");
  PageContainer.classList.toggle("ViewControlsPosition_Bottom", v === "Bottom");
  AppendViewControls(true);
});

$ttmlMakerMode.listen(() => {
  if (!PageContainer) return;
  AppendViewControls(true);
});

$showLyricsCacheActionButton.listen(() => {
  if (!PageContainer) return;
  AppendViewControls(true);
});

$lyricsCacheAction.listen(() => {
  if (!PageContainer) return;
  AppendViewControls(true);
});

export default PageView;
