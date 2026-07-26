import { useStore } from "@nanostores/react";
import React from "react";
import {
  $buildChannel,
  $developerMode,
  $lyricsCacheAction,
  $showLyricsCacheActionButton,
} from "../../../utils/stores.ts";
import {
  LYRICS_CACHE_ACTIONS,
  normalizeLyricsCacheAction,
  RunLyricsCacheAction,
} from "../../../utils/LyricsCacheTools.ts";
import { LYRICS_SOURCE_PROVIDER_DEFINITIONS } from "../../../utils/Lyrics/LyricsSourcePreferences.ts";
import { OpenTTMLDatabasePanelFromSettings } from "../../../utils/openLyricsDBPanel.tsx";
import { OpenBuildChannelPanel } from "../../../utils/openBuildChannelPanel.tsx";
import { OpenLyricsSourcesManager } from "../../../utils/openLyricsSourcesManager.tsx";
import { matches, Row, SectionTitle, Select, Toggle } from "./components.tsx";

const SECTION_NAME = "Advanced";

interface Props {
  query: string;
  sectionFilter: string;
}

export default function DeveloperSection({ query, sectionFilter }: Props) {
  const developerMode = useStore($developerMode);
  const showLyricsCacheActionButton = useStore($showLyricsCacheActionButton);
  const lyricsCacheAction = normalizeLyricsCacheAction(useStore($lyricsCacheAction));
  const buildChannel = useStore($buildChannel);
  const displayedBuildChannel =
    Spicetify.LocalStorage.get("SpicyLyrics-buildChannel") ?? buildChannel;

  if (sectionFilter !== "All" && sectionFilter !== SECTION_NAME) return null;

  const r1 =
    matches(query, "Cache Actions", "Clear all, current song, or stored lyrics cache.") ||
    matches(query, "Clear All", "Remove all cached lyrics data for the currently playing track.") ||
    matches(query, "Clear Current Song", "Remove the current song's lyrics from the in-memory state only.") ||
    matches(query, "Clear Cache", "Delete lyrics that have been cached for up to 3 days.");
  const r2 =
    matches(query, "Manage Sources", "Manage lyric source priority and availability.") ||
    Object.values(LYRICS_SOURCE_PROVIDER_DEFINITIONS).some((definition) =>
      matches(query, definition.label, definition.description)
    );
  const r3 = matches(query, "Browse TTML Database", "Open the local TTML database manager.");
  const r4 = matches(query, "Build Channel", "Select which update channel this fork should track.");
  const r5 = matches(query, "Developer Mode", "Enable extra logging and debug utilities.");
  const r6 = matches(
    query,
    "Lyrics View Cache Button",
    "Show a selected cache action in the lyrics view controls."
  );

  if (!r1 && !r2 && !r3 && !r4 && !r5 && !r6) return null;

  return (
    <>
      <SectionTitle>Advanced</SectionTitle>

      {r2 && (
        <Row label="Manage Sources" description="Manage lyric source priority and availability.">
          <button className="sl-sp-btn" onClick={OpenLyricsSourcesManager}>
            Manage
          </button>
        </Row>
      )}

      {r3 && (
        <Row label="Browse TTML Database" description="Open the local TTML database manager.">
          <button className="sl-sp-btn" onClick={OpenTTMLDatabasePanelFromSettings}>
            Browse
          </button>
        </Row>
      )}

      {r4 && (
        <Row label="Build Channel" description="Select which update channel this fork should track.">
          <button className="sl-sp-btn" onClick={OpenBuildChannelPanel}>
            {displayedBuildChannel}
          </button>
        </Row>
      )}

      {r5 && (
        <Row label="Developer Mode" description="Enable extra logging and debug utilities.">
          <Toggle checked={developerMode} onChange={(v) => $developerMode.set(v)} />
        </Row>
      )}

      {r6 && (
        <Row
          label="Lyrics View Cache Button"
          description="Show selected cache action in lyrics view controls."
        >
          <div className="sl-sp-btn-group">
            <Select
              value={lyricsCacheAction}
              options={LYRICS_CACHE_ACTIONS.map((action) => action.value)}
              labels={LYRICS_CACHE_ACTIONS.map((action) => action.label)}
              onChange={(value) =>
                $lyricsCacheAction.set(normalizeLyricsCacheAction(value))
              }
            />
            <Toggle
              checked={showLyricsCacheActionButton}
              onChange={(value) => $showLyricsCacheActionButton.set(value)}
            />
          </div>
        </Row>
      )}

      {r1 && (
        <Row
          label="Cache Actions"
          description="Clear all current-song caches, clear current in-memory lyrics, or clear stored lyrics cache."
        >
          <div className="sl-sp-btn-group">
            <button className="sl-sp-btn" onClick={() => void RunLyricsCacheAction("all-current", true)}>
              Clear All
            </button>
            <button className="sl-sp-btn" onClick={() => void RunLyricsCacheAction("current-state", true)}>
              Clear Current Song
            </button>
            <button className="sl-sp-btn" onClick={() => void RunLyricsCacheAction("stored-cache", true)}>
              Clear Cache
            </button>
          </div>
        </Row>
      )}
    </>
  );
}
