const CHANNEL_PREFIX = "SpicyLyrics-";
const DEFAULT_API_HOST = "api.spicylyrics.org";
const VERSION_TIMEOUT_MS = 5000;

type ChannelHosts = [string, string] | [string, string, string];

function selectedChannel(): { apiHost: string; fixedVersion: string | null } {
  const name = Spicetify.LocalStorage.get(`${CHANNEL_PREFIX}buildChannel`) ?? "Stable";
  if (name === "Stable" || name === "Beta") return { apiHost: DEFAULT_API_HOST, fixedVersion: null };

  try {
    const custom = JSON.parse(Spicetify.LocalStorage.get(`${CHANNEL_PREFIX}customChannels`) ?? "{}");
    const hosts = custom?.[name] as ChannelHosts | undefined;
    if (Array.isArray(hosts) && typeof hosts[0] === "string") {
      return {
        apiHost: hosts[0],
        fixedVersion: typeof hosts[2] === "string" && hosts[2].trim() ? hosts[2].trim() : null,
      };
    }
  } catch {
    // Match the entrypoint's Stable fallback when stored channels are invalid.
  }
  return { apiHost: DEFAULT_API_HOST, fixedVersion: null };
}

export async function fetchSelectedChannelVersion(): Promise<string | undefined> {
  const channel = selectedChannel();
  if (channel.fixedVersion) return undefined;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), VERSION_TIMEOUT_MS);
  try {
    const response = await fetch(`https://${channel.apiHost}/version`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Version request failed with HTTP ${response.status}`);
    const version = (await response.text()).trim();
    if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
      throw new Error(`Unexpected version response: ${JSON.stringify(version.slice(0, 40))}`);
    }
    return version;
  } finally {
    window.clearTimeout(timeout);
  }
}
