import { useStore } from "@nanostores/react";
import React, { useEffect, useMemo, useState } from "react";
import { $buildChannel } from "../../utils/stores.ts";

type ChannelHosts = [string, string] | [string, string, string];
type ChannelMap = Record<string, ChannelHosts>;

const LEGACY_PREFIX = "SpicyLyrics-";
const CUSTOM_CHANNELS_KEY = "customChannels";
const CHANNELS_CHANGED_EVENT = "spicy-lyrics:channels-changed";
const DEFAULT_API_HOST = "api.spicylyrics.org";
const DEFAULT_STORAGE_HOST = "public.storage.spicylyrics.org";

const BUILT_IN_CHANNELS: ChannelMap = {
  Stable: [DEFAULT_API_HOST, DEFAULT_STORAGE_HOST],
  Beta: [DEFAULT_API_HOST, DEFAULT_STORAGE_HOST],
};


function legacyGet(key: string): string | null {
  return Spicetify.LocalStorage.get(`${LEGACY_PREFIX}${key}`);
}

function legacySet(key: string, value: string): void {
  Spicetify.LocalStorage.set(`${LEGACY_PREFIX}${key}`, value);
}

function notify(message: string, isError = false): void {
  Spicetify.showNotification?.(message, isError);
}

function readCustomChannels(): ChannelMap {
  try {
    const raw = legacyGet(CUSTOM_CHANNELS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const clean: ChannelMap = {};
    for (const [name, hosts] of Object.entries(parsed)) {
      if (
        typeof name === "string" &&
        Array.isArray(hosts) &&
        (hosts.length === 2 || hosts.length === 3) &&
        hosts.every((host) => typeof host === "string")
      ) {
        clean[name] = hosts as ChannelHosts;
      }
    }
    return clean;
  } catch {
    return {};
  }
}

function saveCustomChannels(channels: ChannelMap): void {
  legacySet(CUSTOM_CHANNELS_KEY, JSON.stringify(channels));
  window.dispatchEvent(new Event(CHANNELS_CHANGED_EVENT));
}

function getInitialChannel(fallback: string): string {
  return legacyGet("buildChannel") ?? fallback;
}

function persistBuildChannel(channel: string): void {
  $buildChannel.set(channel);
  legacySet("buildChannel", channel);
  window.dispatchEvent(new Event(CHANNELS_CHANGED_EVENT));
}

function hostSummary(hosts: ChannelHosts): string {
  return `${hosts[0]} / ${hosts[1]}${hosts[2] ? ` · fixed: ${hosts[2]}` : ""}`;
}

function isBuiltInChannel(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILT_IN_CHANNELS, name);
}

/** Compact setting control shared by Advanced settings and the channel panel. */
export function BuildChannelSettingControl({ onManage }: { onManage: () => void }) {
  const buildChannel = useStore($buildChannel);
  const [channelMap, setChannelMap] = useState<ChannelMap>(() => ({
    ...BUILT_IN_CHANNELS,
    ...readCustomChannels(),
  }));
  useEffect(() => {
    const refresh = () => {
      setChannelMap({ ...BUILT_IN_CHANNELS, ...readCustomChannels() });
      $buildChannel.set(getInitialChannel("Stable"));
    };
    window.addEventListener(CHANNELS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(CHANNELS_CHANGED_EVENT, refresh);
  }, []);
  const selectedChannel = channelMap[buildChannel] ? buildChannel : "Stable";

  return (
    <div className="sl-sp-btn-group">
      <span className="sl-sp-select-wrap">
        <span className="sl-sp-select-sizer" aria-hidden="true">
          {Object.keys(channelMap).map((channelName) => <span key={channelName}>{channelName}</span>)}
        </span>
        <select
          className="sl-sp-select"
          aria-label="Build Channel"
          value={selectedChannel}
          onChange={(event) => {
            persistBuildChannel(event.currentTarget.value);
            window.location.reload();
          }}
        >
          {Object.keys(channelMap).map((channelName) => (
            <option key={channelName} value={channelName}>{channelName}</option>
          ))}
        </select>
      </span>
      <button className="sl-sp-btn" onClick={onManage} type="button">Manage</button>
    </div>
  );
}

export default function BuildChannelPanel() {
  const buildChannel = useStore($buildChannel);
  const [customChannels, setCustomChannels] = useState<ChannelMap>(() => readCustomChannels());
  const [selectedChannel, setSelectedChannel] = useState(() => getInitialChannel(buildChannel));
  const [managingChannels, setManagingChannels] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [apiHost, setApiHost] = useState("");
  const [storageHost, setStorageHost] = useState("");
  const [sameHost, setSameHost] = useState(false);
  const [fixedVersionEnabled, setFixedVersionEnabled] = useState(false);
  const [fixedVersion, setFixedVersion] = useState("");

  const channelMap = useMemo(
    () => ({
      ...BUILT_IN_CHANNELS,
      ...customChannels,
    }),
    [customChannels],
  );

  const selectedHosts = channelMap[selectedChannel];
  const branchNames = Object.keys(channelMap);
  const customNames = Object.keys(customChannels);

  const resetForm = () => {
    setName("");
    setApiHost("");
    setStorageHost("");
    setSameHost(false);
    setFixedVersionEnabled(false);
    setFixedVersion("");
  };

  const saveChannel = () => {
    const cleanName = name.trim();
    const cleanApiHost = apiHost.trim() || DEFAULT_API_HOST;
    const cleanStorageHost = (sameHost ? apiHost.trim() : storageHost.trim()) || DEFAULT_STORAGE_HOST;
    const cleanFixedVersion = fixedVersion.trim();

    if (!cleanName) {
      notify("Channel name is required", true);
      return;
    }
    if (isBuiltInChannel(cleanName)) {
      notify("Cannot override built-in channels", true);
      return;
    }
    if (fixedVersionEnabled && !cleanFixedVersion) {
      notify("Fixed version is required when enabled", true);
      return;
    }

    const nextChannels: ChannelMap = {
      ...customChannels,
      [cleanName]: fixedVersionEnabled
        ? [cleanApiHost, cleanStorageHost, cleanFixedVersion]
        : [cleanApiHost, cleanStorageHost],
    };

    saveCustomChannels(nextChannels);
    setCustomChannels(nextChannels);
    setSelectedChannel(cleanName);
    resetForm();
    setShowAddForm(false);
    notify(`Branch "${cleanName}" added`);
  };

  const removeChannel = (channelName: string) => {
    const nextChannels = { ...customChannels };
    delete nextChannels[channelName];
    saveCustomChannels(nextChannels);
    setCustomChannels(nextChannels);

    if (selectedChannel === channelName) {
      setSelectedChannel("Stable");
      persistBuildChannel("Stable");
    }

    notify(`Branch "${channelName}" removed`);
  };

  const moveChannel = (channelName: string, direction: -1 | 1) => {
    const index = customNames.indexOf(channelName);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= customNames.length) return;
    const reorderedNames = [...customNames];
    [reorderedNames[index], reorderedNames[nextIndex]] = [reorderedNames[nextIndex], reorderedNames[index]];
    const nextChannels = Object.fromEntries(
      reorderedNames.map((name) => [name, customChannels[name]]),
    ) as ChannelMap;
    saveCustomChannels(nextChannels);
    setCustomChannels(nextChannels);
  };

  const applyAndReload = () => {
    if (!channelMap[selectedChannel]) {
      notify("Selected build channel no longer exists", true);
      return;
    }
    persistBuildChannel(selectedChannel);
    window.location.reload();
  };

  return (
    <div className="sl-build-channel-panel">
      <div className="sl-build-channel-copy">
        <span className="sl-build-channel-title">Build Channel</span>
        <span className="sl-build-channel-description">
          Choose which release stream this install should follow.
        </span>
      </div>

      <div className="sl-build-channel-picker">
        <label>
          <span>Channel</span>
          <span className="sl-build-channel-channel-control">
            <button className="sl-build-channel-secondary" onClick={() => setManagingChannels((open) => !open)} type="button">
              Manage
            </button>
            <span className="sl-build-channel-select-wrap">
              <select
                className="sl-build-channel-select"
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.currentTarget.value)}
              >
                {Object.keys(channelMap).map((channelName) => (
                  <option key={channelName} value={channelName}>
                    {channelName}
                  </option>
                ))}
              </select>
            </span>
          </span>
        </label>
        {selectedHosts && (
          <span className="sl-build-channel-selected-hosts">{hostSummary(selectedHosts)}</span>
        )}
      </div>

      {managingChannels && (
        <div className="sl-build-channel-custom">
          <div className="sl-build-channel-custom-header">
            <span className="sl-build-channel-section-title">Branches</span>
          </div>

          {branchNames.length > 0 && (
            <div className="sl-build-channel-custom-list">
              {branchNames.map((channelName) => (
                <div className="sl-build-channel-custom-row" key={channelName}>
                  <span className="sl-build-channel-option-copy">
                    <span className="sl-build-channel-option-title">{channelName}</span>
                    <span className="sl-build-channel-option-description">{hostSummary(channelMap[channelName])}</span>
                  </span>
                  <span className="sl-build-channel-channel-control">
                    {customNames.length > 1 && customNames.includes(channelName) && (
                      <>
                        <button
                          aria-label={`Move ${channelName} up`}
                          className="sl-build-channel-secondary"
                          disabled={customNames.indexOf(channelName) === 0}
                          onClick={() => moveChannel(channelName, -1)}
                          title="Move up"
                          type="button"
                        >
                          ↑
                        </button>
                        <button
                          aria-label={`Move ${channelName} down`}
                          className="sl-build-channel-secondary"
                          disabled={customNames.indexOf(channelName) === customNames.length - 1}
                          onClick={() => moveChannel(channelName, 1)}
                          title="Move down"
                          type="button"
                        >
                          ↓
                        </button>
                      </>
                    )}
                    {channelName === buildChannel ? (
                      <button className="sl-build-channel-secondary" disabled type="button">
                        Selected
                      </button>
                    ) : (
                      <button
                        className="sl-build-channel-secondary"
                        onClick={() => {
                          persistBuildChannel(channelName);
                          window.location.reload();
                        }}
                        type="button"
                      >
                        Switch
                      </button>
                    )}
                    {!isBuiltInChannel(channelName) && channelName !== buildChannel && (
                      <button
                        className="sl-build-channel-danger"
                        onClick={() => removeChannel(channelName)}
                        type="button"
                      >
                        Remove
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {showAddForm && (
            <div className="sl-build-channel-form">
              <label>
                <span>Branch Name</span>
                <input value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder="e.g. iPixel Dev" />
              </label>
              <label>
                <span>API Host</span>
                <input value={apiHost} onChange={(e) => setApiHost(e.currentTarget.value)} placeholder={DEFAULT_API_HOST} />
              </label>
              <label className="sl-build-channel-inline">
                <input checked={sameHost} onChange={(e) => setSameHost(e.currentTarget.checked)} type="checkbox" />
                <span>Use same host for storage</span>
              </label>
              {!sameHost && (
                <label>
                  <span>Storage Host</span>
                  <input value={storageHost} onChange={(e) => setStorageHost(e.currentTarget.value)} placeholder={DEFAULT_STORAGE_HOST} />
                </label>
              )}
              <label className="sl-build-channel-inline">
                <input
                  checked={fixedVersionEnabled}
                  onChange={(e) => setFixedVersionEnabled(e.currentTarget.checked)}
                  type="checkbox"
                />
                <span>Use fixed version</span>
              </label>
              {fixedVersionEnabled && (
                <label>
                  <span>Fixed Version</span>
                  <input value={fixedVersion} onChange={(e) => setFixedVersion(e.currentTarget.value)} placeholder="100.10.x" />
                </label>
              )}
              <div className="sl-build-channel-actions">
                <button
                  className="sl-build-channel-secondary"
                  onClick={() => {
                    resetForm();
                    setShowAddForm(false);
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button className="sl-build-channel-primary" onClick={saveChannel} type="button">
                  Save Branch
                </button>
              </div>
            </div>
          )}

          {!showAddForm && (
            <button className="sl-build-channel-secondary" onClick={() => setShowAddForm(true)} type="button">
              Add Branch
            </button>
          )}
        </div>
      )}

      <div className="sl-build-channel-actions">
        <span className="sl-build-channel-current">
          Current: {buildChannel}
          {selectedHosts ? ` · ${hostSummary(selectedHosts)}` : ""}
        </span>
        <button className="sl-build-channel-primary" onClick={applyAndReload} type="button">
          Apply & Reload
        </button>
      </div>
    </div>
  );
}
