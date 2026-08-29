import { useStore } from "@nanostores/react";
import React from "react";
import {
  $lineHoverBackground,
  $memeFormat,
  $minimalLyricsMode,
  $playbackOffset,
  $rightAlignLyrics,
  $showScrollToActiveButton,
  $simpleLyricsMode,
  $simpleLyricsModeRenderingType,
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
  if (sectionFilter !== "All" && sectionFilter !== SECTION_NAME) return null;

  const r1 = matches(query, "Simple Lyrics Mode", "Off, Calculate, or Animate simple lyric transitions.") || matches(query, "Simple Mode: Text Animation Style", "How lyrics text transitions are rendered in Simple Lyrics Mode.");
  const r3 = matches(query, "Minimal Lyrics Mode", "Hides sung lyrics lines in Fullscreen and Cinema Mode");
  const r4 = matches(query, "Right Align Lyrics", "Flip duet/opposite lyric alignment.");
  const r5 = matches(query, "Show Scroll to Active Button", "Show an arrow button when the active lyric is outside the viewport.");
  const r6 = matches(query, "Unique Word Filters", "Transform every lyric word.");
  const r8 = matches(query, "Playback Offset", "Shift lyrics timing earlier or later, in milliseconds.");
  const r9 = matches(query, "Line Hover Background", "Shows a highlight box behind a lyrics line when you hover over it");
  if (!r1 && !r3 && !r4 && !r5 && !r6 && !r8 && !r9) return null;
  const simpleLyricsValue = simpleLyricsMode ? simpleLyricsModeRenderingType : "Off";
  const setSimpleLyricsValue = (value: string) => {
    if (value === "Off") { $simpleLyricsMode.set(false); return; }
    $simpleLyricsModeRenderingType.set(value);
    $simpleLyricsMode.set(true);
  };

  return <>
    <SectionTitle>Lyrics Display</SectionTitle>
    {r1 && <Row label="Simple Lyrics Mode" description="Off disables Simple Lyrics Mode. Calculate and Animate choose how simple lyric transitions render."><Select value={simpleLyricsValue} options={simpleLyricsOptions} labels={simpleLyricsLabels} onChange={setSimpleLyricsValue} /></Row>}
    {r3 && <Row label="Minimal Lyrics Mode" description="Hides sung lyrics lines in Fullscreen and Cinema Mode"><Toggle checked={minimalLyricsMode} onChange={(v) => $minimalLyricsMode.set(v)} /></Row>}
    {r4 && <Row label="Right Align Lyrics" description="Flip duet/opposite lyric alignment."><Toggle checked={rightAlignLyrics} onChange={(v) => $rightAlignLyrics.set(v)} /></Row>}
    {r5 && <Row label="Show Scroll to Active Button" description="Show an arrow when the active lyric is outside the viewport."><Toggle checked={showScrollToActiveButton} onChange={(v) => $showScrollToActiveButton.set(v)} /></Row>}
    {r6 && <Row label="Unique Word Filters" description="Transform every lyric word."><Select value={uniqueWordFilterOptions.includes(memeFormat) ? memeFormat : "Off"} options={uniqueWordFilterOptions} onChange={(v) => $memeFormat.set(v)} /></Row>}
    {r8 && <Row label="Playback Offset" description="Shift lyrics timing earlier or later, in milliseconds." stacked><Slider value={playbackOffset} min={-5000} max={5000} step={10} defaultValue={0} unit="ms" onChange={(v) => $playbackOffset.set(v)} /></Row>}
    {r9 && <Row label="Line Hover Background" description="Shows a highlight box behind a lyrics line when you hover over it"><Toggle checked={lineHoverBackground} onChange={(v) => $lineHoverBackground.set(v)} /></Row>}
  </>;
}
