export const SETTING_CATALOG = [
  ["appearance-custom-font", "Use Custom Font", "Use a custom font instead of the bundled Spicy Lyrics font.", "Appearance"],
  ["appearance-background-type", "Background Type", "Choose the dynamic, legacy, static image, or color background.", "Appearance"],
  ["appearance-background-blur", "Background Blur", "Soften the static background image.", "Appearance"],
  ["appearance-npv-background", "Display Dynamic Background in Now Playing View", "Show the animated background in the Now Playing panel.", "Appearance"],
  ["appearance-sliderbar-styling", "New SliderBar Styling", "New glass-like style for the SliderBar. Disable to revert back to the original one.", "Appearance"],
  ["appearance-cover-art-animation", "Cover Art Animation", "Animate cover art changes in the NowBar.", "Effects"],
  ["lyrics-space-gravity", "Space Gravity Mode", "Let word-synced lyrics drift and tumble freely while their timing animations continue.", "Effects"],
  ["lyrics-word-filters", "Unique Word Filters", "Transform every lyric word.", "Effects"],
  ["lyrics-simple-mode", "Simple Lyrics Mode", "Off disables Simple Lyrics Mode. Calculate and Animate choose how simple lyric transitions render.", "Effects"],
  ["effects-animator-presets", "Animator Presets", "Choose Default, Pixel, or Custom animator behavior.", "Effects"],
  ["lyrics-minimal-mode", "Minimal Lyrics Mode", "Hides sung lyrics lines in Fullscreen and Cinema Mode", "Lyrics Display"],
  ["lyrics-right-align", "Right Align Lyrics", "Flip duet/opposite lyric alignment.", "Lyrics Display"],
  ["lyrics-scroll-active", "Show Scroll to Active Button", "Show an arrow when the active lyric is outside the viewport.", "Lyrics Display"],
  ["lyrics-seek-compensation", "Seek Fade-in Compensation", "Seek 300ms before a clicked lyric.", "Lyrics Display"],
  ["lyrics-early-scroll", "Early Scroll", "Start scrolling before the next lyric becomes active.", "Lyrics Display"],
  ["lyrics-early-scroll-time", "Early Scroll Time", "How early to move to the next line.", "Lyrics Display"],
  ["lyrics-smooth-scrolling", "Smooth Scrolling", "Use spring motion for lyric scrolling.", "Lyrics Display"],
  ["lyrics-loading-skeleton", "Lyrics Loading Skeleton", "Show placeholder lines while lyrics load.", "Lyrics Display"],
  ["interface-remove-spotify-lyrics", "Remove Spotify's Lyrics Button", "Hide Spotify's built-in lyrics button.", "Interface"],
  ["lyrics-playback-offset", "Playback Offset", "Shift lyrics timing earlier or later, in milliseconds.", "Lyrics Display"],
  ["lyrics-line-hover", "Line Hover Background", "Shows a highlight box behind a lyrics line when you hover over it", "Lyrics Display"],
  ["lyrics-wide-duet-padding", "Wide duet line padding", "Separate duet voices into wider columns. Disable for compact padding.", "Lyrics Display"],
  ["interface-lock-media-box", "Lock Media Box Size in Compact Mode", "Prevent the media box from resizing when Forced Compact Mode is active.", "Interface"],
  ["interface-disable-popup", "Disable Popup Lyrics Window", "Show or hide the Popup Lyrics button in the playback bar.", "Interface"],
  ["interface-open-profiles-browser", "Open Profiles in Browser", "Open contributor profiles in your browser instead of inside Spotify.", "Interface"],
  ["interface-view-controls", "View Controls Position", "Where the view controls (play, scroll, etc.) appear.", "Interface"],
  ["interface-always-fullscreen", "Always Show In Fullscreen", "Keep fullscreen time or controls visible.", "Interface"],
  ["interface-fullscreen-volume", "Fullscreen Volume Slider", "Show a volume slider in fullscreen and Cinema View.", "Interface"],
  ["interface-release-year", "Release Year Position", "Show release year near track metadata.", "Interface"],
  ["interface-animate-close", "Animate closing fullscreen", "Slide the lyrics page away when closing fullscreen.", "Interface"],
  ["interface-escape-key", "Escape Key Function", "Choose how Escape behaves in lyrics fullscreen.", "Interface"],
  ["interface-disable-npv", "Disable NPV Lyrics", "Never show the lyrics card in the Now Playing sidebar.", "Interface"],
  ["interface-hide-empty-npv", "Hide NPV Lyrics When No Lyrics Are Available", "Remove the lyrics card when the current song has no lyrics.", "Interface"],
  ["advanced-cache-button", "Lyrics View Cache Button", "Show a selected cache action in the lyrics view controls.", "Sources"],
  ["advanced-cache-actions", "Cache Actions", "Clear all current-song caches, clear current in-memory lyrics, or clear stored lyrics cache.", "Sources"],
] as const;

export type SettingId = (typeof SETTING_CATALOG)[number][0];
export type SettingCatalogEntry = { id: SettingId; label: string; description: string; category: string };

export const SETTINGS = SETTING_CATALOG.map(([id, label, description, category]) => ({ id, label, description, category })) as SettingCatalogEntry[];
export const SETTING_IDS = new Set<string>(SETTINGS.map((setting) => setting.id));
export const SETTING_SECTIONS = ["Appearance", "Lyrics Display", "Effects", "Interface", "Sources", "Advanced"];

export function isSettingVisible(hiddenIds: string[], id: string, matched = true) {
  return matched && !hiddenIds.includes(id);
}
