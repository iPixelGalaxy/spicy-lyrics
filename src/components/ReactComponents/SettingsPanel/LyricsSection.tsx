import { useStore } from "@nanostores/react";
import React from "react";
import {
  $lineHoverBackground,
  $allowHidingSettings,
  $hiddenSettingIds,
  $minimalLyricsMode,
  $playbackOffset,
  $seekFadeCompensation,
  $scrollLeadEnabled,
  $scrollLeadMs,
  $smoothScrolling,
  $rightAlignLyrics,
  $showScrollToActiveButton,
} from "../../../utils/stores.ts";
import { matches, Row, SectionTitle, Slider, Toggle } from "./components.tsx";
import { ExperimentSettings } from "./ExperimentsPanel.tsx";

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
  const seekFadeCompensation = useStore($seekFadeCompensation);
  const scrollLeadEnabled = useStore($scrollLeadEnabled);
  const scrollLeadMs = useStore($scrollLeadMs);
  const smoothScrolling = useStore($smoothScrolling);
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
  const r10 = visible("lyrics-wide-duet-padding") && matches(query, "Wide duet line padding", "Separate duet voices into wider columns. Disable for compact padding.");
  const seek = visible("lyrics-seek-compensation") && matches(query, "Seek Fade-in Compensation", "Click lyrics 300ms early to compensate for Spotify's fade-in.");
  const early = visible("lyrics-early-scroll") && matches(query, "Early Scroll", "Start scrolling before the next lyric becomes active.");
  const lead = visible("lyrics-early-scroll-time") && matches(query, "Early Scroll Time", "How early the next line is scrolled to, in milliseconds.");
  const smooth = visible("lyrics-smooth-scrolling") && matches(query, "Smooth Scrolling", "Use spring motion for scrolling and interlude transitions.");
  const skeleton = visible("lyrics-loading-skeleton") && matches(query, "Lyrics Loading Skeleton", "Show placeholder lines while lyrics load; disable to restore the spinner.");
  if (![r3, r4, r5, r8, r9, r10, seek, early, lead, smooth, skeleton].some(Boolean)) return null;

  return <>
    <SectionTitle>Lyrics Display</SectionTitle>
    {r3 && <Row settingId="lyrics-minimal-mode" label="Minimal Lyrics Mode" description="Hides sung lyrics lines in Fullscreen and Cinema Mode"><Toggle checked={minimalLyricsMode} onChange={(v) => $minimalLyricsMode.set(v)} /></Row>}
    {r4 && <Row settingId="lyrics-right-align" label="Right Align Lyrics" description="Flip duet/opposite lyric alignment."><Toggle checked={rightAlignLyrics} onChange={(v) => $rightAlignLyrics.set(v)} /></Row>}
    {r5 && <Row settingId="lyrics-scroll-active" label="Show Scroll to Active Button" description="Show an arrow when the active lyric is outside the viewport."><Toggle checked={showScrollToActiveButton} onChange={(v) => $showScrollToActiveButton.set(v)} /></Row>}
    {r8 && <Row settingId="lyrics-playback-offset" label="Playback Offset" description="Shift lyrics timing earlier or later, in milliseconds." stacked><Slider value={playbackOffset} min={-5000} max={5000} step={10} defaultValue={0} unit="ms" onChange={(v) => $playbackOffset.set(v)} /></Row>}
    {seek && <Row settingId="lyrics-seek-compensation" label="Seek Fade-in Compensation" description="Clicking a lyric seeks 300ms before it, so Spotify's fade-in does not cut off the start."><Toggle checked={seekFadeCompensation} onChange={(v) => $seekFadeCompensation.set(v)} /></Row>}
    {(early || lead || smooth) && <SectionTitle>Scrolling</SectionTitle>}
    {early && <Row settingId="lyrics-early-scroll" label="Early Scroll" description="Start scrolling to the next line before it becomes active."><Toggle checked={scrollLeadEnabled} onChange={(v) => $scrollLeadEnabled.set(v)} /></Row>}
    {lead && <Row settingId="lyrics-early-scroll-time" label="Early Scroll Time" description="How early to move to the next line." disabled={!scrollLeadEnabled} disabledReason="Enable Early Scroll to modify this setting" stacked><Slider value={scrollLeadMs} min={0} max={800} step={10} defaultValue={250} unit="ms" onChange={(v) => $scrollLeadMs.set(Math.max(0, Math.min(800, Math.round(v / 10) * 10)))} disabled={!scrollLeadEnabled} /></Row>}
    {smooth && <Row settingId="lyrics-smooth-scrolling" label="Smooth Scrolling" description="Use spring motion for scrolling and interlude transitions."><Toggle checked={smoothScrolling} onChange={(v) => $smoothScrolling.set(v)} /></Row>}
    {skeleton && <ExperimentSettings experimentIds={["lyricsSkeleton"]} showBuiltIn={false} />}
    {r9 && <Row settingId="lyrics-line-hover" label="Line Hover Background" description="Shows a highlight box behind a lyrics line when you hover over it"><Toggle checked={lineHoverBackground} onChange={(v) => $lineHoverBackground.set(v)} /></Row>}
    {r10 && <ExperimentSettings experimentIds={["duetLinePadding"]} showBuiltIn={false} />}
  </>;
}
