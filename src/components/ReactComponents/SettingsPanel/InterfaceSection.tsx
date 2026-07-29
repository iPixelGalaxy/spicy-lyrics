import { useStore } from "@nanostores/react";
import {
  $alwaysShowInFullscreen,
  $animateFullscreenClose,
  $displayLyricsHoverPill,
  $escapeKeyFunction,
  $externalCinemaLyricsAllowed,
  $hideNpvLyricsWhenUnavailable,
  $lockedMediaBox,
  $popupLyricsAllowed,
  $releaseYearPosition,
  $showVolumeSliderFullscreen,
  $timelineOutsideMediaContent,
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
  const externalCinemaLyricsAllowed = useStore($externalCinemaLyricsAllowed);
  const viewControlsPosition = useStore($viewControlsPosition);
  const alwaysShowInFullscreen = useStore($alwaysShowInFullscreen);
  const showVolumeSliderFullscreen = useStore($showVolumeSliderFullscreen);
  const releaseYearPosition = useStore($releaseYearPosition);
  const escapeKeyFunction = useStore($escapeKeyFunction);
  const displayLyricsHoverPill = useStore($displayLyricsHoverPill);
  const animateFullscreenClose = useStore($animateFullscreenClose);
  const timelineOutsideMediaContent = useStore($timelineOutsideMediaContent);
  const hideNpvLyricsWhenUnavailable = useStore($hideNpvLyricsWhenUnavailable);
  const isGlobalNav = useStore($isGlobalNav);

  if (sectionFilter !== "All" && sectionFilter !== SECTION_NAME) return null;

  const r2 = matches(query, "Lock Media Box Size in Compact Mode", "Prevent the media box from resizing when Forced Compact Mode is active.");
  const r3 = matches(query, "Disable Popup Lyrics Window", "Prevent lyrics from opening in a floating popup window.");
  const r3b = matches(query, "Disable Cinema Lyrics Window", "Prevent lyrics from opening in a separate cinema window.");
  const r4 = matches(query, "Lyrics Controls Position", "Where the lyrics view controls (play, scroll, etc.) appear.");
  const r5 = matches(query, "Timeline Outside Media Box", "Display the playback timeline outside the media box, in the NowBar header. Stays inside the media box in Compact Mode or PIP.");
  const r6 = matches(query, "Always Show In Fullscreen", "Keep fullscreen time or controls visible.");
  const r7 = matches(query, "Fullscreen Volume Slider", "Show a volume slider in fullscreen.");
  const r8 = matches(query, "Release Year Position", "Show release year near track metadata.");
  const r9 = matches(query, "Display pill on lyrics hover", "Show a pill background when hovering over lyrics.");
  const r10 = matches(query, "Animate closing fullscreen", "Slide the lyrics page away when closing fullscreen.");
  const r11 = matches(query, "Hide NPV Lyrics When No Lyrics Are Available", "Remove the lyrics card from the Now Playing sidebar while the current song has no lyrics, instead of showing a notice. It comes back on the next song that has them.");
  const r12 = matches(query, "Escape Key Function", "Choose how Escape behaves in lyrics fullscreen.");

  if (!r2 && !r3 && !r3b && !r4 && !r5 && !r6 && !r7 && !r8 && !r9 && !r10 && !r11 && !r12) return null;

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
        <Row
          label="Disable Popup Lyrics Window"
          description="Prevent lyrics from opening in a floating popup window."
          labelAccessory={
            <a
              className="sl-sp-help-link"
              href="https://github.com/iPixelGalaxy/spicy-lyrics/blob/dev/ENABLE_DEVTOOLS.md"
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              Help
            </a>
          }
        >
          <Toggle
            checked={!popupLyricsAllowed}
            onChange={(v) => $popupLyricsAllowed.set(!v)}
          />
        </Row>
      )}

      {r3b && (
        <Row label="Disable Cinema Lyrics Window" description="Prevent lyrics from opening in a separate cinema window.">
          <Toggle
            checked={!externalCinemaLyricsAllowed}
            onChange={(v) => $externalCinemaLyricsAllowed.set(!v)}
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

      {r5 && (
        <Row
          label="Timeline Outside Media Box"
          description="Display the playback timeline outside the media box, in the NowBar header. Stays inside the media box in Compact Mode or PIP."
        >
          <Toggle
            checked={timelineOutsideMediaContent}
            onChange={(v) => $timelineOutsideMediaContent.set(v)}
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

      {r11 && (
        <Row
          label="Hide NPV Lyrics When No Lyrics Are Available"
          description="Remove the lyrics card from the Now Playing sidebar while the current song has no lyrics, instead of showing a notice. It comes back on the next song that has them."
        >
          <Toggle
            checked={hideNpvLyricsWhenUnavailable}
            onChange={(v) => $hideNpvLyricsWhenUnavailable.set(v)}
          />
        </Row>
      )}
    </>
  );
}
