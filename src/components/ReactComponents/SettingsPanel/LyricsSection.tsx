import { useStore } from "@nanostores/react";
import React from "react";
import {
  $lineHoverBackground,
  $hiddenSettingIds,
  $memeFormat,
  $minimalLyricsMode,
  $playbackOffset,
  $rightAlignLyrics,
  $showScrollToActiveButton,
  $simpleLyricsMode,
  $simpleLyricsModeRenderingType,
  $spaceGravityMode,
} from "../../../utils/stores.ts";
import { matches, Row, Select, SectionTitle, Slider, Toggle } from "./components.tsx";

const SECTION_NAME = "Lyrics Display";
const simpleLyricsOptions = ["Off", "calculate", "animate"];
const simpleLyricsLabels = ["Off", "Calculate", "Animate"];
const uniqueWordFilterOptions = ["Off", "Gibberish", "all lowercase", "ALL UPPERCASE"];
interface Props { query: string; sectionFilter: string; }

export default function LyricsSection({ query, sectionFilter }: Props) {
  const simpleLyricsMode = useStore($simpleLyricsMode);
  const simpleLyricsModeRenderingType = useStore($simpleLyricsModeRenderingType);
  const minimalLyricsMode = useStore($minimalLyricsMode);
  const rightAlignLyrics = useStore($rightAlignLyrics);
  const showScrollToActiveButton = useStore($showScrollToActiveButton);
  const memeFormat = useStore($memeFormat);
  const playbackOffset = useStore($playbackOffset);
  const lineHoverBackground = useStore($lineHoverBackground);
  const spaceGravityMode = useStore($spaceGravityMode);
  const hiddenSettingIds = useStore($hiddenSettingIds);
  if (sectionFilter !== "All" && sectionFilter !== SECTION_NAME) return null;

  const visible = (id: string) => !hiddenSettingIds.includes(id);
  const r1 = visible("lyrics-simple-mode") && (matches(query, "Simple Lyrics Mode", "Off, Calculate, or Animate simple lyric transitions.") || matches(query, "Simple Mode: Text Animation Style", "How lyrics text transitions are rendered in Simple Lyrics Mode."));
  const r3 = visible("lyrics-minimal-mode") && matches(query, "Minimal Lyrics Mode", "Hides sung lyrics lines in Fullscreen and Cinema Mode");
  const r4 = visible("lyrics-right-align") && matches(query, "Right Align Lyrics", "Flip duet/opposite lyric alignment.");
  const r5 = visible("lyrics-scroll-active") && matches(query, "Show Scroll to Active Button", "Show an arrow button when the active lyric is outside the viewport.");
  const r6 = visible("lyrics-word-filters") && matches(query, "Unique Word Filters", "Transform every lyric word.");
  const r7 = visible("lyrics-space-gravity") && matches(
    query,
    "Space Gravity Mode",
    "Let word-synced lyrics drift and tumble freely while their timing animations continue."
  );
  const r8 = visible("lyrics-playback-offset") && matches(query, "Playback Offset", "Shift lyrics timing earlier or later, in milliseconds.");
  const r9 = visible("lyrics-line-hover") && matches(query, "Line Hover Background", "Shows a highlight box behind a lyrics line when you hover over it");
  if (!r1 && !r3 && !r4 && !r5 && !r6 && !r7 && !r8 && !r9) return null;
  const simpleLyricsValue = simpleLyricsMode ? simpleLyricsModeRenderingType : "Off";
  const setSimpleLyricsValue = (value: string) => {
    if (value === "Off") { $simpleLyricsMode.set(false); return; }
    $simpleLyricsModeRenderingType.set(value);
    $simpleLyricsMode.set(true);
  };

  return <>
    <SectionTitle>Lyrics Display</SectionTitle>
    {r7 && <Row settingId="lyrics-space-gravity" label="Space Gravity Mode" description="Let word-synced lyrics drift and tumble freely while their timing animations continue."><Toggle checked={spaceGravityMode} onChange={(v) => $spaceGravityMode.set(v)} /></Row>}
    {r6 && <Row settingId="lyrics-word-filters" label="Unique Word Filters" description="Transform every lyric word."><Select value={uniqueWordFilterOptions.includes(memeFormat) ? memeFormat : "Off"} options={uniqueWordFilterOptions} onChange={(v) => $memeFormat.set(v)} /></Row>}
    {r1 && <Row settingId="lyrics-simple-mode" label="Simple Lyrics Mode" description="Off disables Simple Lyrics Mode. Calculate and Animate choose how simple lyric transitions render."><Select value={simpleLyricsValue} options={simpleLyricsOptions} labels={simpleLyricsLabels} onChange={setSimpleLyricsValue} /></Row>}
    {r3 && <Row settingId="lyrics-minimal-mode" label="Minimal Lyrics Mode" description="Hides sung lyrics lines in Fullscreen and Cinema Mode"><Toggle checked={minimalLyricsMode} onChange={(v) => $minimalLyricsMode.set(v)} /></Row>}
    {r4 && <Row settingId="lyrics-right-align" label="Right Align Lyrics" description="Flip duet/opposite lyric alignment."><Toggle checked={rightAlignLyrics} onChange={(v) => $rightAlignLyrics.set(v)} /></Row>}
    {r5 && <Row settingId="lyrics-scroll-active" label="Show Scroll to Active Button" description="Show an arrow when the active lyric is outside the viewport."><Toggle checked={showScrollToActiveButton} onChange={(v) => $showScrollToActiveButton.set(v)} /></Row>}
    {r8 && <Row settingId="lyrics-playback-offset" label="Playback Offset" description="Shift lyrics timing earlier or later, in milliseconds." stacked><Slider value={playbackOffset} min={-5000} max={5000} step={10} defaultValue={0} unit="ms" onChange={(v) => $playbackOffset.set(v)} /></Row>}
    {r9 && <Row settingId="lyrics-line-hover" label="Line Hover Background" description="Shows a highlight box behind a lyrics line when you hover over it"><Toggle checked={lineHoverBackground} onChange={(v) => $lineHoverBackground.set(v)} /></Row>}
  </>;
}
