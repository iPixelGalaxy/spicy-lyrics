import { useStore } from "@nanostores/react";
import React from "react";
import {
  $allowHidingSettings,
  $animationFpsCap,
  $animationFpsCapEnabled,
  $customFont,
  $customFontEnabled,
  $showNpvDynamicBg,
  $staticBackgroundBlur,
  $staticBackgroundMode,
  $hiddenSettingIds,
  $pinnedFooterMode,
} from "../../../utils/stores.ts";
import { matches, Row, SectionTitle, Select, Slider, Toggle } from "./components.tsx";
import { ExperimentSettings } from "./ExperimentsPanel.tsx";

const SECTION_NAME = "Appearance";
const FPS_CAP_DESCRIPTION = "Limit how often lyrics, animated backgrounds, and smooth scrolling redraw. Turn off to redraw on every display refresh.";
const FPS_SLIDER_DESCRIPTION = "Frames per second while the cap is on.";
const bgModeOptions = ["default", "legacy", "auto", "artistHeader", "coverArt", "color"];
const bgModeLabels = ["Default", "Legacy", "Auto", "Artist Header", "Cover Art", "Color"];

interface Props {
  query: string;
  sectionFilter: string;
  showHidden?: boolean;
}

export default function AppearanceSection({ query, sectionFilter, showHidden = false }: Props) {
  const customFontEnabled = useStore($customFontEnabled);
  const customFont = useStore($customFont);
  const staticBackgroundMode = useStore($staticBackgroundMode);
  const staticBackgroundBlur = useStore($staticBackgroundBlur);
  const showNpvDynamicBg = useStore($showNpvDynamicBg);
  const pinnedFooterMode = useStore($pinnedFooterMode);
  const allowHidingSettings = useStore($allowHidingSettings);
  const hiddenSettingIds = useStore($hiddenSettingIds);
  const fpsCapEnabled = useStore($animationFpsCapEnabled);
  const fpsCap = useStore($animationFpsCap);

  if (sectionFilter !== "All" && sectionFilter !== SECTION_NAME) return null;

  const visible = (id: string) => showHidden ? hiddenSettingIds.includes(id) : !allowHidingSettings || !hiddenSettingIds.includes(id) || Boolean(query.trim());
  const r1 = visible("appearance-custom-font") && matches(query, "Use Custom Font", "Use a custom font instead of the bundled Spicy Lyrics font.");
  const r2 = visible("appearance-custom-font") && customFontEnabled && matches(query, "Font Name", "Font family name to use for lyrics.");
  const r3 = visible("appearance-background-type") && matches(query, "Background Type", "Choose the dynamic, legacy, static image, or color background.");
  const r4 = visible("appearance-npv-background") && matches(query, "Display Dynamic Background in Now Playing View", "Show the animated background in the Now Playing panel.");
  const blurApplies = ["auto", "artistHeader", "coverArt"].includes(staticBackgroundMode);
  const r6 = visible("appearance-background-blur") && blurApplies && matches(query, "Background Blur", "Soften the static background image.");
  const r7 = visible("appearance-pinned-footer") && matches(query, "Pinned Lyrics Footer", "Keep source and community credits visible. Full also pins writers.");
  const r8 = visible("appearance-sliderbar-styling") && matches(query, "New SliderBar Styling", "New glass-like style for the SliderBar. Disable to revert back to the original one.");
  const r9 = visible("appearance-fps-limit") && matches(query, "Limit Animation Frame Rate", FPS_CAP_DESCRIPTION);
  const r10 = visible("appearance-fps-cap") && fpsCapEnabled && matches(query, "Animation Frame Rate", FPS_SLIDER_DESCRIPTION);

  if (!r1 && !r2 && !r3 && !r4 && !r6 && !r7 && !r8 && !r9 && !r10) return null;

  return (
    <>
      <SectionTitle>Appearance</SectionTitle>

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

      {r7 && (
        <Row settingId="appearance-pinned-footer" label="Pinned Lyrics Footer" description="Keep source and community credits visible. Full also pins writers.">
          <Select value={pinnedFooterMode} options={["Off", "No Writers", "Full"]} onChange={(value) => $pinnedFooterMode.set(value as typeof pinnedFooterMode)} />
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
      {r8 && <ExperimentSettings experimentIds={["newProgressBarStyling"]} showBuiltIn={false} />}

      {r9 && (
        <Row settingId="appearance-fps-limit" label="Limit Animation Frame Rate" description={FPS_CAP_DESCRIPTION}>
          <Toggle checked={fpsCapEnabled} onChange={(value) => $animationFpsCapEnabled.set(value)} />
        </Row>
      )}

      {r10 && (
        <Row settingId="appearance-fps-cap" label="Animation Frame Rate" description={FPS_SLIDER_DESCRIPTION} stacked>
          <Slider value={fpsCap} min={15} max={240} step={5} defaultValue={60} unit="FPS"
            onChange={(value) => $animationFpsCap.set(value)} />
        </Row>
      )}

      {r1 && (
        <Row settingId="appearance-custom-font" label="Use Custom Font" description="Use a custom font instead of the bundled Spicy Lyrics font.">
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

    </>
  );
}
