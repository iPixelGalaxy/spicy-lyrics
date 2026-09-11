import React from "react";
import { $lyricsCacheAction, $showLyricsCacheActionButton } from "../../../utils/stores.ts";
import { LYRICS_CACHE_ACTIONS, normalizeLyricsCacheAction, RunLyricsCacheAction } from "../../../utils/LyricsCacheTools.ts";
import { LYRICS_SOURCE_PROVIDER_DEFINITIONS } from "../../../utils/Lyrics/LyricsSourcePreferences.ts";
import { OpenTTMLDatabasePanelFromSettings } from "../../../utils/openLyricsDBPanel.tsx";
import { OpenLyricsSourcesManager } from "../../../utils/openLyricsSourcesManager.tsx";
import { matches, Row, SectionTitle, Select, Toggle } from "./components.tsx";
import { useStore } from "@nanostores/react";

const SECTION_NAME = "Sources";

export default function SourcesSection({ query, sectionFilter, showHidden = false }: { query: string; sectionFilter: string; showHidden?: boolean }) {
  const lyricsCacheAction = normalizeLyricsCacheAction(useStore($lyricsCacheAction));
  const showLyricsCacheActionButton = useStore($showLyricsCacheActionButton);
  if (sectionFilter !== "All" && sectionFilter !== SECTION_NAME) return null;
  const sources = matches(query, "Manage Sources", "Manage lyric source priority and availability.") || Object.values(LYRICS_SOURCE_PROVIDER_DEFINITIONS).some((source) => matches(query, source.label, source.description));
  const database = matches(query, "Browse TTML Database", "Open the local TTML database manager.");
  const cacheButton = matches(query, "Lyrics View Cache Button", "Show a selected cache action in the lyrics view controls.");
  const cacheActions = matches(query, "Cache Actions", "Clear all current-song caches, clear current in-memory lyrics, or clear stored lyrics cache.");
  if (!sources && !database && !cacheButton && !cacheActions) return null;
  return <>
    <SectionTitle>Sources</SectionTitle>
    {sources && <Row label="Manage Sources" description="Manage lyric source priority and availability."><button className="sl-sp-btn" onClick={OpenLyricsSourcesManager}>Manage</button></Row>}
    {database && <Row label="Browse TTML Database" description="Open the local TTML database manager."><button className="sl-sp-btn" onClick={OpenTTMLDatabasePanelFromSettings}>Browse</button></Row>}
    {cacheButton && <Row settingId="advanced-cache-button" label="Lyrics View Cache Button" description="Show selected cache action in the lyrics view controls."><div className="sl-sp-btn-group"><Select value={lyricsCacheAction} options={LYRICS_CACHE_ACTIONS.map((action) => action.value)} labels={LYRICS_CACHE_ACTIONS.map((action) => action.label)} onChange={(value) => $lyricsCacheAction.set(normalizeLyricsCacheAction(value))} /><Toggle checked={showLyricsCacheActionButton} onChange={(value) => $showLyricsCacheActionButton.set(value)} /></div></Row>}
    {cacheActions && <Row settingId="advanced-cache-actions" label="Cache Actions" description="Clear all current-song caches, clear current in-memory lyrics, or clear stored lyrics cache."><div className="sl-sp-btn-group"><button className="sl-sp-btn" onClick={() => void RunLyricsCacheAction("all-current", true)}>Clear All</button><button className="sl-sp-btn" onClick={() => void RunLyricsCacheAction("current-state", true)}>Clear Current Song</button><button className="sl-sp-btn" onClick={() => void RunLyricsCacheAction("stored-cache", true)}>Clear Cache</button></div></Row>}
  </>;
}
