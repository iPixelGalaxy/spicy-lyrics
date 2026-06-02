import { useStore } from "@nanostores/react";
import React from "react";
import {
  DEFAULT_LYRICS_SOURCE_ORDER,
  LYRICS_SOURCE_PROVIDER_DEFINITIONS,
  normalizeDisabledLyricsSourceIds,
  normalizeLyricsSourceOrder,
  stringifyDisabledLyricsSourceIds,
  stringifyLyricsSourceOrder,
  type LyricsSourceProviderId,
} from "../../../utils/Lyrics/LyricsSourcePreferences.ts";
import {
  $disabledLyricsSources,
  $ignoreMusixmatchWordSync,
  $lyricsSourceOrder,
  $musixmatchToken,
  $prioritizeAppleMusicQuality,
} from "../../../utils/stores.ts";
import { Toggle } from "./components.tsx";

const DEFAULT_DISABLED_LYRICS_SOURCES: LyricsSourceProviderId[] = ["lrclib", "netease"];

export default function LyricsSourcesManager() {
  const storedOrder = useStore($lyricsSourceOrder);
  const storedDisabled = useStore($disabledLyricsSources);
  const ignoreMusixmatchWordSync = useStore($ignoreMusixmatchWordSync);
  const prioritizeAppleMusicQuality = useStore($prioritizeAppleMusicQuality);
  const musixmatchToken = useStore($musixmatchToken);
  const order = normalizeLyricsSourceOrder(storedOrder);
  const disabledIds = new Set(normalizeDisabledLyricsSourceIds(storedDisabled));

  const setOrder = (nextOrder: LyricsSourceProviderId[]) => {
    $lyricsSourceOrder.set(stringifyLyricsSourceOrder(nextOrder));
  };

  const setDisabled = (nextDisabled: Set<LyricsSourceProviderId>) => {
    $disabledLyricsSources.set(stringifyDisabledLyricsSourceIds([...nextDisabled]));
  };

  const moveSource = (id: LyricsSourceProviderId, direction: -1 | 1) => {
    const currentIndex = order.indexOf(id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= order.length) return;

    const nextOrder = [...order];
    [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
    setOrder(nextOrder);
  };

  const setSourceEnabled = (id: LyricsSourceProviderId, enabled: boolean) => {
    const nextDisabled = new Set(disabledIds);
    if (enabled) nextDisabled.delete(id);
    else nextDisabled.add(id);
    setDisabled(nextDisabled);
  };

  const resetSources = () => {
    $lyricsSourceOrder.set(stringifyLyricsSourceOrder(DEFAULT_LYRICS_SOURCE_ORDER));
    $disabledLyricsSources.set(stringifyDisabledLyricsSourceIds(DEFAULT_DISABLED_LYRICS_SOURCES));
  };

  return (
    <div className="sl-sp-source-manager">
      <div className="sl-sp-source-manager-toolbar">
        <div className="sl-sp-source-manager-copy">
          <span className="sl-sp-source-manager-title">Source Priority</span>
          <span className="sl-sp-source-manager-description">
            Higher sources are tried first. Disabled sources are skipped.
          </span>
        </div>
        <button className="sl-sp-btn" onClick={resetSources}>
          Reset
        </button>
      </div>

      <div className="sl-sp-source-list">
        <div className="sl-sp-source-option-row">
          <div className="sl-sp-source-copy">
            <span className="sl-sp-source-label">Ignore Musixmatch Word Sync</span>
            <span className="sl-sp-source-description">Prefer Musixmatch line timing over word timing.</span>
          </div>
          <Toggle checked={ignoreMusixmatchWordSync} onChange={(v) => $ignoreMusixmatchWordSync.set(v)} />
        </div>

        <div className="sl-sp-source-option-row">
          <div className="sl-sp-source-copy">
            <span className="sl-sp-source-label">Prioritize Apple Music Quality</span>
            <span className="sl-sp-source-description">Use Apple Music when its timing quality is at least as good.</span>
          </div>
          <Toggle checked={prioritizeAppleMusicQuality} onChange={(v) => $prioritizeAppleMusicQuality.set(v)} />
        </div>

        <div className="sl-sp-source-token-row">
          <div className="sl-sp-source-copy">
            <span className="sl-sp-source-label">Musixmatch Token</span>
            <span className="sl-sp-source-description">Optional user token. Leave empty to use automatic refresh.</span>
          </div>
          <input
            className="sl-sp-text-input sl-sp-source-token-input"
            type="password"
            value={musixmatchToken}
            onChange={(e) => $musixmatchToken.set(e.currentTarget.value.trim())}
            placeholder="Token"
            spellCheck={false}
          />
        </div>

        {order.map((id, index) => {
          const definition = LYRICS_SOURCE_PROVIDER_DEFINITIONS[id];
          const enabled = !disabledIds.has(id);

          return (
            <div key={id} className={`sl-sp-source-card${enabled ? "" : " sl-sp-source-card--disabled"}`}>
              <div className="sl-sp-source-rank">{index + 1}</div>
              <div className="sl-sp-source-copy">
                <span className="sl-sp-source-label">{definition.label}</span>
                <span className="sl-sp-source-description">{definition.description}</span>
              </div>
              <div className="sl-sp-source-actions">
                <div className="sl-sp-source-priority">
                  <button
                    className="sl-sp-icon-btn"
                    onClick={() => moveSource(id, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${definition.label} up`}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    className="sl-sp-icon-btn"
                    onClick={() => moveSource(id, 1)}
                    disabled={index === order.length - 1}
                    aria-label={`Move ${definition.label} down`}
                    title="Move down"
                  >
                    ↓
                  </button>
                </div>
                <Toggle checked={enabled} onChange={(nextEnabled) => setSourceEnabled(id, nextEnabled)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
