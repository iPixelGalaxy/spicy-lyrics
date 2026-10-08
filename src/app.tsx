// CSS Imports
import "./css/tokens.css";
import "./css/primitives.css";
import "./css/default.css";
import "./css/default.scss";
import "./css/Simplebar.css";
import "./css/ContentBox.css";
import "./css/DynamicBG/spicy-dynamic-bg.css";
import "./css/Lyrics/main.css";
import "./css/Lyrics/Mixed.css";
import "./css/Loaders/LoaderContainer.css";
import "./css/Loaders/LyricsSkeleton.css";
import "./css/font-pack/font-pack.css";

import ApplyDynamicBackground, {
  GetStaticBackground,
  KawarpMap,
} from "./components/DynamicBG/dynamicBackground.ts";
import {
  $alwaysShowInFullscreen,
  $animateFullscreenClose,
  $buildChannel,
  $coverArtAnimation,
  $currentLyricsData,
  $customFont,
  $customFontEnabled,
  $disabledLyricsSources,
  $enableExperimentalWordSync,
  $escapeKeyFunction,
  $externalCinemaLyricsAllowed,
  $showNpvDynamicBg,
  $ignoreMusixmatchWordSync,
  $lyricsSourceOrder,
  $memeFormat,
  $musixmatchToken,
  $prioritizeAppleMusicQuality,
  $removeSpotifyLyricsButton,
  $popupLyricsAllowed,
  $releaseYearPosition,
  $rightAlignLyrics,
  $showVolumeSliderFullscreen,
  $spicyLyricsVersion,
  $staticBackgroundMode,
  $developerMode,
} from "./utils/stores.ts";
import Defaults from "./components/Global/Defaults.ts";
import Global from "./components/Global/Global.ts";
import Platform from "./components/Global/Platform.ts";
import Session from "./components/Global/Session.ts";
import { SpotifyPlayer } from "./components/Global/SpotifyPlayer.ts";
import PageView, { GetPageRoot, PageContainer } from "./components/Pages/PageView.ts";
import LoadFonts, { ApplyFontPixel } from "./components/Styling/Fonts.ts";
import { Icons } from "./components/Styling/Icons.ts";
import Fullscreen, {
  EnterSpicyLyricsFullscreen,
  IsFullscreenClosing,
  ExitFullscreenElement,
  RefreshFullscreenControlsVisibility,
  RefreshFullscreenVolumeSlider,
} from "./components/Utils/Fullscreen.ts";
import { UpdateNowBar } from "./components/Utils/NowBar.ts";
import { IsPlaying } from "./utils/Addons.ts";
import { requestPositionSync } from "./utils/Gets/GetProgress.ts";
import { IntervalManager } from "./utils/IntervalManager.ts";
import fetchLyrics, { getSongKey } from "./utils/Lyrics/fetchLyrics.ts";
import ApplyLyrics, {
  ApplyLyricsIfCurrent,
  InvalidatePendingLyricsApplication,
} from "./utils/Lyrics/Global/Applyer.ts";
import { ScrollingIntervalTime } from "./utils/Lyrics/lyrics.ts";
import { ScrollToActiveLine } from "./utils/Scrolling/ScrollToActiveLine.ts";
import { ScrollSimplebar } from "./utils/Scrolling/Simplebar/ScrollSimplebar.ts";
import { $fromVersion, $lastFetchedUri, $previousVersion } from "./utils/uiState.ts";
import { needsMigration, showMigrationModal } from "./utils/migration/DataMigration.tsx";
import { OpenBuildChannelPanel } from "./utils/openBuildChannelPanel.tsx";
import "./css/settings-panel.css";
import "./components/ReactComponents/LyricsManager/styles.css";
import "./css/polyfills/generic-modal-polyfill.css";
import "./css/NoticeDialog.css";
import "./css/polyfills/sonner-polyfill.css";
import "./css/NPVLyrics.css";
import { showUpdatedDialog } from "./components/ReactComponents/UpdateDialog.tsx";
import { IsPIP, OpenPopupLyrics, ClosePopupLyrics } from "./components/Utils/PopupLyrics.ts";
import {
  IsExternalCinemaLyrics,
  OpenExternalCinemaLyrics,
  CloseExternalCinemaLyrics,
} from "./components/Utils/ExternalCinemaLyrics.ts";
import { GetNPVCardElement, GetNPVElementForBackground, GetNPVObserverRoot, initNPVLyrics } from "./components/Utils/NPVLyrics.ts";
import { SyncNPVVisuals } from "./components/Utils/NPVVisuals.ts";
import ReactDOM from "react-dom/client";
import { runThemeMatcher } from "./utils/themeMatcher.ts";
import { guardSpicetifyScrollingFix } from "./utils/scrollFixGuard.ts";
import "./utils/settings.ts";
import SLToaster from "./components/ReactComponents/SLToaster.tsx";
import { registerSettingsMenu } from "./utils/settings.ts";
import { PopupModal } from "./components/Modal.ts";
import { exposeToWindow } from "./utils/expose.ts";
import Logger from "./utils/Logger.ts";
import Whentil from "./modules/Whentil.ts";
import App from "./utils/app.ts";
import { toCssFontFamily } from "./utils/cssFontFamily.ts";
import { initSession } from "./utils/SessionManager/index.ts";
import { CheckForUpdates } from "./utils/version/CheckForUpdates.tsx";

function bindDefault<T>(store: { get: () => T; listen: (listener: (value: T) => void) => () => void }, assign: (value: T) => void) {
  assign(store.get());
  store.listen(assign);
}

function applyCustomFont(enabled = $customFontEnabled.get(), font = $customFont.get()) {
  const cssFontFamily = toCssFontFamily(font);
  if (enabled && cssFontFamily) {
    document.documentElement.style.setProperty("--spicy-custom-font", cssFontFamily);
  } else {
    document.documentElement.style.removeProperty("--spicy-custom-font");
  }
}

function closeSettingsOwnedModalOnNavigation(data: { pathname: string }) {
  if (!PopupModal.isConnected) return;
  if (data.pathname === "/SpicyLyrics/Update") return;

  const settingsOwnedModal = PopupModal.querySelector(
    ".slmodal-settingsPanel, .slmodal-buildChannelPanel, .slmodal-lyricsSourcesManager, .slmodal-settingsTTMLDatabase"
  );
  if (settingsOwnedModal) PopupModal.hide();
}

function syncLegacyStaticBackgroundSettings(mode: string) {
  const normalizedMode = mode === "off" ? "default" : mode;
  const legacyTypeMap: Record<string, string> = {
    auto: "Auto",
    artistHeader: "Artist Header Visual",
    coverArt: "Cover Art",
    color: "Color",
  };

  if (legacyTypeMap[normalizedMode]) {
    Spicetify.LocalStorage.set("SpicyLyrics-staticBackground", JSON.stringify(true));
    Spicetify.LocalStorage.set("SpicyLyrics-staticBackgroundType", JSON.stringify(legacyTypeMap[normalizedMode]));
    return;
  }

  // Official builds do not understand this fork's Legacy mode. Persist it as
  // old-plugin Off so switching back to Stable cannot resurrect stale Cover Art.
  Spicetify.LocalStorage.set("SpicyLyrics-staticBackground", JSON.stringify(false));
  Spicetify.LocalStorage.set("SpicyLyrics-staticBackgroundType", JSON.stringify("Auto"));
}

function reapplyCurrentLyrics() {
  const rawLyrics = $currentLyricsData.get();
  if (!rawLyrics || rawLyrics.startsWith("NO_LYRICS:")) return;
  try {
    ApplyLyrics([JSON.parse(rawLyrics), 200]);
  } catch {
    // Ignore non-JSON notice states.
  }
}

function bindForkDefaults() {
  bindDefault($rightAlignLyrics, (value) => { Defaults.RightAlignLyrics = value; });
  bindDefault($escapeKeyFunction, (value) => { Defaults.EscapeKeyFunction = value; });
  bindDefault($buildChannel, (value) => { Defaults.BuildChannel = value; });
  bindDefault($customFontEnabled, (value) => {
    Defaults.CustomFontEnabled = value;
    applyCustomFont(value, $customFont.get());
  });
  bindDefault($customFont, (value) => {
    Defaults.CustomFont = value;
    applyCustomFont($customFontEnabled.get(), value);
  });
  bindDefault($alwaysShowInFullscreen, (value) => {
    Defaults.AlwaysShowInFullscreen = value;
    RefreshFullscreenControlsVisibility();
  });
  bindDefault($showVolumeSliderFullscreen, (value) => {
    Defaults.ShowVolumeSliderFullscreen = value;
    RefreshFullscreenVolumeSlider();
  });
  bindDefault($releaseYearPosition, (value) => { Defaults.ReleaseYearPosition = value; });
  bindDefault($coverArtAnimation, (value) => { Defaults.CoverArtAnimation = value; });
  bindDefault($staticBackgroundMode, syncLegacyStaticBackgroundSettings);
  bindDefault($memeFormat, (value) => {
    Defaults.MemeFormat = ["Gibberish", "all lowercase", "ALL UPPERCASE"].includes(value)
      ? value
      : "Off";
    reapplyCurrentLyrics();
  });
  bindDefault($animateFullscreenClose, (value) => { Defaults.AnimateFullscreenClose = value; });
  bindDefault($enableExperimentalWordSync, (value) => { Defaults.EnableExperimentalWordSync = value; });
  bindDefault($lyricsSourceOrder, (value) => {
    try {
      Defaults.LyricsSourceOrder = JSON.parse(value);
    } catch {
      Defaults.LyricsSourceOrder = ["spicy", "musixmatch", "apple", "spotify", "lrclib", "netease"];
    }
  });
  bindDefault($disabledLyricsSources, (value) => {
    try {
      Defaults.DisabledLyricsSourceIds = JSON.parse(value);
    } catch {
      Defaults.DisabledLyricsSourceIds = ["lrclib", "netease"];
    }
  });
  bindDefault($ignoreMusixmatchWordSync, (value) => { Defaults.IgnoreMusixmatchWordSync = value; });
  bindDefault($prioritizeAppleMusicQuality, (value) => { Defaults.PrioritizeAppleMusicQuality = value; });
  bindDefault($musixmatchToken, () => {});
  bindDefault($developerMode, (value) => { Defaults.DeveloperMode = value; });
}

bindForkDefaults();

async function main() {
  const appLogger = new Logger("App");
  const dynamicBgLogger = new Logger("Dynamic Background");
  const playbackLogger = new Logger("Playback");

  if (App.isDev() || $developerMode.get()) {
    appLogger.debug("Boot sequence");
    exposeToWindow();
    appLogger.debug("Window helpers exposed");
  }

  await Platform.OnSpotifyReady;
  registerSettingsMenu(Icons.LyricsPage);

  guardSpicetifyScrollingFix();

  if (needsMigration()) {
    showMigrationModal();
    return;
  }

  Global.SetScope("fullscreen.open", false);

  Global.SetScope("fullscreen.onopen", (cb: any) => {
    const id = Global.Event.listen("fullscreen:open", () => {
      Global.SetScope("fullscreen.open", true);
      cb();
    });
    return () => Global.Event.unListen(id);
  });

  Global.SetScope("fullscreen.onclose", (cb: any) => {
    const id = Global.Event.listen("fullscreen:exit", () => {
      Global.SetScope("fullscreen.open", false);
      cb();
    });
    return () => Global.Event.unListen(id);
  });

  if ($previousVersion.get()) {
    $previousVersion.set("");
  }

  $spicyLyricsVersion.set(window._spicy_lyrics_metadata?.LoadedVersion ?? $spicyLyricsVersion.get());
  window._spicy_lyrics_metadata = {};

  const fromVersion = $fromVersion.get();
  const spicyLyricsVersion = $spicyLyricsVersion.get();
  const updatedFromPreviousVersion = Boolean(fromVersion && spicyLyricsVersion && fromVersion !== spicyLyricsVersion);
  if (updatedFromPreviousVersion) showUpdatedDialog(fromVersion, spicyLyricsVersion);

  $fromVersion.set(spicyLyricsVersion);
  void initSession();

  LoadFonts();
  ApplyFontPixel();

  const skeletonStyle = document.createElement("style");
  skeletonStyle.innerHTML = `
        /* This style is here to prevent the @keyframes removal in the CSS. I still don't know why that's happening. */
        /* This is a part of Spicy Lyrics */
        @keyframes skeleton {
            to {
                background-position-x: 0;
            }
        }

        @keyframes Marquee_SongName {
          0% {
            transform: translateX(calc(0px + min(-100% + 100cqw, 0px) * 0));
          }
          10% {
            transform: translateX(calc(0px + min(-100% + 100cqw, 0px) * 0));
          }
          90% {
            transform: translateX(calc(0px + min(-100% + 100cqw, 0px) * 1));
          }
          100% {
            transform: translateX(calc(0px + min(-100% + 100cqw, 0px) * 1));
          }
        }

        @keyframes Marquee_SongName_SongMoreInfo {
          0% {
            transform: translateX(calc(0px + min(-100% + 98cqw, 0px) * 0));
          }
          10% {
            transform: translateX(calc(0px + min(-100% + 98cqw, 0px) * 0));
          }
          90% {
            transform: translateX(calc(0px + min(-100% + 98cqw, 0px) * 1));
          }
          100% {
            transform: translateX(calc(0px + min(-100% + 98cqw, 0px) * 1));
          }
        }

        @keyframes Marquee_Artists {
          0% {
            transform: translateX(0);
          }
          10% {
            transform: translateX(0);
          }
          90% {
            transform: translateX(var(--sl-marquee-distance, calc(min(-100% + 100cqw, 0px))));
          }
          100% {
            transform: translateX(var(--sl-marquee-distance, calc(min(-100% + 100cqw, 0px))));
          }
        }

        @keyframes Marquee_Artists_SongMoreInfo {
          0% {
            transform: translateX(calc(0px + min(-100% + 98cqw, 0px) * 0));
          }
          10% {
            transform: translateX(calc(0px + min(-100% + 98cqw, 0px) * 0));
          }
          90% {
            transform: translateX(calc(0px + min(-100% + 98cqw, 0px) * 1));
          }
          100% {
            transform: translateX(calc(0px + min(-100% + 98cqw, 0px) * 1));
          }
        }

        @keyframes Marquee_SongName_Compact {
          0% {
            transform: translateX(calc(0px + min(-100% + 100cqw, 0px) * 0));
          }
          10% {
            transform: translateX(calc(0px + min(-100% + 100cqw, 0px) * 0));
          }
          90% {
            transform: translateX(calc(0px + min(-100% + 100cqw, 0px) * 1));
          }
          100% {
            transform: translateX(calc(0px + min(-100% + 100cqw, 0px) * 1));
          }
        }

        @keyframes Marquee_Artists_Compact {
          0% {
            transform: translateX(0);
          }
          10% {
            transform: translateX(0);
          }
          90% {
            transform: translateX(var(--sl-marquee-distance, calc(min(-100% + 100cqw, 0px))));
          }
          100% {
            transform: translateX(var(--sl-marquee-distance, calc(min(-100% + 100cqw, 0px))));
          }
        }

        @keyframes SLM_Animation {
          0% {
            --SLM_GradientPosition: -27.5%;
          }
          100% {
            --SLM_GradientPosition: 100%;
          }
        }

        @keyframes Pre_SLM_GradientAnimation {
          0% {
            --SLM_GradientPosition: -50%;
          }
          100% {
            --SLM_GradientPosition: -27.5%;
          }
        }

        @keyframes SL_SkeletonSweep {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(100%);
          }
        }

        @keyframes SL_SkeletonDot {
          0%,
          100% {
            opacity: 0.25;
            transform: translateY(0);
          }
          40% {
            opacity: 1;
            transform: translateY(-0.18em);
          }
        }

        @keyframes MB_anim_enter {
          0% {
            transform: translate(100%, 0);
          }
          100% {
            transform: translate(0, 0);
          }
        }
  `;

  skeletonStyle.id = "spicyLyrics-additionalStyling";
  document.head.appendChild(skeletonStyle);

  // Enter fullscreen once the route change has mounted the page. Bounded, and
  // re-checked on arrival: navigating away first must not leave it armed for
  // whenever the page next opens, and a second click must not open it twice.
  let pendingFullscreenOpen: ReturnType<typeof Whentil.When> | null = null;
  const openFullscreenOncePageMounts = (cinemaView: boolean) => {
    pendingFullscreenOpen?.Cancel();
    pendingFullscreenOpen = Whentil.When(
      () => document.querySelector<HTMLElement>(":is(.Root__main-view, :where(#main-view)) #SpicyLyricsPage"),
      () => {
        pendingFullscreenOpen = null;
        if (Spicetify.Platform.History.location?.pathname !== "/SpicyLyrics") return;
        if (Fullscreen.IsOpen) return;
        Fullscreen.Open(cinemaView);
      },
      1,
      5000
    );
  };

  let ButtonList: any;
  let pageContainerAvailable = false;
  const syncPopupLyricsButtonVisibility = () => {
    const popupButtonEntry = ButtonList?.[2];
    const popupButton = popupButtonEntry?.Button;
    const popupLyricsAllowed = ('documentPictureInPicture' in window) && $popupLyricsAllowed.get();
    document.body.classList.toggle("SpicyLyrics_PopupLyricsEnabled", popupLyricsAllowed);
    const isPopupButtonRegistered = Boolean(popupButtonEntry?.Registered);

    if (popupButton) {
      if (popupLyricsAllowed && pageContainerAvailable && !isPopupButtonRegistered) {
        popupButton.register();
        if (popupButtonEntry) popupButtonEntry.Registered = true;
      } else if (!popupLyricsAllowed) {
        popupButton.deregister();
        if (popupButtonEntry) popupButtonEntry.Registered = false;
      }
    }

    if (!popupLyricsAllowed) {
      document.querySelectorAll<HTMLElement>("#SpicyLyrics_PopupLyricsButton").forEach((element) => element.remove());
    }

    const spotifyPipButton = document.querySelector<HTMLElement>('[data-testid="pip-toggle-button"]');
    if (spotifyPipButton) {
      spotifyPipButton.style.display = popupLyricsAllowed ? "none" : "";
    }
  };

  const syncExternalCinemaButtonVisibility = () => {
    const externalButtonEntry = ButtonList?.[3];
    const externalButton = externalButtonEntry?.Button;
    const externalButtonElement = externalButton?.element as HTMLElement | undefined;
    const externalCinemaLyricsAllowed = $externalCinemaLyricsAllowed.get();
    const isExternalButtonConnected = !!externalButtonElement?.isConnected;

    if (externalButton) {
      if (externalCinemaLyricsAllowed && pageContainerAvailable && !isExternalButtonConnected) {
        externalButton.register();
        if (externalButtonEntry) externalButtonEntry.Registered = true;
      } else if (!externalCinemaLyricsAllowed && isExternalButtonConnected) {
        externalButton.deregister();
        if (externalButtonEntry) externalButtonEntry.Registered = false;
      }
    }

    document.querySelector<HTMLElement>("#SpicyLyrics_ExternalCinemaButton")?.classList.toggle("disabled", !externalCinemaLyricsAllowed);
  };

  if (SpotifyPlayer.Playbar?.Button) {
    ButtonList = [
      {
        Registered: false,
        Button: new SpotifyPlayer.Playbar.Button(
          "Spicy Lyrics",
          Icons.LyricsPage,
          (self) => {
            if (!self.active) {
              /* const isNewFullscreen = document.querySelector<HTMLElement>(".QdB2YtfEq0ks5O4QbtwX .WRGTOibB8qNEkgPNtMxq");
                if (isNewFullscreen) {
                  PageView.Open();
                  self.active = true;
                } else  */
              Session.Navigate({ pathname: "/SpicyLyrics" });
              if (Global.Saves.shift_key_pressed) {
                openFullscreenOncePageMounts(true);
              }
              //}
            } else {
              Session.GoBack();
              //}
            }
          },
          false,
          false
        ),
      },
      {
        Registered: false,
        Button: new SpotifyPlayer.Playbar.Button(
          "Enter Fullscreen",
          `<svg role="img" height="16" width="16" aria-hidden="true" viewBox="0 0 16 16" data-encore-id="icon" class="Svg-sc-ytk21e-0 Svg-img-16-icon"><path d="M6.064 10.229l-2.418 2.418L2 11v4h4l-1.647-1.646 2.418-2.418-.707-.707zM11 2l1.647 1.647-2.418 2.418.707.707 2.418-2.418L15 6V2h-4z"/></svg>`,
          async (self) => {
            if (!self.active) {
              Session.Navigate({ pathname: "/SpicyLyrics" });
              openFullscreenOncePageMounts(Global.Saves.shift_key_pressed ?? false);
            } else {
              Session.GoBack();
            }
          },
          false,
          false
        ),
      },
      {
        Registered: false,
        // Created whenever the browser supports it; whether it is shown follows
        // $popupLyricsAllowed (see syncPopupLyricsButton).
        Button: (
          ('documentPictureInPicture' in window)
            ? new SpotifyPlayer.Playbar.Button(
              "Spicy Popup Lyrics",
              Icons.PiPMode,
              () => {
                if (IsPIP) {
                  ClosePopupLyrics();
                } else {
                  OpenPopupLyrics();
                }
              },
              false,
              false,
              // Registering is left to syncPopupLyricsButton, which tracks it in
              // `Registered`; registering here showed it even with the setting off.
              false
            )
            : undefined
        )
      },
      {
        Registered: false,
        Button: new SpotifyPlayer.Playbar.Button(
          "Spicy Cinema Window",
          Icons.ExternalCinema,
          () => {
            if (IsExternalCinemaLyrics) {
              CloseExternalCinemaLyrics();
            } else {
              OpenExternalCinemaLyrics();
            }
          },
          false,
          false,
          false
        )
      }
    ];
  }

  // Add shift key tracking
  Global.Saves.shift_key_pressed = false;

  let isHandlingEscape = false;
  const handleEscapeKey = async () => {
    if (isHandlingEscape || IsPIP) return true;
    if (PopupModal.isConnected && PopupModal.querySelector(".slmodal-settingsPanel, .slmodal-animatorPreview")) {
      PopupModal.hide();
      return true;
    }

    if (!PageView.IsOpened) return false;

    isHandlingEscape = true;
    try {
      switch (Defaults.EscapeKeyFunction) {
        case "Exit Fullscreen": {
          if (Fullscreen.IsOpen || Fullscreen.CinemaViewOpen || IsFullscreenClosing()) {
            await Fullscreen.Close();
            return true;
          }
          return false;
        }
        case "Exit Fully": {
          if (Fullscreen.IsOpen || Fullscreen.CinemaViewOpen || IsFullscreenClosing()) {
            if (await Fullscreen.Close()) Session.GoBackFrom("/SpicyLyrics");
            return true;
          }
          Session.GoBackFrom("/SpicyLyrics");
          return true;
        }
        default: {
          if (Fullscreen.IsOpen && !Fullscreen.CinemaViewOpen && document.fullscreenElement) {
            return false;
          }
          if (Fullscreen.IsOpen || Fullscreen.CinemaViewOpen || IsFullscreenClosing()) {
            if (await Fullscreen.Close()) Session.GoBackFrom("/SpicyLyrics");
            return true;
          }
          Session.GoBackFrom("/SpicyLyrics");
          return true;
        }
      }
    } finally {
      isHandlingEscape = false;
    }
  };

  window.addEventListener("keydown", async (e) => {
    if (e.key === "Shift") {
      Global.Saves.shift_key_pressed = true;
      return;
    }

    if (e.key === "Escape") {
      const handled = await handleEscapeKey();
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }, true);

  window.addEventListener("keyup", (e) => {
    if (e.key === "Shift") {
      Global.Saves.shift_key_pressed = false;
    }
  });

  window.addEventListener("blur", () => {
    Global.Saves.shift_key_pressed = false;
  });

  Global.Event.listen("pagecontainer:available", () => {
    if (!ButtonList) return;
    pageContainerAvailable = true;
    for (const [index, button] of ButtonList.entries()) {
      if (!button.Registered) {
        if (index === 2 && !$popupLyricsAllowed.get()) continue;
        if (index === 3 && !$externalCinemaLyricsAllowed.get()) continue;
        if (button.Button) button.Button.register();
        button.Registered = true;
      }
    }
    syncPopupLyricsButtonVisibility();
    syncExternalCinemaButtonVisibility();
  });

  // Only the playbar buttons depend on Playbar.Button. A bare `return` here used
  // to abort the rest of main(): no routing, song-change handling or backgrounds.
  if (ButtonList) {
    const lyricsPageButton = ButtonList[0].Button;
    lyricsPageButton.element.id = "SpicyLyrics_PageButton";
    lyricsPageButton.element.style.setProperty("display", "inline-block", "important");

    const fullscreenButton = ButtonList[1].Button;
    fullscreenButton.element.style.order = "100001";
    fullscreenButton.element.id = "SpicyLyrics_FullscreenButton";
    fullscreenButton.element.style.setProperty("display", "inline-block", "important");

    const popupLyricsButton = ButtonList[2].Button;
    if (popupLyricsButton) {
      popupLyricsButton.element.style.order = "100000";
      popupLyricsButton.element.id = "SpicyLyrics_PopupLyricsButton";
      popupLyricsButton.element.style.setProperty("display", "inline-block", "important");
    }
    const externalCinemaButton = ButtonList[3].Button;
    externalCinemaButton.element.style.order = "99999";
    externalCinemaButton.element.id = "SpicyLyrics_ExternalCinemaButton";

    syncPopupLyricsButtonVisibility();
    syncExternalCinemaButtonVisibility();

    const hideUnwantedButtons = (container: Element) => {
      for (const element of container.children) {
        const testId = element.attributes.getNamedItem("data-testid")?.value;

        const isFullscreen = testId === "fullscreen-mode-button";
        const isGenericControl =
          testId !== "lyrics-button" &&
          testId !== "pip-toggle-button" &&
          element.classList.contains("control-button") &&
          !element.classList.contains("volume-bar__icon-button") &&
          !element.classList.contains("main-devicePicker-controlButton");

        if (
          (isFullscreen || isGenericControl) &&
          element.id !== "SpicyLyrics_PageButton" &&
          element.id !== "SpicyLyrics_FullscreenButton" &&
          element.id !== "SpicyLyrics_PopupLyricsButton" &&
          element.id !== "SpicyLyrics_ExternalCinemaButton"
        ) {
          (element as HTMLElement).style.display = "none";
        }
      }
    };

    Global.Event.listen("playbar:controls", hideUnwantedButtons);
    const controlsContainer = SpotifyPlayer.Playbar.GetControls();
    if (controlsContainer) hideUnwantedButtons(controlsContainer);
    $popupLyricsAllowed.listen(syncPopupLyricsButtonVisibility);
    $externalCinemaLyricsAllowed.listen(syncExternalCinemaButtonVisibility);
  }

  let button: any;
  if (ButtonList) {
    button = ButtonList[0];
  }

  // The page button is offered for tracks only. Applied on every song change,
  // not just at startup, so switching to an episode hides it again.
  const syncLyricsButtonRegistration = () => {
    if (!button) return;
    const isTrack = SpotifyPlayer.GetContentType() === "track";
    if (isTrack && !button.Registered) {
      button.Button.register();
      button.Registered = true;
    } else if (!isTrack && button.Registered) {
      button.Button.deregister();
      button.Registered = false;
    }
  };

  const Hometinue = async () => {
    Whentil.When(
      () => Spicetify.Platform.PlaybackAPI,
      () => {
        requestPositionSync();
      }
    );

    {
      const div = document.createElement("div");
      div.classList.add("sltoaster");
      const reactRoot = ReactDOM.createRoot(div);

      reactRoot.render(
        <SLToaster />
      )

      document.body.appendChild(div);
    }

    // Lets set out Dynamic Background (spicy-dynamic-bg) to the now playing bar
    let lastImgUrl: string | null;
    let lastNowPlayingBarElement: HTMLElement | null = null;
    let nowPlayingBarObserver: MutationObserver | null = null;
    let nowPlayingBarObservedRoot: Element | null = null;
    let nowPlayingBarMutationTimeout: ReturnType<typeof setTimeout> | null = null;

    const getNowPlayingBarElement = GetNPVElementForBackground;

    const scheduleNowPlayingBarDynamicBackgroundApply = () => {
      if (nowPlayingBarMutationTimeout) {
        clearTimeout(nowPlayingBarMutationTimeout);
      }
      nowPlayingBarMutationTimeout = setTimeout(() => {
        nowPlayingBarMutationTimeout = null;
        startNowPlayingBarObserver();
        void applyDynamicBackgroundToNowPlayingBar(SpotifyPlayer.GetCover("large"));
      }, 50);
    };

    const startNowPlayingBarObserver = () => {
      const sidebar = GetNPVObserverRoot();
      if (!sidebar) return;
      SyncNPVVisuals(getNowPlayingBarElement());
      if (nowPlayingBarObserver && sidebar === nowPlayingBarObservedRoot) return;
      nowPlayingBarObserver?.disconnect();
      nowPlayingBarObservedRoot = sidebar;

      nowPlayingBarObserver = new MutationObserver((mutations) => {
        // Resolved once per callback, not once per record.
        const card = GetNPVCardElement();
        const shouldReapply = mutations.some((mutation) => {
          // Cheap type/attribute test first — the ancestor walk below only runs
          // for records that would otherwise schedule a re-apply.
          if (mutation.type === "attributes") {
            const name = mutation.attributeName;
            if (name !== "src" && name !== "class" && name !== "inert" &&
              name !== "aria-hidden" && name !== "hidden" && name !== "aria-label") return false;
          } else if (mutation.type !== "childList") {
            return false;
          }
          // Ignore mutations inside the NPV lyrics card — the lyrics pipeline
          // mutates it constantly, which would reset the debounce below forever
          // and starve the npvbg apply. The card's own insertion/removal still
          // passes (that mutation targets the card's parent).
          const target = mutation.target;
          const targetElement =
            target instanceof Element ? target : target.parentElement;
          return !(card && targetElement && card.contains(targetElement));
        });

        if (!shouldReapply) return;
        SyncNPVVisuals(getNowPlayingBarElement());
        scheduleNowPlayingBarDynamicBackgroundApply();
      });

      // `style` is deliberately absent from the filter: the lyrics animator
      // rewrites inline styles on every mounted word and letter each frame, and
      // the card lives inside this observed subtree. Including it made Blink
      // allocate a MutationRecord per write — hundreds per frame — that this
      // callback then had to walk and discard. Cover swaps already arrive via
      // the `playback:songchange` handler, and DOM-driven re-renders via
      // `childList` / `src` / `class`.
      nowPlayingBarObserver.observe(sidebar, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["src", "class", "inert", "aria-hidden", "hidden", "aria-label"],
      });
    };

    // CSS gates on this body class rather than body:has(aside.spicy-dynamic-bg-in-this),
    // which made every DOM change a candidate for a full-document restyle.
    // Derived from the live aside so a React-swapped aside can't leave it stale.
    const syncNPVDynamicBackgroundClass = () => {
      document.body.classList.toggle(
        "SpicyLyrics_NPVDynamicBackground",
        Boolean(document.querySelector("aside.spicy-dynamic-bg-in-this"))
      );
    };

    const CleanupNowBarDynamicBgLets = () => {
      const nowPlayingBar = getNowPlayingBarElement() ?? lastNowPlayingBarElement;

      const kawarpInstance = KawarpMap.get("npvbg");
      if (kawarpInstance) {
        kawarpInstance.dispose();
        KawarpMap.delete("npvbg");
      }
      nowPlayingBar?.querySelector<HTMLElement>(".spicy-dynamic-bg")?.remove();
      nowPlayingBar?.classList.remove("spicy-dynamic-bg-in-this");
      syncNPVDynamicBackgroundClass();
      lastNowPlayingBarElement = null;
      lastImgUrl = null;
    };

    // Some Spotify views (e.g. cinema) swap the right sidebar layout.
    // When that happens, NPV dynamic background needs to be cleaned up,
    // but page backgrounds (e.g. lpagebg) must remain intact.
    let cinemaViewObserver: MutationObserver | null = null;
    let cinemaViewActive = false;
    // Spotify 1.3.x ships the cinema root under a hash Spicetify doesn't map;
    // its unhashed .over-cinema-scroll child is present in both builds.
    const CINEMA_VIEW_SELECTOR = ".Root__cinema-view, .over-cinema-scroll";

    const getTopContainerElement = () => {
      const rightSidebar = document.querySelector<HTMLElement>(".Root__right-sidebar");
      // `.Root__top-container` is expected to be the parent of `.Root__right-sidebar`.
      const parent = rightSidebar?.parentElement;
      if (parent?.classList.contains("Root__top-container")) return parent;
      return document.querySelector<HTMLElement>(".Root__top-container");
    };

    const checkCinemaViewAndMaybeCleanup = (topContainer: HTMLElement) => {
      const cinemaViewExists = Boolean(topContainer.querySelector(CINEMA_VIEW_SELECTOR));

      if (cinemaViewExists && !cinemaViewActive) {
        cinemaViewActive = true;
        CleanupNowBarDynamicBgLets();
        return;
      }

      if (!cinemaViewExists && cinemaViewActive) {
        cinemaViewActive = false;
        // Restore NPV dynamic background after leaving cinema view.
        scheduleNowPlayingBarDynamicBackgroundApply();
      }
    };

    const startCinemaViewObserver = () => {
      if (cinemaViewObserver) return;

      const topContainer = getTopContainerElement();
      if (!topContainer) return;

      // Initial check (covers late observer start scenarios).
      checkCinemaViewAndMaybeCleanup(topContainer);

      cinemaViewObserver = new MutationObserver(() => {
        if (!topContainer.isConnected) {
          cinemaViewObserver?.disconnect();
          cinemaViewObserver = null;
          cinemaViewActive = false;
          return;
        }

        checkCinemaViewAndMaybeCleanup(topContainer);

        // On 1.3.x the NPV observer root is found through the panel, which
        // can mount after startup; pick it up here and apply once it exists.
        if (!nowPlayingBarObserver) {
          startNowPlayingBarObserver();
          if (nowPlayingBarObserver) scheduleNowPlayingBarDynamicBackgroundApply();
        }
      });

      cinemaViewObserver.observe(topContainer, {
        subtree: true,
        childList: true,
      });
    };

    Whentil.When(
      () => Boolean(getTopContainerElement()),
      () => {
        startCinemaViewObserver();
      }
    );

    async function applyDynamicBackgroundToNowPlayingBar(coverUrl: string | undefined) {
      // Up front so the early returns below can't leave it stale after an aside swap.
      syncNPVDynamicBackgroundClass();
      if (!$showNpvDynamicBg.get()) return;
      if (SpotifyPlayer.GetContentType() === "unknown" && !SpotifyPlayer.IsDJ()) return;
      if (!coverUrl) return;
      const nowPlayingBar = getNowPlayingBarElement();
      const topContainer = getTopContainerElement();
      const cinemaViewExists = Boolean(topContainer?.querySelector(CINEMA_VIEW_SELECTOR));
      // Same rule as the NPV lyrics card: an inert ancestor chain
      // (.Root__right-sidebar <-> aside) means the NPV is not interactive,
      // so its dynamic background should be de-rendered too.
      const npvIsInert = Boolean(nowPlayingBar?.closest('[inert], [hidden], [aria-hidden="true"]'));

      try {
        if (!nowPlayingBar || cinemaViewExists || npvIsInert) {
          lastImgUrl = null;
          CleanupNowBarDynamicBgLets();
          return;
        }
        lastNowPlayingBarElement = nowPlayingBar;
        if (coverUrl === lastImgUrl) return;

        nowPlayingBar.classList.add("spicy-dynamic-bg-in-this");
        syncNPVDynamicBackgroundClass();

        await ApplyDynamicBackground(nowPlayingBar, "npvbg");

        lastImgUrl = coverUrl;
      } catch (error) {
        dynamicBgLogger.error("Failed applying dynamic background to now playing bar", error);
      }
    }

    $showNpvDynamicBg.listen((v) => {
      if (!v) {
        CleanupNowBarDynamicBgLets();
      } else {
        scheduleNowPlayingBarDynamicBackgroundApply();
      }
    });

    $removeSpotifyLyricsButton.subscribe((v) => {
      document.body.classList.toggle("SpicyLyrics_RemoveSpotifyLyricsButton", v);
    });

    startNowPlayingBarObserver();
    scheduleNowPlayingBarDynamicBackgroundApply();

    Global.Event.listen("nowbar:cover-art", () => {
      if (SpotifyPlayer.IsDJ()) scheduleNowPlayingBarDynamicBackgroundApply();
    });

    Global.Event.listen("fullscreen:open", () => {
      CleanupNowBarDynamicBgLets()
    });

    Global.Event.listen("fullscreen:exit", () => {
      scheduleNowPlayingBarDynamicBackgroundApply()
    });

    async function onSongChange(event: any) {
      playbackLogger.debug("Song change pipeline");
      const contentType = SpotifyPlayer.GetContentType();
      playbackLogger.debug("Detected content type", contentType);

      if (contentType === "episode") {
        PageContainer?.classList.add("episode-content-type");
      } else {
        PageContainer?.classList.remove("episode-content-type");
      }

      syncLyricsButtonRegistration();

      if (PageContainer?.querySelector(".ContentBox .NowBar")) {
        if (Fullscreen.IsOpen) {
          UpdateNowBar(true);
        } else {
          UpdateNowBar();
        }
      }

      const songUri = event?.data?.item?.uri;
      if (songUri) {
        if ($lastFetchedUri.get() !== songUri) {
          $lastFetchedUri.set(songUri);
          InvalidatePendingLyricsApplication();
          fetchLyrics(songUri).then((lyrics) => ApplyLyricsIfCurrent(songUri, lyrics));
        }
      }

      const _staticBgMode = $staticBackgroundMode.get() === "off" ? "default" : $staticBackgroundMode.get();
      if (
        _staticBgMode !== "default" &&
        !SpotifyPlayer.IsDJ() &&
        (_staticBgMode === "auto" || _staticBgMode === "artistHeader")
      ) {
        const Artists = SpotifyPlayer.GetArtists();
        const Artist =
          Artists?.map((artist) => artist.uri?.replace("spotify:artist:", ""))[0] ?? undefined;
        try {
          void GetStaticBackground(Artist, SpotifyPlayer.GetId());
        } catch {
          dynamicBgLogger.error("Unable to prefetch static background");
        }
      }

      try {
        void scheduleNowPlayingBarDynamicBackgroundApply();
      } catch (err) {
        dynamicBgLogger.error("Failed applying dynamic background to now playing bar", err);
      }

      const contentBox = PageContainer?.querySelector<HTMLElement>(".ContentBox");
      if (!contentBox || $staticBackgroundMode.get() === "color") return;
      try {
        void ApplyDynamicBackground(contentBox, "lpagebg");
      } catch (err) {
        dynamicBgLogger.error("Failed applying dynamic background to page", err);
      }
    }
    Global.Event.listen("playback:songchange", onSongChange);

    const initUri = SpotifyPlayer.GetUri();
    if (initUri) {
      $lastFetchedUri.set(initUri);
      fetchLyrics(initUri).then(ApplyLyrics);
    }

    const _initStaticBgMode = $staticBackgroundMode.get() === "off" ? "default" : $staticBackgroundMode.get();
    if (
      _initStaticBgMode !== "default" &&
      !SpotifyPlayer.IsDJ() &&
      (_initStaticBgMode === "auto" || _initStaticBgMode === "artistHeader")
    ) {
      const Artists = SpotifyPlayer.GetArtists();
      const Artist =
        Artists?.map((artist) => artist.uri?.replace("spotify:artist:", ""))[0] ?? undefined;
      try {
        await GetStaticBackground(Artist, SpotifyPlayer.GetId());
      } catch {
        dynamicBgLogger.error("Unable to prefetch static background");
      }
    }

    window.addEventListener("online", () => {
      $lastFetchedUri.set(null);

      fetchLyrics(Spicetify.Player.data?.item?.uri).then(ApplyLyrics);
    });

    new IntervalManager(ScrollingIntervalTime, () => {
      if (ScrollSimplebar) {
        ScrollToActiveLine(ScrollSimplebar);
      }
    }, () => PageContainer?.ownerDocument.defaultView ?? window).Start();

    interface Location {
      pathname: string;
      [key: string]: any;
    }

    let lastLocation: Location | null = null;

    async function loadPage(location: Location) {
      appLogger.debug("Handling route change", location.pathname);
      // Recorded before any await: a later navigation must see this one as its
      // previous location, not whatever was current when this call started.
      const previous = lastLocation;
      lastLocation = location;
      if (location.pathname === "/SpicyLyrics") {
        PageView.Open();
        if (button) button.Button.active = true;
      } else if (previous?.pathname === "/SpicyLyrics") {
        if (button) button.Button.active = false;
        await PageView.Destroy();
      }
    }

    Global.Event.listen("platform:history", loadPage);

    if (Spicetify.Platform.History.location.pathname === "/SpicyLyrics") {
      Global.Event.listen("pagecontainer:available", () => {
        loadPage(Spicetify.Platform.History.location);
        if (!button) return;
        button.Button.active = true;
      });
    }

    if (button) {
      button.Button.tippy.setContent("Spicy Lyrics");
    }

    /*
    // This probably won't be added

    let wasPageViewTippyShown = false;
    button.Button.tippy.setProps({
      ...Spicetify.TippyProps,
      content: `Spicy Lyrics`,
      allowHTML: true,
      onShow(instance: any) {
        // Spotify's Code
        instance.popper.firstChild.classList.add("main-contextMenu-tippyEnter");
      },
      onMount(instance: any) {
          // Spotify's Code
          requestAnimationFrame(() => {
            instance.popper.firstChild.classList.remove("main-contextMenu-tippyEnter");
            instance.popper.firstChild.classList.add("main-contextMenu-tippyEnterActive");
          });

          const TippyElement = instance.popper;

          //TippyElement.style.removeProperty("pointer-events");

          const TippyElementContent = TippyElement.querySelector(".main-contextMenu-tippy");
          

          if (!PageView.IsTippyCapable) {
            TippyElementContent.style.width = "";
            TippyElementContent.style.height = "";
            TippyElementContent.style.maxWidth = "";
            TippyElementContent.style.maxHeight = "";

            TippyElement.style.setProperty("--section-border-radius", "");
            TippyElement.style.borderRadius = "";
            TippyElementContent.style.borderRadius = "";

            TippyElementContent.innerHTML = ""
            instance.setContent("Spicy Lyrics");

            return;
          };

          TippyElementContent.innerHTML = "";
          TippyElementContent.style.width = "470px";
          TippyElementContent.style.height = "540px";
          TippyElementContent.style.maxWidth = "none";
          TippyElementContent.style.maxHeight = "none";

          TippyElement.style.setProperty("--section-border-radius", "8px");
          TippyElement.style.borderRadius = "var(--section-border-radius, 8px)";
          TippyElementContent.style.borderRadius = "var(--section-border-radius, 8px)";

          if (!wasPageViewTippyShown) {
            PageView.Destroy();
            instance.unmount();
            wasPageViewTippyShown = true;
            setTimeout(() => instance.show(), 75);
            return;
          }

          PageView.Open(TippyElementContent);
      },
      onHide(instance: any) {
          if (PageView.IsTippyCapable) {
            PageView.Destroy();
          };
          // Spotify's Code
          requestAnimationFrame(() => {
              instance.popper.firstChild.classList.remove("main-contextMenu-tippyEnterActive");
              instance.unmount();
          });
      },
    }); */

    {
      type LoopType = "context" | "track" | "none";
      let lastLoopType: LoopType | null = null;
      // These interval managers are intentionally not stored in variables that are used elsewhere
      // They are self-running background processes that continue to run throughout the app lifecycle
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      new IntervalManager(Infinity, () => {
        const LoopState = Spicetify.Player.getRepeat();
        const LoopType: LoopType = LoopState === 1 ? "context" : LoopState === 2 ? "track" : "none";
        SpotifyPlayer.LoopType = LoopType;
        if (lastLoopType !== LoopType) {
          Global.Event.evoke("playback:loop", LoopType);
        }
        lastLoopType = LoopType;
      }).Start();
    }

    {
      type ShuffleType = "smart" | "normal" | "none";
      let lastShuffleType: ShuffleType | null = null;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      new IntervalManager(Infinity, () => {
        const ShuffleType: ShuffleType = (Spicetify.Player as any).origin._state.smartShuffle
          ? "smart"
          : (Spicetify.Player as any).origin._state.shuffle
            ? "normal"
            : "none";
        SpotifyPlayer.ShuffleType = ShuffleType;
        if (lastShuffleType !== ShuffleType) {
          Global.Event.evoke("playback:shuffle", ShuffleType);
        }
        lastShuffleType = ShuffleType;
      }).Start();
    }

    {
      // Volume changes from anywhere (Spotify's own slider, media keys, another
      // device, our own setVolume) arrive on this native emitter, so there's nothing
      // to poll. `_events` is an undocumented internal — if Spotify ever drops it the
      // guard degrades us to "the volume slider doesn't auto-update" rather than
      // throwing during startup.
      Whentil.When(
        () => Spicetify.Platform?.PlaybackAPI,
        () => {
          try {
            Spicetify.Platform.PlaybackAPI?._events?.addListener?.(
              "volume",
              (e: { data?: { volume?: number } }) => {
                const volume = e?.data?.volume;
                if (typeof volume !== "number") return;
                Global.Event.evoke("playback:volume", volume);
              }
            );
          } catch (err) {
            console.error("Spicy Lyrics: couldn't listen for volume changes", err);
          }
        }
      );
    }

    {
      let lastPosition = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      new IntervalManager(0.5, () => {
        const pos = SpotifyPlayer.GetPosition();
        if (pos !== lastPosition) {
          Global.Event.evoke("playback:position", pos);
        }
        lastPosition = pos;
      }).Start();
    }

    /* {
      let lastPosition = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      new IntervalManager(Infinity, () => {
        const pos = SpotifyPlayer.GetPosition();
        if (pos !== lastPosition) {
          Global.Event.evoke("playback:position_smooth", pos);
        }
        lastPosition = pos;
      }).Start();
    } */

    {
      let lastTimeout: any;
      Global.Event.listen("lyrics:apply", () => {
        if (lastTimeout !== undefined) {
          clearTimeout(lastTimeout);
          lastTimeout = undefined;
        }
        lastTimeout = setTimeout(async () => {
          const currentSongLyrics = $currentLyricsData.get();
          const currentUri = SpotifyPlayer.GetUri() ?? "";
          const currentLyricsId = currentUri.startsWith("spotify:local:")
            ? getSongKey(currentUri)
            : SpotifyPlayer.GetId();
          if (
            currentSongLyrics &&
            currentSongLyrics !== `NO_LYRICS:${currentLyricsId}`
          ) {
            const parsedLyrics = JSON.parse(currentSongLyrics);
            if (parsedLyrics?.id !== currentLyricsId) {
              const refetchUri = currentUri;
              if (refetchUri) {
                $lastFetchedUri.set(refetchUri);
                fetchLyrics(refetchUri).then(ApplyLyrics);
              }
            }
          }
        }, 1000);
      });
    }

    SpotifyPlayer.IsPlaying = IsPlaying();

    // Events
    {
      Spicetify.Player.addEventListener("onplaypause", (e) => {
        SpotifyPlayer.IsPlaying = !e?.data?.isPaused;
        Global.Event.evoke("playback:playpause", e);
      });
      Spicetify.Player.addEventListener("onprogress", (e) =>
        Global.Event.evoke("playback:progress", e)
      );
      Spicetify.Player.addEventListener("songchange", (e) =>
        Global.Event.evoke("playback:songchange", e)
      );

      Whentil.When(GetPageRoot, () => {
        Global.Event.evoke("pagecontainer:available", GetPageRoot());
      });

      Spicetify.Platform.History.listen((e: Location) => {
        Global.Event.evoke("platform:history", e);
      });
      Spicetify.Platform.History.listen(Session.RecordNavigation);
      Session.RecordNavigation(Spicetify.Platform.History.location);

      Global.Event.listen("session:navigation", (data: Location) => {
        closeSettingsOwnedModalOnNavigation(data);
        if (data.pathname === "/SpicyLyrics/Update") {
          Session.GoBack();
          OpenBuildChannelPanel();
        }
      });

      // Check the selected channel's version file every five minutes.
      const CheckForUpdates_Intervaled = async () => {
        try {
          await CheckForUpdates();
        } catch (error) {
          console.warn("Update check failed", error);
        } finally {
          setTimeout(CheckForUpdates_Intervaled, 300_000);
        }
      };
      setTimeout(CheckForUpdates_Intervaled, updatedFromPreviousVersion ? 300_000 : 1000);
    }
  };

  Whentil.When(
    () => SpotifyPlayer.GetContentType(),
    () => syncLyricsButtonRegistration()
  );

  initNPVLyrics();

  Hometinue();

  runThemeMatcher();

  Spicetify.Keyboard.registerImportantShortcut(Spicetify.Keyboard.KEYS.ESCAPE, async () => {
    await handleEscapeKey();
  });

  let isHandlingDocumentFullscreenExit = false;
  document.addEventListener("fullscreenchange", async () => {
    if (isHandlingDocumentFullscreenExit) return;
    if (!document.fullscreenElement && Fullscreen.IsOpen && !Fullscreen.CinemaViewOpen) {
      if (PopupModal.isConnected && PopupModal.querySelector(".slmodal-animatorPreview")) {
        PopupModal.hide();
      }
      if (Defaults.EscapeKeyFunction === "Exit Fullscreen") {
        isHandlingDocumentFullscreenExit = true;
        try {
          await Fullscreen.Close();
        } finally {
          isHandlingDocumentFullscreenExit = false;
        }
        return;
      }

      if (Defaults.EscapeKeyFunction === "Exit Fully") {
        isHandlingDocumentFullscreenExit = true;
        try {
          if (await Fullscreen.Close()) Session.GoBackFrom("/SpicyLyrics");
        } finally {
          isHandlingDocumentFullscreenExit = false;
        }
        return;
      }

      Fullscreen.CinemaViewOpen = true;
      await ExitFullscreenElement();
      PageView.AppendViewControls(true);
    }
  });

  Spicetify.Keyboard.registerImportantShortcut(Spicetify.Keyboard.KEYS.F11, async () => {
    if (IsPIP) return;
    if (Fullscreen.IsOpen) {
      if (!Fullscreen.CinemaViewOpen) {
        Fullscreen.CinemaViewOpen = true;
        await ExitFullscreenElement();
        PageView.AppendViewControls(true);
      } else {
        Fullscreen.CinemaViewOpen = false;
        await EnterSpicyLyricsFullscreen();
        PageView.AppendViewControls(true);
      }
    }
  });

}

main();
