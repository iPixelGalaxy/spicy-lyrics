import { useStore } from "@nanostores/react";
import {
  $alwaysShowInFullscreen,
  $allowHidingSettings,
  $animateFullscreenClose,
  $disableNpvLyrics,
  $escapeKeyFunction,
  $hideNpvLyricsWhenUnavailable,
  $hiddenSettingIds,
  $lockedMediaBox,
  $popupLyricsAllowed,
  $releaseYearPosition,
  $showVolumeSliderFullscreen,
  $viewControlsPosition,
} from "../../../utils/stores.ts";
import { $isGlobalNav } from "../../../utils/uiState.ts";
import { matches, Row, Select, SectionTitle, Toggle } from "./components.tsx";

const SECTION_NAME = "Interface";
const vcPositionOptions = ["Top", "Bottom"];
const fullscreenOptions = ["None", "Controls", "Time", "Both"];
const volumeOptions = ["Off", "Left", "Right", "Below"];
const releaseYearOptions = ["Off", "Left", "Right"];
const escapeOptions = ["Default", "Exit Fullscreen", "Exit Fully"];

interface Props { query: string; sectionFilter: string; showHidden?: boolean; }

export default function InterfaceSection({ query, sectionFilter, showHidden = false }: Props) {
  const lockedMediaBox = useStore($lockedMediaBox);
  const allowHidingSettings = useStore($allowHidingSettings);
  const popupLyricsAllowed = useStore($popupLyricsAllowed);
  const viewControlsPosition = useStore($viewControlsPosition);
  const alwaysShowInFullscreen = useStore($alwaysShowInFullscreen);
  const showVolumeSliderFullscreen = useStore($showVolumeSliderFullscreen);
  const releaseYearPosition = useStore($releaseYearPosition);
  const escapeKeyFunction = useStore($escapeKeyFunction);
  const animateFullscreenClose = useStore($animateFullscreenClose);
  const hideNpvLyricsWhenUnavailable = useStore($hideNpvLyricsWhenUnavailable);
  const disableNpvLyrics = useStore($disableNpvLyrics);
  const isGlobalNav = useStore($isGlobalNav);
  const hiddenSettingIds = useStore($hiddenSettingIds);
  if (sectionFilter !== "All" && sectionFilter !== SECTION_NAME) return null;

  const ids = ["interface-lock-media-box", "interface-disable-popup", "interface-view-controls", "interface-always-fullscreen", "interface-fullscreen-volume", "interface-release-year", "interface-animate-close", "interface-escape-key", "interface-disable-npv", "interface-hide-empty-npv"];
  const rows = [
    matches(query, "Lock Media Box Size in Compact Mode", "Prevent the media box from resizing when Forced Compact Mode is active."), matches(query, "Disable Popup Lyrics Window", "Show or hide the Popup Lyrics button in the playback bar."), matches(query, "Lyrics Controls Position", "Where the lyrics view controls (play, scroll, etc.) appear."), matches(query, "Always Show In Fullscreen", "Keep fullscreen time or controls visible."), matches(query, "Fullscreen Volume Slider", "Show a volume slider in fullscreen."), matches(query, "Release Year Position", "Show release year near track metadata."), matches(query, "Animate closing fullscreen", "Slide the lyrics page away when closing fullscreen."), matches(query, "Escape Key Function", "Choose how Escape behaves in lyrics fullscreen."), matches(query, "Disable NPV Lyrics", "Never show the lyrics card in the Now Playing sidebar."), matches(query, "Hide NPV Lyrics When No Lyrics Are Available", "Remove the lyrics card from the Now Playing sidebar while the current song has no lyrics, instead of showing a notice. It comes back on the next song that has them."),
  ].map((matched, index) => matched && (showHidden ? hiddenSettingIds.includes(ids[index]) : !allowHidingSettings || !hiddenSettingIds.includes(ids[index]) || Boolean(query.trim())));
  if (!rows.some(Boolean)) return null;
  const normalizedAlwaysShow = alwaysShowInFullscreen === "All" ? "Both" : alwaysShowInFullscreen;

  return <>
    <SectionTitle>Interface</SectionTitle>
    {rows[0] && <Row settingId="interface-lock-media-box" label="Lock Media Box Size in Compact Mode" description="Prevent the media box from resizing when Forced Compact Mode is active."><Toggle checked={lockedMediaBox} onChange={(v) => $lockedMediaBox.set(v)} /></Row>}
    {rows[1] && <Row settingId="interface-disable-popup" label="Disable Popup Lyrics Window" description="Show or hide the Popup Lyrics button in the playback bar."><Toggle checked={!popupLyricsAllowed} onChange={(v) => $popupLyricsAllowed.set(!v)} /></Row>}
    {rows[2] && <Row settingId="interface-view-controls" label="View Controls Position" description="Where the view controls (play, scroll, etc.) appear." disabled={!isGlobalNav} disabledReason="Only available in Spotify's new navigation layout"><Select value={viewControlsPosition} options={vcPositionOptions} onChange={(v) => $viewControlsPosition.set(v)} /></Row>}
    {rows[3] && <Row settingId="interface-always-fullscreen" label="Always Show In Fullscreen" description="Keep fullscreen time or controls visible."><Select value={normalizedAlwaysShow} options={fullscreenOptions} onChange={(v) => $alwaysShowInFullscreen.set(v)} /></Row>}
    {rows[4] && <Row settingId="interface-fullscreen-volume" label="Fullscreen Volume Slider" description="Show a volume slider in fullscreen and Cinema View."><Select value={showVolumeSliderFullscreen} options={volumeOptions} onChange={(v) => $showVolumeSliderFullscreen.set(v)} /></Row>}
    {rows[5] && <Row settingId="interface-release-year" label="Release Year Position" description="Show release year near track metadata."><Select value={releaseYearPosition} options={releaseYearOptions} onChange={(v) => $releaseYearPosition.set(v)} /></Row>}
    {rows[6] && <Row settingId="interface-animate-close" label="Animate closing fullscreen" description="Slide the lyrics page away when closing fullscreen."><Toggle checked={animateFullscreenClose} onChange={(v) => $animateFullscreenClose.set(v)} /></Row>}
    {rows[7] && <Row settingId="interface-escape-key" label="Escape Key Function" description="Choose how Escape behaves in lyrics fullscreen."><Select value={escapeKeyFunction} options={escapeOptions} onChange={(v) => $escapeKeyFunction.set(v)} /></Row>}
    {rows[8] && <Row settingId="interface-disable-npv" label="Disable NPV Lyrics" description="Never show the lyrics card in the Now Playing sidebar."><Toggle checked={disableNpvLyrics} onChange={(v) => $disableNpvLyrics.set(v)} /></Row>}
    {rows[9] && <Row settingId="interface-hide-empty-npv" label="Hide NPV Lyrics When No Lyrics Are Available" description="Remove the lyrics card when the current song has no lyrics." disabled={disableNpvLyrics} disabledReason="The NPV lyrics card is disabled"><Toggle checked={hideNpvLyricsWhenUnavailable} onChange={(v) => $hideNpvLyricsWhenUnavailable.set(v)} /></Row>}
  </>;
}
