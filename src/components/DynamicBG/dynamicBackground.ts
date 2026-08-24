import { $staticBackgroundBlur, $staticBackgroundMode } from "../../utils/stores.ts";
import Global from "../Global/Global.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import ArtistVisuals from "./ArtistVisuals/Main.ts";
import { PageContainer } from "../Pages/PageView.ts";
import Kawarp, { type KawarpOptions } from "@kawarp/core";
import { BackgroundAnimationController, type AudioAnalysisData } from "./BackgroundAnimationController.ts";
import { getDynamicAudioAnalysis } from "../../utils/audioAnalysis.ts";
import Logger from "../../utils/Logger.ts";

const dynamicBgLogger = new Logger("Dynamic Background");

const KawarpTransitionDuration = 1000;
export const KawarpOptionsStatic: KawarpOptions = {
  warpIntensity: 1,
  blurPasses: 8,
  animationSpeed: 0.1,
  saturation: 1.5,
  dithering: 0.008,
  transitionDuration: 500,
  // tintColor: [0.16, 0.16, 0.24],
  tintIntensity: 0, // 0.15
  scale: 1,
}

const COLOR_BG_FALLBACK_RGB = "18, 18, 18, 1";
let cachedColorBackgroundEl: HTMLElement | null = null;

export const KawarpMap = new Map<HTMLElement | string, Kawarp>();
const animSpeedController = new BackgroundAnimationController();

interface ApplyDynamicBackgroundOpts {
  doTransitionDurationAppendWithPromise?: boolean;
  forceRecreate?: boolean;
}

const normalizeCoverUrl = (cover?: string): string => {
  if (!cover) return "";
  return cover.replace("spotify:image:", "https://i.scdn.co/image/");
};

const parseCssImageUrl = (backgroundImage?: string): string => {
  if (!backgroundImage) return "";
  const match = backgroundImage.match(/^url\((["']?)(.*)\1\)$/);
  return match?.[2] ?? "";
};

const getRenderedNowBarCover = (): string => {
  const mediaImageContainer = PageContainer?.querySelector<HTMLElement>(
    ".ContentBox .NowBar .Header .MediaBox .MediaImageContainer"
  );
  if (!mediaImageContainer) return "";

  const lastImageUrl = mediaImageContainer.getAttribute("last-image-url");
  if (lastImageUrl) return lastImageUrl;

  for (const selector of [".fi_FromImage", ".ti_ToImage"]) {
    const image = mediaImageContainer.querySelector<HTMLElement>(selector);
    const imageUrl = parseCssImageUrl(image?.style.backgroundImage);
    if (imageUrl) return imageUrl;
  }

  const img = mediaImageContainer.querySelector<HTMLImageElement>("img");
  return img?.currentSrc || img?.src || "";
};

const getDynamicBackgroundCover = (): string => {
  const renderedCover = SpotifyPlayer.IsLocalTrack() || SpotifyPlayer.IsDJ()
    ? getRenderedNowBarCover()
    : "";
  return normalizeCoverUrl(renderedCover || SpotifyPlayer.GetCover("large"));
};

const loadImageElement = (src: string, targetWindow: Window = window): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new (targetWindow as Window & typeof globalThis).Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
};

const loadKawarpCover = async (kawarpInstance: Kawarp, cover: string, targetDocument: Document = document) => {
  const targetWindow = targetDocument.defaultView ?? window;
  if (cover.startsWith("spotify:localfileimage:")) {
    const img = await loadImageElement(cover, targetWindow);
    kawarpInstance.loadImageElement(img);
    return;
  }

  if (cover.startsWith("blob:") || cover.startsWith("data:image/")) {
    const response = await fetch(cover);
    const blob = await response.blob();
    const bitmap = await (targetWindow.createImageBitmap?.(blob) ?? createImageBitmap(blob));
    const canvas = targetDocument.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      await kawarpInstance.loadBlob(blob);
      return;
    }

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    kawarpInstance.loadFromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
    return;
  }

  await kawarpInstance.loadImage(cover);
};

export default async function ApplyDynamicBackground(element: HTMLElement, tag?: string, opts: ApplyDynamicBackgroundOpts = {}) {
  if (!element) return;
  // The NPV lyrics card must stay transparent so the NPV background remains visible.
  if (element.closest("#SpicyLyricsPage.CardMode")) return;
  const targetDocument = element.ownerDocument ?? document;
  const targetWindow = targetDocument.defaultView ?? window;
  dynamicBgLogger.debug("Applying dynamic background", { tag });
  const currentImgCover = getDynamicBackgroundCover();
  const IsEpisode = SpotifyPlayer.GetContentType() === "episode";

  const artists = SpotifyPlayer.GetArtists() ?? [];
  const TrackArtist =
    artists.length > 0 && artists[0]?.uri
      ? artists[0].uri.replace("spotify:artist:", "")
      : undefined;

  const TrackId = SpotifyPlayer.GetId() ?? undefined;
  
  const staticBgMode = $staticBackgroundMode.get() === "off" ? "default" : $staticBackgroundMode.get();
  const removeBackground = (bg: HTMLElement) => {
    const kawarpInstance = KawarpMap.get(tag ?? bg);
    if (kawarpInstance && bg.tagName.toLowerCase() === "canvas") {
      kawarpInstance.dispose();
      KawarpMap.delete(tag ?? bg);
    }
    bg.remove();
  };

  if (staticBgMode === "legacy" || SpotifyPlayer.IsDJ()) {
    if (IsEpisode || !currentImgCover) return;

    element
      .querySelectorAll<HTMLElement>(".spicy-dynamic-bg:not(.LegacyBackground)")
      .forEach(removeBackground);

    const prevBg = element.querySelector<HTMLElement>(".spicy-dynamic-bg.LegacyBackground");
    if (prevBg?.getAttribute("data-cover-id") === currentImgCover) return;

    const dynamicBg = targetDocument.createElement("div");
    dynamicBg.classList.add("spicy-dynamic-bg", "LegacyBackground", "Hidden");
    dynamicBg.setAttribute("data-cover-id", currentImgCover);

    for (const className of ["Back", "BackCenter", "Front"]) {
      const layer = targetDocument.createElement("div");
      layer.classList.add(className);
      layer.style.backgroundImage = `url("${currentImgCover}")`;
      dynamicBg.appendChild(layer);
    }

    element.appendChild(dynamicBg);
    targetWindow.setTimeout(() => {
      if (prevBg) {
        prevBg.classList.add("Hidden");
        targetWindow.setTimeout(() => prevBg?.remove(), 500);
      }
      dynamicBg.classList.remove("Hidden");
    }, 80);
    return;
  }

  if (staticBgMode !== "default" && staticBgMode !== "legacy") {
    const activeClass =
      staticBgMode === "color" ? "ColorBackground" : "StaticBackground";
    element
      .querySelectorAll<HTMLElement>(`.spicy-dynamic-bg:not(.${activeClass})`)
      .forEach(removeBackground);

    if (staticBgMode === "color") {
      // First, create/init the background with black as a fallback
      let dynamicBg = element.querySelector<HTMLElement>(".spicy-dynamic-bg.ColorBackground");
      if (!dynamicBg) {
        dynamicBg = targetDocument.createElement("div");
        dynamicBg.classList.add("spicy-dynamic-bg", "ColorBackground");
        // Set initial fallback colors to black
        dynamicBg.style.setProperty("--MinContrastColor", COLOR_BG_FALLBACK_RGB);
        dynamicBg.style.setProperty("--HighContrastColor", COLOR_BG_FALLBACK_RGB);
        dynamicBg.style.setProperty("--OverlayColor", COLOR_BG_FALLBACK_RGB);
        element.appendChild(dynamicBg);
      }
      cachedColorBackgroundEl = dynamicBg;

      // Now fetch the real colors and apply them
      try {
        const colorQuery = await Spicetify.GraphQL.Request(
          Spicetify.GraphQL.Definitions.getDynamicColorsByUris,
          {
            imageUris: [currentImgCover]
          }
        );

        const colorResponse = colorQuery.data.dynamicColors[0];
        const colorBestFit = colorResponse.bestFit === "DARK" ? "dark" : colorResponse.bestFit === "LIGHT" ? "light" : "dark";

        const colors = colorResponse[colorBestFit];
        const fromColorObj = colors.minContrast;
        const toColorObj = colors.highContrast;
        const overlayColorObj = colors.higherContrast;

        const fromColorBgObj = fromColorObj.backgroundBase;
        const toColorBgObj = toColorObj.backgroundBase;
        const overlayColorBgObj = overlayColorObj.backgroundBase;

        const fromColor = `${fromColorBgObj.red}, ${fromColorBgObj.green}, ${fromColorBgObj.blue}, ${fromColorBgObj.alpha}`;
        const toColor = `${toColorBgObj.red}, ${toColorBgObj.green}, ${toColorBgObj.blue}, ${toColorBgObj.alpha}`;
        const overlayColor = `${overlayColorBgObj.red}, ${overlayColorBgObj.green}, ${overlayColorBgObj.blue}, ${overlayColorBgObj.alpha}`;

        dynamicBg.style.setProperty("--MinContrastColor", fromColor);
        dynamicBg.style.setProperty("--HighContrastColor", toColor);
        dynamicBg.style.setProperty("--OverlayColor", overlayColor);
      } catch (err) {
        // If the color fetch fails, just keep the black fallback
        dynamicBgLogger.error("Failed to fetch dynamic colors, using fallback black background", err);
      }
      return;
    }
    const staticBackgroundCover = await GetStaticBackground(TrackArtist, TrackId);

    if (IsEpisode || !staticBackgroundCover) return;
    const prevBg = element.querySelector<HTMLElement>(".spicy-dynamic-bg.StaticBackground");

    if (prevBg && prevBg.getAttribute("data-cover-id") === staticBackgroundCover) {
      return;
    }
    const dynamicBg = targetDocument.createElement("div");

    dynamicBg.classList.add("spicy-dynamic-bg", "StaticBackground", "Hidden");

    //const processedCover = `https://i.scdn.co/image/${currentImgCover.replace("spotify:image:", "")}`;

    dynamicBg.style.backgroundImage = `url("${staticBackgroundCover}")`;
    dynamicBg.setAttribute("data-cover-id", staticBackgroundCover);
    element.appendChild(dynamicBg);

    targetWindow.setTimeout(() => {
      if (prevBg) {
        prevBg.classList.add("Hidden");
        targetWindow.setTimeout(() => prevBg?.remove(), 500);
      }
      dynamicBg.classList.remove("Hidden");
    }, 80);
  } else {
    if (IsEpisode || !currentImgCover) return;

    element
      .querySelectorAll<HTMLElement>(".spicy-dynamic-bg:not(canvas)")
      .forEach(removeBackground);

    const existingElement = element.querySelector<HTMLElement>("canvas.spicy-dynamic-bg");
  
    if (existingElement && !opts.forceRecreate) {
      const existingBgData = existingElement.getAttribute("data-cover-id") ?? null;

      if (existingBgData === currentImgCover && !SpotifyPlayer.IsLocalTrack()) {
        return;
      }
      const kawarpInstance = KawarpMap.get(
        tag ?
          tag :
          existingElement
      )

      if (kawarpInstance) {
        existingElement.setAttribute("data-cover-id", currentImgCover ?? "");
        await loadKawarpCover(kawarpInstance, currentImgCover, targetDocument);
        kawarpInstance.start();
        return;
      }
    }

    if (existingElement && opts.forceRecreate) {
      removeBackground(existingElement);
    }

    const canvas = targetDocument.createElement("canvas");
    canvas.classList.add("spicy-dynamic-bg");
    canvas.setAttribute("data-cover-id", currentImgCover ?? "");

    const kawarpInstance = new Kawarp(canvas, KawarpOptionsStatic)
    KawarpMap.set(
      tag ?
        tag :
        canvas,
      kawarpInstance
    )
    element.appendChild(canvas);
    await loadKawarpCover(kawarpInstance, currentImgCover, targetDocument);
    kawarpInstance.start();
    const msDelay = KawarpOptionsStatic.transitionDuration * 2;

    if (opts?.doTransitionDurationAppendWithPromise) {
      await new Promise(r => targetWindow.setTimeout(r, msDelay));
      kawarpInstance?.setOptions({ transitionDuration: KawarpTransitionDuration });
    } else {
      targetWindow.setTimeout(() => {
        kawarpInstance?.setOptions({ transitionDuration: KawarpTransitionDuration });
      }, msDelay);
    }
  }
}

export async function GetStaticBackground(
  TrackArtist: string | undefined,
  TrackId: string | undefined
): Promise<string | undefined> {
  if (!TrackArtist || !TrackId) return undefined;

  try {
    return await ArtistVisuals.ApplyContent(TrackArtist, TrackId);
  } catch (error) {
    dynamicBgLogger.error("Error setting static low quality dynamic background", error);
    return undefined;
  }
}

let staticColorBgTransitionTimeout = null;

const getColorBackgroundElement = (): HTMLElement | null => {
  if (cachedColorBackgroundEl?.isConnected) {
    return cachedColorBackgroundEl;
  }
  const el = PageContainer?.querySelector<HTMLElement>(".spicy-dynamic-bg.ColorBackground") ?? null;
  cachedColorBackgroundEl = el;
  return el;
};

Global.Event.listen("playback:songchange", () => {
  if ($staticBackgroundMode.get() === "color" && PageContainer) {
    if (staticColorBgTransitionTimeout) {
      clearTimeout(staticColorBgTransitionTimeout);
      staticColorBgTransitionTimeout = null;

      const dynamicBg = getColorBackgroundElement();
      if (dynamicBg) {
        const min = dynamicBg.style.getPropertyValue("--MinContrastColor").trim();
        const high = dynamicBg.style.getPropertyValue("--HighContrastColor").trim();
        const overlay = dynamicBg.style.getPropertyValue("--OverlayColor").trim();
        if (
          min !== COLOR_BG_FALLBACK_RGB ||
          high !== COLOR_BG_FALLBACK_RGB ||
          overlay !== COLOR_BG_FALLBACK_RGB
        ) {
          dynamicBg.style.setProperty("--MinContrastColor", COLOR_BG_FALLBACK_RGB);
          dynamicBg.style.setProperty("--HighContrastColor", COLOR_BG_FALLBACK_RGB);
          dynamicBg.style.setProperty("--OverlayColor", COLOR_BG_FALLBACK_RGB);
        }
      }
    }

    const targetWindow = PageContainer.ownerDocument.defaultView ?? window;
    staticColorBgTransitionTimeout = targetWindow.setTimeout(() => {
      const contentBox = PageContainer.querySelector<HTMLElement>(".ContentBox");
      if (contentBox) ApplyDynamicBackground(contentBox);

      targetWindow.clearTimeout(staticColorBgTransitionTimeout);
      staticColorBgTransitionTimeout = null;
    }, 1000);
  }
})

/** Successful analysis, or `null` once we know the track has no analysis (stops progress-handler spam). */
const audioAnalysisCache = new Map<string, AudioAnalysisData | null>();
const audioAnalysisInflightRequests = new Map<string, Promise<AudioAnalysisData | null>>();
let latestPlaybackTrackId: string | null = null;

const pruneAudioAnalysisCache = (activeTrackId: string) => {
  for (const cachedTrackId of audioAnalysisCache.keys()) {
    if (cachedTrackId !== activeTrackId) {
      audioAnalysisCache.delete(cachedTrackId);
    }
  }
};

const getAudioAnalysisForTrack = async (trackId: string): Promise<AudioAnalysisData | null> => {
  if (audioAnalysisCache.has(trackId)) {
    return audioAnalysisCache.get(trackId)!;
  }

  const inflight = audioAnalysisInflightRequests.get(trackId);
  if (inflight) {
    return inflight;
  }

  const request = getDynamicAudioAnalysis(trackId)
    .then((analysis) => {
      audioAnalysisCache.set(trackId, analysis);
      return analysis;
    })
    .finally(() => {
      audioAnalysisInflightRequests.delete(trackId);
    });

  audioAnalysisInflightRequests.set(trackId, request);
  return request;
};

const setDynamicBackgroundAnimationSpeed = (speed: number) => {
  KawarpMap.forEach((kawarpInstance) => {
    void kawarpInstance.setOptions({
      animationSpeed: speed
    })
  })
};

const resetDynamicBackgroundAnimationSpeed = () => {
  setDynamicBackgroundAnimationSpeed(1);
};

Global.Event.listen("playback:songchange", () => {
  latestPlaybackTrackId = SpotifyPlayer.GetId();

  if (latestPlaybackTrackId) {
    pruneAudioAnalysisCache(latestPlaybackTrackId);
  } else {
    audioAnalysisCache.clear();
  }
});

const applyPlayPauseAnimationSpeed = (isPaused: boolean) => {
  if ($staticBackgroundMode.get() === "legacy") {
    setDynamicBackgroundAnimationSpeed(0.1);
    return;
  }
  setDynamicBackgroundAnimationSpeed(isPaused ? 0.1 : 1);
};

Global.Event.listen("playback:playpause", (e: { data?: { isPaused?: boolean } }) => {
  applyPlayPauseAnimationSpeed(!!e?.data?.isPaused);
});

// TODO: Make this also remove the NPV dynamic bg when we switch to staticBackground mode, as that should be removed.
const reapplyPageBackground = () => {
  const contentBox = PageContainer?.querySelector<HTMLElement>(".ContentBox");
  if (!contentBox) return;
  const kawarp = KawarpMap.get("lpagebg");
  if (kawarp) {
    kawarp.dispose();
    KawarpMap.delete("lpagebg");
  }
  contentBox.querySelectorAll<HTMLElement>(".spicy-dynamic-bg").forEach((el) => el.remove());
  void ApplyDynamicBackground(contentBox, "lpagebg");
};

$staticBackgroundMode.listen(reapplyPageBackground);

Global.Event.listen("nowbar:cover-art", () => {
  if (!SpotifyPlayer.IsLocalTrack() && !SpotifyPlayer.IsDJ()) return;
  if ($staticBackgroundMode.get() !== "off" && $staticBackgroundMode.get() !== "default") return;

  const contentBox = PageContainer?.querySelector<HTMLElement>(".ContentBox");
  if (!contentBox) return;

  void ApplyDynamicBackground(contentBox, "lpagebg");
});

// Blur is a pure paint change on the existing element, so push it straight into a
// CSS var rather than tearing the background down and rebuilding it.
//
// The var goes on #SpicyLyricsPage itself, not just the root, because in PiP the
// page lives in the popup's own document — that document's <html> never sees
// anything we write here, so a root-only var falls back to 0px there.
const applyStaticBackgroundBlur = (blur: number) => {
  const value = `${blur}px`;
  document.documentElement.style.setProperty("--StaticBackgroundBlur", value);
  PageContainer?.style.setProperty("--StaticBackgroundBlur", value);
};

applyStaticBackgroundBlur($staticBackgroundBlur.get());
$staticBackgroundBlur.listen(applyStaticBackgroundBlur);

// A freshly opened page (PiP or otherwise) is a brand new element with no inline
// var on it, so seed it from the current setting.
Global.Event.listen("page:open", () => {
  applyStaticBackgroundBlur($staticBackgroundBlur.get());
});

Global.Event.listen("playback:progress", async (e) => {
  const songId = SpotifyPlayer.GetId();
  if ($staticBackgroundMode.get() === "legacy") {
    setDynamicBackgroundAnimationSpeed(0.1);
    return;
  }
  if (!songId) {
    resetDynamicBackgroundAnimationSpeed();
    return;
  }

  latestPlaybackTrackId = songId;
  const requestTrackId = songId;

  const audioAnalysisData = await getAudioAnalysisForTrack(requestTrackId);
  if (!audioAnalysisData) {
    resetDynamicBackgroundAnimationSpeed();
    return;
  }

  // Prevent stale async results from old tracks applying after rapid song switches.
  const currentTrackId = SpotifyPlayer.GetId();
  if (!currentTrackId || currentTrackId !== requestTrackId || latestPlaybackTrackId !== requestTrackId) {
    return;
  }

  pruneAudioAnalysisCache(requestTrackId);

  const currentTimeMs = SpotifyPlayer.GetPosition();
  const currentTime = currentTimeMs / 1000;

  const speedMultiplier = animSpeedController.getSpeedMultiplier(currentTime, audioAnalysisData);

  KawarpMap.forEach((kawarpInstance) => {
    void kawarpInstance.setOptions({
      animationSpeed: speedMultiplier
    })
  })
})
