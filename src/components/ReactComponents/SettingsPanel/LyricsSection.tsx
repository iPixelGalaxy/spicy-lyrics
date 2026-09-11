import { useStore } from "@nanostores/react";
import React from "react";
import {
  $lineHoverBackground,
  $allowHidingSettings,
  $hiddenSettingIds,
  $minimalLyricsMode,
  $playbackOffset,
  $rightAlignLyrics,
  $showScrollToActiveButton,
} from "../../../utils/stores.ts";
import { matches, Row, SectionTitle, Slider, Toggle } from "./components.tsx";

const SECTION_NAME = "Lyrics Display";
const simpleLyricsOptions = ["Off", "calculate", "animate"];
const simpleLyricsLabels = ["Off", "Calculate", "Animate"];
const uniqueWordFilterOptions = ["Off", "Gibberish", "all lowercase", "ALL UPPERCASE"];
interface Props { query: string; sectionFilter: string; showHidden?: boolean; }

export default function LyricsSection({ query, sectionFilter, showHidden = false }: Props) {
  const minimalLyricsMode = useStore($minimalLyricsMode);
  const rightAlignLyrics = useStore($rightAlignLyrics);
  const showScrollToActiveButton = useStore($showScrollToActiveButton);
  const playbackOffset = useStore($playbackOffset);
  const lineHoverBackground = useStore($lineHoverBackground);
  const allowHidingSettings = useStore($allowHidingSettings);
  const hiddenSettingIds = useStore($hiddenSettingIds);
  if (sectionFilter !== "All" && sectionFilter !== SECTION_NAME) return null;

  const visible = (id: string) => showHidden ? hiddenSettingIds.includes(id) : !allowHidingSettings || !hiddenSettingIds.includes(id) || Boolean(query.trim());
  const r3 = visible("lyrics-minimal-mode") && matches(query, "Minimal Lyrics Mode", "Hides sung lyrics lines in Fullscreen and Cinema Mode");
  const r4 = visible("lyrics-right-align") && matches(query, "Right Align Lyrics", "Flip duet/opposite lyric alignment.");
  const r5 = visible("lyrics-scroll-active") && matches(query, "Show Scroll to Active Button", "Show an arrow button when the active lyric is outside the viewport.");
  const r8 = visible("lyrics-playback-offset") && matches(query, "Playback Offset", "Shift lyrics timing earlier or later, in milliseconds.");
  const r9 = visible("lyrics-line-hover") && matches(query, "Line Hover Background", "Shows a highlight box behind a lyrics line when you hover over it");
  if (!r3 && !r4 && !r5 && !r8 && !r9) return null;

  return <>
    <SectionTitle>Lyrics Display</SectionTitle>
    {r3 && <Row settingId="lyrics-minimal-mode" label="Minimal Lyrics Mode" description="Hides sung lyrics lines in Fullscreen and Cinema Mode"><Toggle checked={minimalLyricsMode} onChange={(v) => $minimalLyricsMode.set(v)} /></Row>}
    {r4 && <Row settingId="lyrics-right-align" label="Right Align Lyrics" description="Flip duet/opposite lyric alignment."><Toggle checked={rightAlignLyrics} onChange={(v) => $rightAlignLyrics.set(v)} /></Row>}
    {r5 && <Row settingId="lyrics-scroll-active" label="Show Scroll to Active Button" description="Show an arrow when the active lyric is outside the viewport."><Toggle checked={showScrollToActiveButton} onChange={(v) => $showScrollToActiveButton.set(v)} /></Row>}
    {r8 && <Row settingId="lyrics-playback-offset" label="Playback Offset" description="Shift lyrics timing earlier or later, in milliseconds." stacked><Slider value={playbackOffset} min={-5000} max={5000} step={10} defaultValue={0} unit="ms" onChange={(v) => $playbackOffset.set(v)} /></Row>}
    {r9 && <Row settingId="lyrics-line-hover" label="Line Hover Background" description="Shows a highlight box behind a lyrics line when you hover over it"><Toggle checked={lineHoverBackground} onChange={(v) => $lineHoverBackground.set(v)} /></Row>}
  </>;
}
