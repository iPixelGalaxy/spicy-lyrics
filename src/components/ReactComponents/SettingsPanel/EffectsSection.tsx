import { useStore } from "@nanostores/react";
import React from "react";
import { $allowHidingSettings, $coverArtAnimation, $hiddenSettingIds, $memeFormat, $simpleLyricsMode, $simpleLyricsModeRenderingType, $spaceGravityMode } from "../../../utils/stores.ts";
import { matches, Row, SectionTitle, Select, Toggle } from "./components.tsx";

const SECTION_NAME = "Effects";
const simpleOptions = ["Off", "calculate", "animate"];
const simpleLabels = ["Off", "Calculate", "Animate"];
const wordOptions = ["Off", "Gibberish", "all lowercase", "ALL UPPERCASE"];

export default function EffectsSection({ query, sectionFilter, showHidden = false }: { query: string; sectionFilter: string; showHidden?: boolean }) {
  const allowHidingSettings = useStore($allowHidingSettings);
  const hiddenIds = useStore($hiddenSettingIds);
  const coverArtAnimation = useStore($coverArtAnimation);
  const memeFormat = useStore($memeFormat);
  const simpleLyricsMode = useStore($simpleLyricsMode);
  const simpleLyricsModeRenderingType = useStore($simpleLyricsModeRenderingType);
  const spaceGravityMode = useStore($spaceGravityMode);
  if (sectionFilter !== "All" && sectionFilter !== SECTION_NAME) return null;
  const visible = (id: string) => showHidden ? hiddenIds.includes(id) : !allowHidingSettings || !hiddenIds.includes(id) || Boolean(query.trim());
  const cover = visible("appearance-cover-art-animation") && matches(query, "Cover Art Animation", "Animate cover art changes in the NowBar.");
  const gravity = visible("lyrics-space-gravity") && matches(query, "Space Gravity Mode", "Let word-synced lyrics drift and tumble freely while their timing animations continue.");
  const words = visible("lyrics-word-filters") && matches(query, "Unique Word Filters", "Transform every lyric word.");
  const simple = visible("lyrics-simple-mode") && matches(query, "Simple Lyrics Mode", "Off, Calculate, or Animate simple lyric transitions.");
  if (!cover && !gravity && !words && !simple) return null;
  const simpleValue = simpleLyricsMode ? simpleLyricsModeRenderingType : "Off";
  const setSimple = (value: string) => { if (value === "Off") $simpleLyricsMode.set(false); else { $simpleLyricsModeRenderingType.set(value); $simpleLyricsMode.set(true); } };
  return <><SectionTitle>Effects</SectionTitle>
    {cover && <Row settingId="appearance-cover-art-animation" label="Cover Art Animation" description="Animate cover art changes in the NowBar."><Toggle checked={coverArtAnimation} onChange={(value) => $coverArtAnimation.set(value)} /></Row>}
    {gravity && <Row settingId="lyrics-space-gravity" label="Space Gravity Mode" description="Let word-synced lyrics drift and tumble freely while their timing animations continue."><Toggle checked={spaceGravityMode} onChange={(value) => $spaceGravityMode.set(value)} /></Row>}
    {words && <Row settingId="lyrics-word-filters" label="Unique Word Filters" description="Transform every lyric word."><Select value={wordOptions.includes(memeFormat) ? memeFormat : "Off"} options={wordOptions} onChange={(value) => $memeFormat.set(value)} /></Row>}
    {simple && <Row settingId="lyrics-simple-mode" label="Simple Lyrics Mode" description="Off disables Simple Lyrics Mode. Calculate and Animate choose how simple lyric transitions render."><Select value={simpleValue} options={simpleOptions} labels={simpleLabels} onChange={setSimple} /></Row>}
  </>;
}
