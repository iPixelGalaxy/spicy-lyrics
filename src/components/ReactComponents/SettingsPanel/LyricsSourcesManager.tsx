import { useStore } from "@nanostores/react";
import React, { useState } from "react";
import { toast } from "sonner";
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
import { refreshMusixmatchToken } from "../../../utils/Lyrics/ExternalSources.ts";
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
  const [expandedOptions, setExpandedOptions] = useState<Set<LyricsSourceProviderId>>(new Set());

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

  const refreshToken = async () => {
    const token = await refreshMusixmatchToken(true);
    if (token) {
      toast.success("Musixmatch token refreshed.", { duration: 3000 });
      return;
    }
    toast.error("Failed to refresh Musixmatch token.", { duration: 4000 });
  };

  const optionCounts: Partial<Record<LyricsSourceProviderId, number>> = {
    musixmatch: 2,
    apple: 1,
  };

  const toggleOptions = (id: LyricsSourceProviderId) => {
    setExpandedOptions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="sl-sp-source-manager">
      <div className="sl-sp-source-list">
        {order.map((id, index) => {
          const definition = LYRICS_SOURCE_PROVIDER_DEFINITIONS[id];
          const enabled = !disabledIds.has(id);
          const optionCount = optionCounts[id] ?? 0;
          const optionsExpanded = expandedOptions.has(id);

          return (
            <React.Fragment key={id}>
              <div
                className={`sl-sp-source-stack${optionCount > 0 ? " sl-sp-source-stack--has-options" : ""}${
                  optionsExpanded ? " sl-sp-source-stack--open" : ""
                }`}
              >
                {optionCount > 1 && !optionsExpanded && (
                  <div className="sl-sp-source-stack-layer sl-sp-source-stack-layer--2" />
                )}
                {optionCount > 0 && !optionsExpanded && (
                  <div className="sl-sp-source-stack-layer sl-sp-source-stack-layer--1" />
                )}
                <div
                  className={`sl-sp-source-card${enabled ? "" : " sl-sp-source-card--disabled"}${
                    optionCount > 0 ? " sl-sp-source-card--has-options" : ""
                  }${optionsExpanded ? " sl-sp-source-card--options-open" : ""}`}
                  onClick={optionCount > 0 ? () => toggleOptions(id) : undefined}
                  role={optionCount > 0 ? "button" : undefined}
                  tabIndex={optionCount > 0 ? 0 : undefined}
                  aria-expanded={optionCount > 0 ? optionsExpanded : undefined}
                  onKeyDown={optionCount > 0
                    ? (e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      toggleOptions(id);
                    }
                    : undefined}
                >
                  <div className="sl-sp-source-rank">{index + 1}</div>
                  <div className="sl-sp-source-copy">
                    <span className="sl-sp-source-label">{definition.label}</span>
                    <span className="sl-sp-source-description">{definition.description}</span>
                  </div>
                  <div className="sl-sp-source-actions">
                    <div className="sl-sp-source-priority">
                      <button
                        className="sl-sp-icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSource(id, -1);
                        }}
                        disabled={index === 0}
                        aria-label={`Move ${definition.label} up`}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        className="sl-sp-icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSource(id, 1);
                        }}
                        disabled={index === order.length - 1}
                        aria-label={`Move ${definition.label} down`}
                        title="Move down"
                      >
                        ↓
                      </button>
                    </div>
                    <span onClick={(e) => e.stopPropagation()}>
                      <Toggle checked={enabled} onChange={(nextEnabled) => setSourceEnabled(id, nextEnabled)} />
                    </span>
                  </div>
                </div>
              </div>

              {id === "musixmatch" && optionsExpanded && (
                <div className="sl-sp-source-settings-group sl-sp-source-settings-group--inline sl-sp-source-settings-group--opening">
                  <div className="sl-sp-source-settings-inner">
                    <div className="sl-sp-source-token-row">
                      <div className="sl-sp-source-copy">
                        <span className="sl-sp-source-label">Musixmatch Token</span>
                        <span className="sl-sp-source-description">Optional user token. Leave empty to use automatic refresh.</span>
                      </div>
                      <div className="sl-sp-source-token-control">
                        <input
                          className="sl-sp-text-input sl-sp-source-token-input"
                          type="password"
                          value={musixmatchToken}
                          onChange={(e) => $musixmatchToken.set(e.currentTarget.value.trim())}
                          placeholder="Token"
                          spellCheck={false}
                        />
                        <button className="sl-sp-btn" onClick={() => void refreshToken()}>
                          Refresh
                        </button>
                      </div>
                    </div>

                    <div className="sl-sp-source-option-row">
                      <div className="sl-sp-source-copy">
                        <span className="sl-sp-source-label">Ignore Musixmatch Word Sync</span>
                        <span className="sl-sp-source-description">Prefer Musixmatch line timing over word timing.</span>
                      </div>
                      <Toggle checked={ignoreMusixmatchWordSync} onChange={(v) => $ignoreMusixmatchWordSync.set(v)} />
                    </div>
                  </div>
                </div>
              )}

              {id === "apple" && optionsExpanded && (
                <div className="sl-sp-source-settings-group sl-sp-source-settings-group--inline sl-sp-source-settings-group--opening">
                  <div className="sl-sp-source-settings-inner">
                    <div className="sl-sp-source-option-row">
                      <div className="sl-sp-source-copy">
                        <span className="sl-sp-source-label">Prioritize Apple Music Quality</span>
                        <span className="sl-sp-source-description">Use Apple Music when its timing quality is at least as good.</span>
                      </div>
                      <Toggle checked={prioritizeAppleMusicQuality} onChange={(v) => $prioritizeAppleMusicQuality.set(v)} />
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="sl-sp-source-footer">
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
    </div>
  );
}
