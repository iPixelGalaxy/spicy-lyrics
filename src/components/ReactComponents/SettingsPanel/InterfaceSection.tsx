import { useStore } from "@nanostores/react";
import {
  $alwaysShowInFullscreen,
  $animateFullscreenClose,
  $displayLyricsHoverPill,
  $escapeKeyFunction,
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

interface Props {
  query: string;
  sectionFilter: string;
}

export default function InterfaceSection({ query, sectionFilter }: Props) {
  const lockedMediaBox = useStore($lockedMediaBox);
  const popupLyricsAllowed = useStore($popupLyricsAllowed);
  const viewControlsPosition = useStore($viewControlsPosition);
  const alwaysShowInFullscreen = useStore($alwaysShowInFullscreen);
  const showVolumeSliderFullscreen = useStore($showVolumeSliderFullscreen);
  const releaseYearPosition = useStore($releaseYearPosition);
  const escapeKeyFunction = useStore($escapeKeyFunction);
  const displayLyricsHoverPill = useStore($displayLyricsHoverPill);
  const animateFullscreenClose = useStore($animateFullscreenClose);
  const isGlobalNav = useStore($isGlobalNav);

  if (sectionFilter !== "All" && sectionFilter !== SECTION_NAME) return null;

  const r2 = matches(query, "Lock Media Box Size in Compact Mode", "Prevent the media box from resizing when Forced Compact Mode is active.");
  const r3 = matches(query, "Disable Popup Lyrics Window", "Prevent lyrics from opening in a floating popup window.");
  const r4 = matches(query, "Lyrics Controls Position", "Where the lyrics view controls (play, scroll, etc.) appear.");
  const r6 = matches(query, "Always Show In Fullscreen", "Keep fullscreen time or controls visible.");
  const r7 = matches(query, "Fullscreen Volume Slider", "Show a volume slider in fullscreen.");
  const r8 = matches(query, "Release Year Position", "Show release year near track metadata.");
  const r9 = matches(query, "Display pill on lyrics hover", "Show a pill background when hovering over lyrics.");
  const r10 = matches(query, "Animate closing fullscreen", "Slide the lyrics page away when closing fullscreen.");
  const r12 = matches(query, "Escape Key Function", "Choose how Escape behaves in lyrics fullscreen.");

  if (!r2 && !r3 && !r4 && !r6 && !r7 && !r8 && !r9 && !r10 && !r12) return null;

  const normalizedAlwaysShowInFullscreen =
    alwaysShowInFullscreen === "All" ? "Both" : alwaysShowInFullscreen;

  return (
    <>
      <SectionTitle>Interface</SectionTitle>

      {r2 && (
        <Row
          label="Lock Media Box Size in Compact Mode"
          description="Prevent the media box from resizing when Forced Compact Mode is active."
        >
          <Toggle checked={lockedMediaBox} onChange={(v) => $lockedMediaBox.set(v)} />
        </Row>
      )}

      {r3 && (
        <Row label="Disable Popup Lyrics Window" description="Prevent lyrics from opening in a floating popup window.">
          <Toggle
            checked={!popupLyricsAllowed}
            onChange={(v) => $popupLyricsAllowed.set(!v)}
          />
        </Row>
      )}

      {r4 && (
        <Row
          label="View Controls Position"
          description="Where the view controls (play, scroll, etc.) appear."
          disabled={!isGlobalNav}
          disabledReason="Only available in Spotify's new navigation layout"
        >
          <Select
            value={viewControlsPosition}
            options={vcPositionOptions}
            onChange={(v) => $viewControlsPosition.set(v)}
          />
        </Row>
      )}

      {r6 && (
        <Row label="Always Show In Fullscreen" description="Keep fullscreen time or controls visible.">
          <Select value={normalizedAlwaysShowInFullscreen} options={fullscreenOptions} onChange={(v) => $alwaysShowInFullscreen.set(v)} />
        </Row>
      )}

      {r7 && (
        <Row label="Fullscreen Volume Slider" description="Show a volume slider in fullscreen.">
          <Select value={showVolumeSliderFullscreen} options={volumeOptions} onChange={(v) => $showVolumeSliderFullscreen.set(v)} />
        </Row>
      )}

      {r8 && (
        <Row label="Release Year Position" description="Show release year near track metadata.">
          <Select value={releaseYearPosition} options={releaseYearOptions} onChange={(v) => $releaseYearPosition.set(v)} />
        </Row>
      )}

      {r9 && (
        <Row label="Display pill on lyrics hover" description="Show a pill background when hovering over lyrics.">
          <Toggle checked={displayLyricsHoverPill} onChange={(v) => $displayLyricsHoverPill.set(v)} />
        </Row>
      )}

      {r10 && (
        <Row label="Animate closing fullscreen" description="Slide the lyrics page away when closing fullscreen.">
          <Toggle checked={animateFullscreenClose} onChange={(v) => $animateFullscreenClose.set(v)} />
        </Row>
      )}

      {r12 && (
        <Row label="Escape Key Function" description="Choose how Escape behaves in lyrics fullscreen.">
          <Select value={escapeKeyFunction} options={escapeOptions} onChange={(v) => $escapeKeyFunction.set(v)} />
        </Row>
      )}
    </>
  );
}
