export const isDev = false;

const Defaults = {
  lyrics: {
    api: {
      url: isDev ? "http://localhost:3000" : "https://api.spicylyrics.org",
    },
  },
  CurrentLyricsType: "None",
  DeveloperMode: false,
  LyricsRenderer: "Spicy",
  RightAlignLyrics: false,
  EscapeKeyFunction: "Default" as string,
  BuildChannel: "Stable" as string,
  CustomFontEnabled: false,
  CustomFont: "",
  AlwaysShowInFullscreen: "None" as string,
  ShowVolumeSliderFullscreen: "Off" as string,
  ReleaseYearPosition: "Off" as string,
  CoverArtAnimation: true,
  MemeFormat: "Off" as string,
  DisplayLyricsHoverPill: false,
  AnimateFullscreenClose: false,
  EnableExperimentalWordSync: false,
  LyricsSourceOrder: ["spicy", "musixmatch", "apple", "spotify", "lrclib", "netease"],
  DisabledLyricsSourceIds: ["lrclib", "netease"] as string[],
  IgnoreMusixmatchWordSync: true,
  PrioritizeAppleMusicQuality: true,
};

export default Defaults;
