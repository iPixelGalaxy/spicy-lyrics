import { useStore } from "@nanostores/react";
import React from "react";
import {
  $coverArtAnimation,
  $customFont,
  $customFontEnabled,
  $showNpvDynamicBg,
  $staticBackgroundBlur,
  $staticBackgroundMode,
  $hiddenSettingIds,
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
  const hiddenSettingIds = useStore($hiddenSettingIds);

  if (sectionFilter !== "All" && sectionFilter !== SECTION_NAME) return null;

  const visible = (id: string) => !hiddenSettingIds.includes(id);
  const r1 = visible("appearance-custom-font") && matches(query, "Use Custom Font", "Use a custom font instead of the bundled Spicy Lyrics font.");
  const r2 = visible("appearance-font-name") && customFontEnabled && matches(query, "Font Name", "Font family name to use for lyrics.");
  const r3 = visible("appearance-background-type") && matches(query, "Background Type", "Choose the dynamic, legacy, static image, or color background.");
  const r4 = visible("appearance-npv-background") && matches(query, "Display Dynamic Background in Now Playing View", "Show the animated background in the Now Playing panel.");
  const r5 = visible("appearance-cover-art-animation") && matches(query, "Cover Art Animation", "Animate cover art changes in the NowBar.");
  const blurApplies = ["auto", "artistHeader", "coverArt"].includes(staticBackgroundMode);
  const r6 = visible("appearance-background-blur") && blurApplies && matches(query, "Background Blur", "Soften the static background image.");

  if (!r1 && !r2 && !r3 && !r4 && !r5 && !r6) return null;

  return (
    <>
      <SectionTitle>Appearance</SectionTitle>

      {r1 && (
        <Row settingId="appearance-custom-font" label="Use Custom Font" description="Use a custom font instead of the bundled Spicy Lyrics font.">
          <Toggle checked={customFontEnabled} onChange={(v) => $customFontEnabled.set(v)} />
        </Row>
      )}

      {r2 && (
        <Row settingId="appearance-font-name" label="Font Name" description="Enter the installed font family name to use for lyrics.">
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
        <Row settingId="appearance-background-type" label="Background Type" description="Choose the dynamic, legacy, static image, or color background.">
          <Select
            value={staticBackgroundMode === "off" ? "default" : staticBackgroundMode}
            options={bgModeOptions}
            labels={bgModeLabels}
            onChange={(v) => $staticBackgroundMode.set(v)}
          />
        </Row>
      )}

      {r6 && (
        <Row settingId="appearance-background-blur" label="Background Blur" description="Soften the static background image." stacked>
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
        <Row settingId="appearance-npv-background"
          label="Display Dynamic Background in Now Playing View"
          description="Show the animated background in the Now Playing panel."
        >
          <Toggle checked={showNpvDynamicBg} onChange={(v) => $showNpvDynamicBg.set(v)} />
        </Row>
      )}

      {r5 && (
        <Row settingId="appearance-cover-art-animation" label="Cover Art Animation" description="Animate cover art changes in the NowBar.">
          <Toggle checked={coverArtAnimation} onChange={(v) => $coverArtAnimation.set(v)} />
        </Row>
      )}

    </>
  );
}
