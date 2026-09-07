import { atom } from "nanostores";
import { ProjectVersion } from "../../project/config.ts";
import { SETTING_IDS } from "../components/ReactComponents/SettingsPanel/hiddenSettings.ts";

export const SETTINGS_KEY = "SL:settings";

function readSettingsBlob(): Record<string, any> {
  const raw = Spicetify.LocalStorage.get(SETTINGS_KEY);
  if (raw === null || raw === undefined) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveSettingsBlob(obj: Record<string, any>) {
  Spicetify.LocalStorage.set(SETTINGS_KEY, JSON.stringify(obj));
}

function migrateSettingsKeys(blob: Record<string, any>): Record<string, any> {
  const renames: Record<string, string> = {
    "skip-spicy-font": "skipSpicyFont",
    show_npv_dynamic_bg: "showNpvDynamicBg",
    displayLyricsHoverPill: "lineHoverBackground",
  };
  let changed = false;
  for (const [oldKey, newKey] of Object.entries(renames)) {
    if (oldKey in blob) {
      if (!(newKey in blob)) blob[newKey] = blob[oldKey];
      delete blob[oldKey];
      changed = true;
    }
  }
  if (changed) saveSettingsBlob(blob);
  return blob;
}

const _settings: Record<string, any> = migrateSettingsKeys(readSettingsBlob());

/**
 * An atom backed by the settings blob. Exported so feature modules (e.g.
 * `experiments.ts`) can register their own persisted settings without having to
 * add a line here for every one.
 */
export function persistAtom<T>(key: string, defaultValue: T) {
  const store = atom<T>(_settings[key] !== undefined ? _settings[key] : defaultValue);
  store.listen((v) => {
    _settings[key] = v;
    saveSettingsBlob(_settings);
  });
  return store;
}

// Setting atoms (persisted)
export const $staticBackgroundMode = persistAtom<string>("staticBackgroundMode", "default");
// Blur radius (px) applied to image-based static backgrounds — not the "color" mode.
export const $staticBackgroundBlur = persistAtom<number>("staticBackgroundBlur", 0);
export const $simpleLyricsMode = persistAtom<boolean>("simpleLyricsMode", false);
export const $simpleLyricsModeRenderingType = persistAtom<string>(
  "simpleLyricsModeRenderingType",
  "calculate"
);
export const $minimalLyricsMode = persistAtom<boolean>("minimalLyricsMode", false);
// Tinted box drawn behind a lyrics line while the pointer is over it.
export const $lineHoverBackground = persistAtom<boolean>("lineHoverBackground", true);
export const $skipSpicyFont = persistAtom<boolean>("skipSpicyFont", false);
export const $showNpvDynamicBg = persistAtom<boolean>("showNpvDynamicBg", true);
// Never inject the lyrics card into the Now Playing sidebar at all.
export const $disableNpvLyrics = persistAtom<boolean>("disableNpvLyrics", false);
// Pull the whole NPV lyrics card out of the sidebar while the current track has
// no lyrics, instead of leaving it up showing the "no lyrics" notice.
export const $hideNpvLyricsWhenUnavailable = persistAtom<boolean>(
  "hideNpvLyricsWhenUnavailable",
  true
);
export const $lockedMediaBox = persistAtom<boolean>("lockedMediaBox", false);
// $popupLyricsAllowed: stored as actual boolean "popupLyricsAllowed" in the settings blob.
export const $popupLyricsAllowed = (() => {
  const initial: boolean =
    _settings["popupLyricsAllowed"] !== undefined ? _settings["popupLyricsAllowed"] : true;
  const store = atom<boolean>(initial);
  store.listen((v) => {
    _settings["popupLyricsAllowed"] = v;
    saveSettingsBlob(_settings);
  });
  return store;
})();
export const $externalCinemaLyricsAllowed = persistAtom<boolean>("externalCinemaLyricsAllowed", false);
export const $viewControlsPosition = persistAtom<string>("viewControlsPosition", "Top");
export const $ttmlMakerMode = persistAtom<boolean>("ttmlMakerMode", true);
export const $developerMode = persistAtom<boolean>("developerMode", false);
export const $showLyricsCacheActionButton = persistAtom<boolean>(
  "showLyricsCacheActionButton",
  false
);
export const $lyricsCacheAction = persistAtom<string>(
  "lyricsCacheAction",
  "all-current"
);
export const $rightAlignLyrics = persistAtom<boolean>("rightAlignLyrics", false);
export const $escapeKeyFunction = persistAtom<string>("escapeKeyFunction", "Default");
export const $buildChannel = persistAtom<string>("buildChannel", "Stable");
export type PinnedFooterMode = "Off" | "No Writers" | "Full";
export const $pinnedFooterMode = persistAtom<PinnedFooterMode>(
  "pinnedFooterMode",
  _settings["experiment:pinLyricsFooter"] ? "Full" : "Off",
);
export const $customFontEnabled = persistAtom<boolean>("customFontEnabled", false);
export const $customFont = persistAtom<string>("customFont", "");
export const $alwaysShowInFullscreen = persistAtom<string>("alwaysShowInFullscreen", "None");
export const $showVolumeSliderFullscreen = persistAtom<string>("showVolumeSliderFullscreen", "Off");
export const $releaseYearPosition = persistAtom<string>("releaseYearPosition", "Off");
export const $coverArtAnimation = persistAtom<boolean>("coverArtAnimation", true);
// Scatter word-synced lyrics into a floating physics field instead of line layout.
export const $spaceGravityMode = persistAtom<boolean>("spaceGravityMode", false);
export const $memeFormat = persistAtom<string>("memeFormat", "Off");
export const $showScrollToActiveButton = persistAtom<boolean>("showScrollToActiveButton", true);
export const $animateFullscreenClose = persistAtom<boolean>("animateFullscreenClose", false);
export const $enableExperimentalWordSync = persistAtom<boolean>("enableExperimentalWordSync", false);
export const $lyricsSourceOrder = persistAtom<string>(
  "lyricsSourceOrder",
  JSON.stringify(["spicy", "musixmatch", "apple", "spotify", "lrclib", "netease"])
);
export const $disabledLyricsSources = persistAtom<string>(
  "disabledLyricsSources",
  JSON.stringify(["lrclib", "netease"])
);
export const $ignoreMusixmatchWordSync = persistAtom<boolean>("ignoreMusixmatchWordSync", true);
export const $prioritizeAppleMusicQuality = persistAtom<boolean>("prioritizeAppleMusicQuality", true);
export const $musixmatchToken = persistAtom<string>("musixmatchToken", "");
// Reserved for upstream's in-artwork volume controller. This fork keeps its
// own placement selector, so the controller stays disabled.
export const $showVolumeSlider = persistAtom<boolean>("showVolumeSlider", false);
// Playback timing offset in milliseconds (bipolar: negative = earlier, positive = later)
export const $playbackOffset = persistAtom<number>("playbackOffset", 0);
export const $allowHidingSettings = persistAtom<boolean>("allowHidingSettings", false);
export const $hideHidingIcon = persistAtom<boolean>("hideHidingIcon", false);
const initialHiddenSettingIds = Array.isArray(_settings.hiddenSettingIds)
  ? _settings.hiddenSettingIds.filter((id): id is string => typeof id === "string" && SETTING_IDS.has(id))
  : [];
export const $hiddenSettingIds = persistAtom<string[]>("hiddenSettingIds", initialHiddenSettingIds);

// Version atom — NOT persisted, set once at startup
export const $spicyLyricsVersion = atom<string>(
  (window as any)._spicy_lyrics_metadata?.LoadedVersion ?? ProjectVersion
);

// Runtime (ephemeral) atoms
export const $currentLyricsType = atom<string>("None");
export const $lyricsContainerExists = atom<boolean>(false);
// Keeps a mounted lyrics page idle while the NPV card body is collapsed.
// This is runtime-only: a new page always resumes rendering when it opens.
export const $lyricsRendererPaused = atom<boolean>(false);
export const $currentlyFetching = atom<boolean>(false);
export const $currentLyricsData = atom<string>("");
