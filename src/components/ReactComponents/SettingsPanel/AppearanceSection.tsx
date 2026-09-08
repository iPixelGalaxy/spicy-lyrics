import { useStore } from "@nanostores/react";
import React from "react";
import {
  $coverArtAnimation,
  $customFont,
  $customFontEnabled,
  $showNpvDynamicBg,
  $spaceGravityMode,
  $staticBackgroundBlur,
  $staticBackgroundMode,
} from "../../../utils/stores.ts";
import { matches, Row, SectionTitle, Select, Slider, Toggle } from "./components.tsx";

const SECTION_NAME = "Appearance";
const bgModeOptions = ["default", "legacy", "auto", "artistHeader", "coverArt", "color"];
const bgModeLabels = ["Default", "Legacy", "Auto", "Artist Header", "Cover Art", "Color"];

interface Props {
  query: string;
  sectionFilter: string;
}

export default function AppearanceSection({ query, sectionFilter }: Props) {
  const customFontEnabled = useStore($customFontEnabled);
  const customFont = useStore($customFont);
  const staticBackgroundMode = useStore($staticBackgroundMode);
  const staticBackgroundBlur = useStore($staticBackgroundBlur);
  const showNpvDynamicBg = useStore($showNpvDynamicBg);
  const coverArtAnimation = useStore($coverArtAnimation);
  const spaceGravityMode = useStore($spaceGravityMode);

  if (sectionFilter !== "All" && sectionFilter !== SECTION_NAME) return null;

  const r1 = matches(query, "Use Custom Font", "Use a custom font instead of the bundled Spicy Lyrics font.");
  const r2 = customFontEnabled && matches(query, "Font Name", "Font family name to use for lyrics.");
  const r3 = matches(query, "Background Type", "Choose the dynamic, legacy, static image, or color background.");
  const r4 = matches(query, "Display Dynamic Background in Now Playing View", "Show the animated background in the Now Playing panel.");
  const r5 = matches(query, "Cover Art Animation", "Animate cover art changes in the NowBar.");
  const blurApplies = ["auto", "artistHeader", "coverArt"].includes(staticBackgroundMode);
  const r6 = blurApplies && matches(query, "Background Blur", "Soften the static background image.");
  const r7 = matches(
    query,
    "Space Gravity Mode",
    "Let word-synced lyrics drift and tumble freely while their timing animations continue."
  );

  if (!r1 && !r2 && !r3 && !r4 && !r5 && !r6 && !r7) return null;

  return (
    <>
      <SectionTitle>Appearance</SectionTitle>

      {r1 && (
        <Row label="Use Custom Font" description="Use a custom font instead of the bundled Spicy Lyrics font.">
          <Toggle checked={customFontEnabled} onChange={(v) => $customFontEnabled.set(v)} />
        </Row>
      )}

      {r2 && (
        <Row label="Font Name" description="Enter the installed font family name to use for lyrics.">
          <input
            className="sl-sp-text-input"
            type="text"
            placeholder="Spotify Mix"
            value={customFont}
            onChange={(e) => $customFont.set(e.currentTarget.value)}
            spellCheck={false}
          />
        </Row>
      )}

      {r3 && (
        <Row label="Background Type" description="Choose the dynamic, legacy, static image, or color background.">
          <Select
            value={staticBackgroundMode === "off" ? "default" : staticBackgroundMode}
            options={bgModeOptions}
            labels={bgModeLabels}
            onChange={(v) => $staticBackgroundMode.set(v)}
          />
        </Row>
      )}

      {r6 && (
        <Row label="Background Blur" description="Soften the static background image." stacked>
          <Slider
            value={staticBackgroundBlur}
            min={0}
            max={67}
            step={1}
            defaultValue={0}
            unit="px"
            onChange={(v) => $staticBackgroundBlur.set(v)}
          />
        </Row>
      )}

      {r4 && (
        <Row
          label="Display Dynamic Background in Now Playing View"
          description="Show the animated background in the Now Playing panel."
        >
          <Toggle checked={showNpvDynamicBg} onChange={(v) => $showNpvDynamicBg.set(v)} />
        </Row>
      )}

      {r5 && (
        <Row label="Cover Art Animation" description="Animate cover art changes in the NowBar.">
          <Toggle checked={coverArtAnimation} onChange={(v) => $coverArtAnimation.set(v)} />
        </Row>
      )}

      {r7 && (
        <Row
          label="Space Gravity Mode"
          description="Let word-synced lyrics drift and tumble freely while their timing animations continue."
        >
          <Toggle checked={spaceGravityMode} onChange={(v) => $spaceGravityMode.set(v)} />
        </Row>
      )}

    </>
  );
}
