// Built-in channel → [apiHost, storageHost, fixedVersion?] map
const CHANNEL_MAP = {
  Stable: ["api.spicylyrics.org", "public.storage.spicylyrics.org"],
  Beta:   ["api.spicylyrics.org", "public.storage.spicylyrics.org"],
};

const BUILT_IN_CHANNELS = Object.keys(CHANNEL_MAP);
const DEFAULT_API_HOST = CHANNEL_MAP.Stable[0];
const DEFAULT_STORAGE_HOST = CHANNEL_MAP.Stable[1];
const CUSTOM_CHANNELS_ENABLED_KEY = "customChannelsEnabled";
const SECRET_ENABLE_RIGHT_CLICKS = 7;
const SECRET_DISABLE_LEFT_CLICKS = 6;

const LS_PREFIX = "SpicyLyrics-";
const lsGet = (key) => Spicetify.LocalStorage.get(`${LS_PREFIX}${key}`);
const lsSet = (key, value) => Spicetify.LocalStorage.set(`${LS_PREFIX}${key}`, value);

// ─── Channel Storage Helpers ───

const getCustomChannels = () => {
  try {
    const raw = lsGet("customChannels");
    if (raw) {
      const parsed = JSON.parse(raw);
      const clean = {};
      for (const [name, hosts] of Object.entries(parsed)) {
        if (Array.isArray(hosts) && (hosts.length === 2 || hosts.length === 3)) {
          clean[name] = hosts;
        }
      }
      return clean;
    }
  } catch (e) {
    console.warn("[Spicy Lyrics] [Entry] Failed to parse custom channels:", e);
  }
  return {};
};

const saveCustomChannels = (channels) => lsSet("customChannels", JSON.stringify(channels));

const getFullChannelMap = () => ({ ...CHANNEL_MAP, ...getCustomChannels() });

const getCurrentChannel = () => lsGet("buildChannel") ?? "Stable";

const setCurrentChannel = (name) => lsSet("buildChannel", name);

const getCustomChannelAccessEnabled = () => {
  const saved = lsGet(CUSTOM_CHANNELS_ENABLED_KEY);
  if (saved != null) return saved === "true";

  const enabled = Object.keys(getCustomChannels()).length > 0;
  lsSet(CUSTOM_CHANNELS_ENABLED_KEY, enabled ? "true" : "false");
  return enabled;
};

const setCustomChannelAccessEnabled = (enabled) => {
  lsSet(CUSTOM_CHANNELS_ENABLED_KEY, enabled ? "true" : "false");

  if (!enabled && !BUILT_IN_CHANNELS.includes(getCurrentChannel())) {
    setCurrentChannel("Stable");
    return { switchedToStable: true };
  }

  return { switchedToStable: false };
};

const showCustomChannelAccessNotification = (enabled, switchedToStable = false) => {
  const suffix = !enabled && switchedToStable ? " Switched back to Stable." : "";
  Spicetify.showNotification(`Custom build channels ${enabled ? "enabled" : "disabled"}.${suffix}`);
};

const attachSecretToggleGesture = (element, onStateChange) => {
  if (!element || element.__spicy_custom_channel_gesture) return;
  element.__spicy_custom_channel_gesture = true;

  let rightClickCount = 0;
  let leftClickCount = 0;
  let clickTimeout = null;

  const resetCounts = () => {
    rightClickCount = 0;
    leftClickCount = 0;
  };

  const queueReset = () => {
    if (clickTimeout) clearTimeout(clickTimeout);
    clickTimeout = setTimeout(resetCounts, 3000);
  };

  element.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    rightClickCount++;
    leftClickCount = 0;
    queueReset();

    if (rightClickCount < SECRET_ENABLE_RIGHT_CLICKS) return;

    resetCounts();
    const result = setCustomChannelAccessEnabled(true);
    showCustomChannelAccessNotification(true, result.switchedToStable);
    onStateChange?.(true, result);
  });

  element.addEventListener("click", (e) => {
    if (e.button !== 0) return;

    leftClickCount++;
    rightClickCount = 0;
    queueReset();

    if (leftClickCount < SECRET_DISABLE_LEFT_CLICKS) return;

    resetCounts();
    const result = setCustomChannelAccessEnabled(false);
    showCustomChannelAccessNotification(false, result.switchedToStable);
    onStateChange?.(false, result);
  });
};

const registerSettingsPageUnlockGesture = () => {
  const selectors = [
    'label[for="spicy-lyrics-settings.build-channel"]',
    "#sl-entry-channel-label",
  ];

  const waitAndAttach = () => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;

      let attachedCount = 0;
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (!element) continue;
        attachedCount++;
        attachSecretToggleGesture(element);
      }

      if (attachedCount === selectors.length || attempts > 100) {
        clearInterval(interval);
      }
    }, 50);
  };

  Spicetify.Platform.History.listen((e) => {
    if (e.pathname === "/preferences") {
      waitAndAttach();
    }
  });

  if (Spicetify.Platform.History.location.pathname === "/preferences") {
    waitAndAttach();
  }
};

// ─── Style injection ───
// The entrypoint runs independently of the plugin bundle, so it injects its
// own stylesheet to ensure the panel and sl-* components are always styled.

const injectStyles = () => {
  if (document.getElementById("spicy-lyrics-entry-styles")) return;
  const style = document.createElement("style");
  style.id = "spicy-lyrics-entry-styles";
  style.textContent = `
    .SpicyLyricsSettingsOverlay{position:fixed;inset:0;z-index:9998;background:transparent;}
    .SpicyLyricsSettingsContainer{position:fixed;z-index:9999;background:rgba(46,46,46,.72);border:1px solid var(--hairline,rgba(255,255,255,.16));border-radius:var(--radius-md,12px);display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--liquid-cast-soft,0 18px 52px rgba(0,0,0,.42)),inset 0 1px 0 rgba(255,255,255,.08);-webkit-backdrop-filter:var(--material-regular-blur,blur(24px));backdrop-filter:var(--material-regular-blur,blur(24px));}
    .SpicyLyricsSettingsHeader{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--hairline,rgba(255,255,255,.1));flex-shrink:0;}
    .SpicyLyricsSettingsHeader span{font-size:var(--text-headline-size,.95rem)!important;font-weight:var(--w-semibold,600);color:var(--color-text-primary,#fff);letter-spacing:0;}
    .SpicyLyricsSettingsHeaderClose{background:transparent;border:none;color:var(--color-text-secondary,rgba(255,255,255,.58));cursor:pointer;padding:6px;display:flex;align-items:center;justify-content:center;border-radius:var(--radius-sm,8px);transition:color .15s,background .15s,transform .12s;}
    .SpicyLyricsSettingsHeaderClose:hover{color:var(--color-text-primary,#fff);background:var(--accent-tint-bg,rgba(255,255,255,.1));}
    .SpicyLyricsSettingsHeaderClose:active{transform:scale(.96);}
    .SpicyLyricsSettingsScroll{flex:1;overflow-y:auto;padding:10px 16px 16px;}
    .SpicyLyricsSettingsScroll::-webkit-scrollbar{width:4px;}
    .SpicyLyricsSettingsScroll::-webkit-scrollbar-track{background:transparent;}
    .SpicyLyricsSettingsScroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:4px;}
    .sl-settings-group{font-size:var(--text-caption-size,.78rem)!important;font-weight:var(--w-semibold,600);color:var(--color-text-primary,#fff);letter-spacing:0;margin-top:18px;margin-bottom:4px;padding:12px 2px 8px;border-top:1px solid var(--hairline,rgba(255,255,255,.1));}
    .sl-settings-group:first-child{margin-top:8px;}
    .sl-settings-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 8px;border-radius:var(--radius-md,10px);transition:background .15s;}
    .sl-settings-row:hover{background:var(--accent-tint-bg,rgba(255,255,255,.09));}
    .sl-settings-label{font-size:var(--text-body-size,.875rem)!important;font-weight:var(--w-medium,500);color:var(--color-text-primary,rgba(255,255,255,.9));flex:1;line-height:1.35;}
    .sl-toggle{position:relative;display:inline-flex;width:40px;height:22px;flex-shrink:0;cursor:pointer;}
    .sl-toggle input{opacity:0;width:0;height:0;position:absolute;}
    .sl-toggle span{position:absolute;inset:0;background:rgba(0,0,0,.42);border-radius:100px;box-shadow:inset 0 1px 2px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.06);transition:background .2s,box-shadow .2s;}
    .sl-toggle span::after{content:"";position:absolute;width:16px;height:16px;left:3px;top:3px;background:rgba(245,245,245,.86);box-shadow:0 2px 5px rgba(0,0,0,.5),0 0 0 .5px rgba(0,0,0,.28);border-radius:50%;transition:transform .2s,background .2s;}
    .sl-toggle input:checked+span{background:rgba(255,255,255,.42);box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 0 0 1px rgba(255,255,255,.24);}
    .sl-toggle input:checked+span::after{transform:translateX(18px);}
    .sl-select-wrap{position:relative;display:inline-flex;align-items:center;flex-shrink:0;max-width:220px;}
    .sl-select-wrap::after{content:"";position:absolute;right:9px;top:50%;width:12px;height:12px;transform:translateY(-50%);pointer-events:none;background:currentColor;opacity:.62;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") center/12px 12px no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") center/12px 12px no-repeat;}
    .sl-select{-webkit-appearance:none;appearance:none;background-color:var(--accent-tint-bg,rgba(255,255,255,.09));background-image:none!important;color:var(--color-text-primary,rgba(255,255,255,.9));border:0;box-shadow:inset 0 0 0 1px var(--hairline,rgba(255,255,255,.12));border-radius:var(--radius-sm,8px);padding:7px 28px 7px 10px;font-size:var(--text-caption-size,.8rem)!important;font-weight:var(--w-medium,500);cursor:pointer;width:100%;max-width:220px;}
    .SpicyLyricsSettingsContainer .sl-select:hover{background-color:var(--accent-tint-bg-hover,rgba(255,255,255,.14));background-image:none!important;box-shadow:inset 0 0 0 1px var(--hairline-strong,rgba(255,255,255,.25));}
    .sl-select option{background:#1a1a1a;color:rgba(255,255,255,.85);}
    .sl-select:focus{outline:none;box-shadow:inset 0 0 0 1px var(--hairline-strong,rgba(255,255,255,.28));}
    .sl-input{background:var(--accent-tint-bg,rgba(255,255,255,.09));border:0;box-shadow:inset 0 0 0 1px var(--hairline,rgba(255,255,255,.12));border-radius:var(--radius-sm,8px);color:var(--color-text-primary,rgba(255,255,255,.9));padding:7px 10px;font-size:var(--text-caption-size,.8rem)!important;flex-shrink:0;width:220px;outline:none;transition:box-shadow .15s,background .15s;}
    .sl-input::placeholder{color:var(--color-text-tertiary,rgba(255,255,255,.38));}
    .sl-input:focus{background:var(--accent-tint-bg-hover,rgba(255,255,255,.14));box-shadow:inset 0 0 0 1px var(--hairline-strong,rgba(255,255,255,.28));}
    .sl-btn{background:var(--accent-tint-bg,rgba(255,255,255,.09));color:var(--color-text-primary,rgba(255,255,255,.9));border:0;box-shadow:inset 0 0 0 1px var(--hairline,rgba(255,255,255,.12));border-radius:var(--radius-sm,8px);padding:7px 14px;font-size:var(--text-caption-size,.8rem)!important;font-weight:var(--w-semibold,600);cursor:pointer;flex-shrink:0;transition:background .15s,box-shadow .15s,transform .12s;}
    .sl-btn:hover{background:var(--accent-tint-bg-hover,rgba(255,255,255,.14));box-shadow:inset 0 0 0 1px var(--hairline-strong,rgba(255,255,255,.25));}
    .sl-btn:active{transform:scale(.97);}
    .sl-btn.sl-btn-primary{background:var(--accent,#fff);color:var(--accent-on-fill,#111);box-shadow:none;}
    .sl-btn.sl-btn-primary:hover{background:var(--accent-hover,#fff);box-shadow:none;}
    .sl-btn.sl-btn-danger{color:rgba(255,132,112,.95);box-shadow:inset 0 0 0 1px rgba(255,132,112,.28);}
    .sl-btn.sl-btn-danger:hover{background:rgba(255,132,112,.1);box-shadow:inset 0 0 0 1px rgba(255,132,112,.45);}
    .GenericModal:has(.slm),.GenericModal:has(.slm) .main-trackCreditsModal-container{border-radius:16px;}
    .main-trackCreditsModal-mainSection:has(.slm.scroll-x-hidden){overflow-x:hidden;}
  `;
  document.head.appendChild(style);
};

// ─── Panel helper ───
// Creates an overlay matching the SpicyLyricsSettingsContainer style,
// centered within the Spotify viewport.

const showPanel = (title, buildContent) => {
  const existing = document.querySelector(".SpicyLyricsChannelOverlay");
  if (existing) existing.remove();

  const backdrop = document.createElement("div");
  backdrop.className = "SpicyLyricsSettingsOverlay SpicyLyricsChannelOverlay";

  const container = document.createElement("div");
  container.className = "SpicyLyricsSettingsContainer";

  const panelWidth = 500;

  function updatePosition() {
    const safeInset = 24;
    const availW = window.innerWidth;
    const availH = window.innerHeight;
    const w = Math.min(panelWidth, Math.max(320, availW - safeInset * 2));
    container.style.width     = `${w}px`;
    container.style.left      = `${(availW - w) / 2}px`;
    container.style.top       = `${availH / 2}px`;
    container.style.transform = "translateY(-50%)";
    container.style.maxHeight = `${Math.max(280, availH - safeInset * 2)}px`;
  }

  updatePosition();
  window.addEventListener("resize", updatePosition);

  const removalObserver = new MutationObserver(() => {
    if (!document.contains(backdrop)) {
      window.removeEventListener("resize", updatePosition);
      removalObserver.disconnect();
    }
  });
  removalObserver.observe(document.body, { childList: true });

  const header = document.createElement("div");
  header.className = "SpicyLyricsSettingsHeader";
  const titleEl = document.createElement("span");
  titleEl.textContent = title;
  const closeBtn = document.createElement("button");
  closeBtn.className = "SpicyLyricsSettingsHeaderClose";
  closeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  const close = () => backdrop.remove();
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  container.addEventListener("click", (e) => e.stopPropagation());

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const scroll = document.createElement("div");
  scroll.className = "SpicyLyricsSettingsScroll";

  buildContent(scroll, close, { titleEl, container, backdrop });

  container.appendChild(header);
  container.appendChild(scroll);
  backdrop.appendChild(container);
  document.body.appendChild(backdrop);

  return close;
};

// ─── UI helpers ───

const makeRow = (labelText, control) => {
  const row = document.createElement("div");
  row.className = "sl-settings-row";
  const lbl = document.createElement("span");
  lbl.className = "sl-settings-label";
  lbl.textContent = labelText;
  row.appendChild(lbl);
  row.appendChild(control);
  return row;
};

const makeToggle = () => {
  const wrap = document.createElement("label");
  wrap.className = "sl-toggle";
  const input = document.createElement("input");
  input.type = "checkbox";
  const knob = document.createElement("span");
  wrap.appendChild(input);
  wrap.appendChild(knob);
  return { wrap, input };
};

const makeInput = (placeholder) => {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "sl-input";
  input.placeholder = placeholder;
  return input;
};

const makeBtn = (text, modifiers = "") => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sl-btn" + (modifiers ? " " + modifiers : "");
  btn.textContent = text;
  return btn;
};

const makeGroup = (text) => {
  const h = document.createElement("h3");
  h.className = "sl-settings-group";
  h.textContent = text;
  return h;
};

const makeBtnRow = () => {
  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:8px;justify-content:flex-end;padding:8px 6px 2px;";
  return row;
};

const reopenPanel = (close, next) => {
  close();
  setTimeout(next, 100);
};

// ─── Channel Management UI ───

const showChannelSwitcher = () => {
  showPanel("Build Channel", (scroll, close, panel) => {
    const map = getCustomChannelAccessEnabled() ? getFullChannelMap() : CHANNEL_MAP;
    const allNames = Object.keys(map);
    const current = getCurrentChannel();
    attachSecretToggleGesture(panel?.titleEl, () => reopenPanel(close, showChannelSwitcher));
    const select = document.createElement("select");
    select.className = "sl-select";
    for (const name of allNames) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      opt.selected = name === current;
      select.appendChild(opt);
    }

    const selectWrap = document.createElement("span");
    selectWrap.className = "sl-select-wrap";
    selectWrap.appendChild(select);

    const buildChannelRow = makeRow("Build Channel", selectWrap);
    const buildChannelLabel = buildChannelRow.querySelector(".sl-settings-label");
    scroll.appendChild(buildChannelRow);

    attachSecretToggleGesture(buildChannelLabel, () => reopenPanel(close, showChannelSwitcher));

    const info = document.createElement("p");
    info.style.cssText = "margin:2px 8px 10px;font-size:0.72rem;color:rgba(255,255,255,0.35);line-height:1.5;";
    const updateInfo = () => {
      const hosts = map[select.value];
      if (!hosts) return (info.textContent = "");
      info.innerHTML = "";
      const h0 = document.createElement("strong"); h0.textContent = hosts[0];
      const h1 = document.createElement("strong"); h1.textContent = hosts[1];
      info.append(h0, " / ", h1);
      if (hosts[2]) {
        const fx = document.createElement("strong"); fx.textContent = hosts[2];
        info.append(" \u00b7 fixed: ", fx);
      }
    };
    updateInfo();
    select.addEventListener("change", updateInfo);
    scroll.appendChild(info);

    const btnRow = makeBtnRow();

    if (getCustomChannelAccessEnabled()) {
      const addBtn = makeBtn("Add Custom");
      addBtn.addEventListener("click", () => reopenPanel(close, showAddCustomChannel));
      btnRow.appendChild(addBtn);

      const removeBtn = makeBtn("Remove Custom", "sl-btn-danger");
      removeBtn.addEventListener("click", () => reopenPanel(close, showRemoveCustomChannel));
      btnRow.appendChild(removeBtn);
    }

    const applyBtn = makeBtn("Apply & Reload", "sl-btn-primary");
    applyBtn.addEventListener("click", () => { setCurrentChannel(select.value); close(); window.location.reload(); });
    btnRow.appendChild(applyBtn);

    scroll.appendChild(btnRow);
  });
};

const showAddCustomChannel = () => {
  showPanel("Add Channel", (scroll, close) => {
    scroll.appendChild(makeGroup("Channel Details"));

    const nameInput = makeInput("e.g. My-Test-Server");
    scroll.appendChild(makeRow("Channel Name", nameInput));

    const apiInput = makeInput(`Default: ${DEFAULT_API_HOST}`);
    scroll.appendChild(makeRow("API Host", apiInput));

    const storageInput = makeInput(`Default: ${DEFAULT_STORAGE_HOST}`);
    const storageRow = makeRow("Storage Host", storageInput);
    scroll.appendChild(storageRow);

    const { wrap: sameWrap, input: sameCb } = makeToggle();
    scroll.appendChild(makeRow("Use the same host for both API and Storage", sameWrap));
    sameCb.addEventListener("change", () => {
      storageRow.style.display = sameCb.checked ? "none" : "";
    });

    const { wrap: fixedToggleWrap, input: fixedCb } = makeToggle();
    scroll.appendChild(makeRow("Use a fixed version instead of fetching from /version", fixedToggleWrap));

    const fixedInput = makeInput("e.g. 5.19.11");
    const fixedRow = makeRow("Fixed Version", fixedInput);
    fixedRow.style.display = "none";
    scroll.appendChild(fixedRow);
    fixedCb.addEventListener("change", () => {
      fixedRow.style.display = fixedCb.checked ? "" : "none";
    });

    const note = document.createElement("p");
    note.style.cssText = "margin:4px 8px 10px;font-size:0.7rem;color:rgba(255,255,255,0.35);line-height:1.5;";
    note.innerHTML = `Leave API Host and Storage Host empty to use the defaults. To pull an older version, set a channel name, enable fixed version, and enter the version number.<br><br>The API host must serve <strong>/version</strong> as plain text. The Storage host must serve the bundle at <strong>/spicy-lyrics@{version}.mjs</strong> with CORS and <code>application/javascript</code>.`;
    scroll.appendChild(note);

    const btnRow = makeBtnRow();

    const cancelBtn = makeBtn("Cancel");
    cancelBtn.addEventListener("click", () => reopenPanel(close, showChannelSwitcher));
    btnRow.appendChild(cancelBtn);

    const saveBtn = makeBtn("Save Channel", "sl-btn-primary");
    saveBtn.addEventListener("click", () => {
      const name = nameInput.value.trim();
      const apiHostRaw = apiInput.value.trim();
      const storageHostRaw = sameCb.checked ? apiHostRaw : storageInput.value.trim();
      const fixedVersion = fixedCb.checked ? fixedInput.value.trim() : "";
      const apiHost = apiHostRaw || DEFAULT_API_HOST;
      const storageHost = storageHostRaw || DEFAULT_STORAGE_HOST;

      if (!name) { Spicetify.showNotification("Channel name is required", true); return; }
      if (fixedCb.checked && !fixedVersion) { Spicetify.showNotification("Fixed version is required when enabled", true); return; }
      if (BUILT_IN_CHANNELS.includes(name)) { Spicetify.showNotification("Cannot override built-in channels", true); return; }

      const channels = getCustomChannels();
      channels[name] = fixedVersion ? [apiHost, storageHost, fixedVersion] : [apiHost, storageHost];
      saveCustomChannels(channels);

      close();
      Spicetify.showNotification(`Channel "${name}" added`);
      setTimeout(showChannelSwitcher, 100);
    });
    btnRow.appendChild(saveBtn);

    scroll.appendChild(btnRow);
  });
};

const showRemoveCustomChannel = () => {
  const channels = getCustomChannels();
  const names = Object.keys(channels);

  if (names.length === 0) {
    Spicetify.showNotification("No custom channels to remove", true);
    setTimeout(showChannelSwitcher, 100);
    return;
  }

  showPanel("Manage Channels", (scroll, close) => {
    scroll.appendChild(makeGroup("Custom Channels"));

    for (const name of names) {
      const row = document.createElement("div");
      row.className = "sl-settings-row";

      const info = document.createElement("div");
      const nameEl = document.createElement("div");
      nameEl.style.cssText = "font-weight:600;font-size:0.875rem;color:rgba(255,255,255,0.85);";
      nameEl.textContent = name;
      const hostEl = document.createElement("div");
      hostEl.style.cssText = "font-size:0.72rem;color:rgba(255,255,255,0.4);margin-top:2px;";
      hostEl.textContent = `${channels[name][0]} / ${channels[name][1]}${channels[name][2] ? ` \u00b7 fixed: ${channels[name][2]}` : ""}`;
      info.appendChild(nameEl);
      info.appendChild(hostEl);

      const removeBtn = makeBtn("Remove", "sl-btn-danger");
      removeBtn.addEventListener("click", () => {
        delete channels[name];
        saveCustomChannels(channels);
        if (getCurrentChannel() === name) setCurrentChannel("Stable");
        close();
        Spicetify.showNotification(`Channel "${name}" removed`);
        setTimeout(showChannelSwitcher, 100);
      });

      row.appendChild(info);
      row.appendChild(removeBtn);
      scroll.appendChild(row);
    }

    const btnRow = makeBtnRow();
    const backBtn = makeBtn("Back");
    backBtn.addEventListener("click", () => reopenPanel(close, showChannelSwitcher));
    btnRow.appendChild(backBtn);
    scroll.appendChild(btnRow);
  });
};

// ─── Expose channel manager globally for the plugin to use ───

window._spicy_lyrics_channels = {
  showSwitcher: showChannelSwitcher,
  showAdd: showAddCustomChannel,
  showRemove: showRemoveCustomChannel,
  getCurrent: getCurrentChannel,
  getMap: getFullChannelMap,
};

// ─── Stable Settings Injection ───
// Stable exposes this SettingsSection itself. Add a row to its rendered DOM so
// the upstream bundle remains untouched.

const STABLE_SETTINGS_ID = "spicy-lyrics-settings";
const CHANNEL_SETTING_ROW_ID = "spicy-lyrics-entry-channel-row";
let channelSettingsRenderInterval = null;
let channelSettingsObserver = null;

const removeChannelSettingsSection = () => {
  document.getElementById(CHANNEL_SETTING_ROW_ID)?.remove();
  channelSettingsObserver?.disconnect();
  channelSettingsObserver = null;
};

const renderChannelSettings = () => {
  if (channelSettingsRenderInterval) {
    clearInterval(channelSettingsRenderInterval);
    channelSettingsRenderInterval = null;
  }

  if (Spicetify.Platform.History.location.pathname !== "/preferences") {
    removeChannelSettingsSection();
    return;
  }

  channelSettingsRenderInterval = setInterval(() => {
    if (Spicetify.Platform.History.location.pathname !== "/preferences") {
      clearInterval(channelSettingsRenderInterval);
      channelSettingsRenderInterval = null;
      removeChannelSettingsSection();
      return;
    }

    const stableContainer = document.getElementById(STABLE_SETTINGS_ID);
    const stableSection = stableContainer?.querySelector(".x-settings-section") ?? stableContainer;
    if (!stableSection || document.getElementById(CHANNEL_SETTING_ROW_ID)) return;

    const channels = getCustomChannelAccessEnabled() ? getFullChannelMap() : CHANNEL_MAP;
    const current = channels[getCurrentChannel()] ? getCurrentChannel() : "Stable";
    const row = document.createElement("div");
    row.id = CHANNEL_SETTING_ROW_ID;
    row.className = "x-settings-row eguwzH_QWTBXry7hiNj3";

    const firstColumn = document.createElement("div");
    firstColumn.className = "x-settings-firstColumn lfXDZUXLhhKhFPjDO8by";
    const label = document.createElement("label");
    label.className = "TypeElement-viola-textSubdued-type e-91000-text encore-text-body-small encore-internal-color-text-subdued";
    label.htmlFor = "spicy-lyrics-entry-channel-select";
    label.textContent = "Build Channel";
    firstColumn.appendChild(label);

    const secondColumn = document.createElement("div");
    secondColumn.className = "x-settings-secondColumn jKCZodyn7H2Trr7dhvGm";
    const select = document.createElement("select");
    select.id = "spicy-lyrics-entry-channel-select";
    select.className = "main-dropDown-dropDown FQupgLGfMkp1dOYvUeuQ x-settings-dropdown";
    for (const name of Object.keys(channels)) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      option.selected = name === current;
      select.appendChild(option);
    }
    select.addEventListener("change", () => {
      setCurrentChannel(select.value);
      window.location.reload();
    });
    secondColumn.appendChild(select);
    row.append(firstColumn, secondColumn);
    stableSection.appendChild(row);

    // SettingsSection rerenders its React subtree. Reinsert the external row
    // after a settings change without patching the upstream plugin.
    channelSettingsObserver?.disconnect();
    channelSettingsObserver = new MutationObserver(() => {
      if (Spicetify.Platform.History.location.pathname === "/preferences" && !document.getElementById(CHANNEL_SETTING_ROW_ID)) {
        renderChannelSettings();
      }
    });
    channelSettingsObserver.observe(stableSection, { childList: true });
    clearInterval(channelSettingsRenderInterval);
    channelSettingsRenderInterval = null;
  }, 100);
};

const registerChannelSettings = () => {
  const waitForHistory = setInterval(() => {
    if (Spicetify?.Platform?.History?.listen) {
      clearInterval(waitForHistory);
      Spicetify.Platform.History.listen(renderChannelSettings);
      renderChannelSettings();
    }
  }, 100);
};

// ─── Loading Logic ───

const getVersionFromHost = (host) =>
  fetch(`https://${host}/version`).then((response) => {
    if (!response.ok) throw new Error("Bad response");
    return response.text();
  });

const loadExtension = async (storageHost, version) => {
  window._spicy_lyrics_metadata = { LoadedVersion: version };
  return await import(`https://${storageHost}/spicy-lyrics@${encodeURIComponent(version)}.mjs`);
};

const makeErrorContent = (title, description) => {
  const div = document.createElement("div");
  div.style.cssText = "text-align:center;padding:24px 16px;";
  div.innerHTML = `
    <h2 style="margin:0 0 8px;font-size:1.5rem;font-weight:700;color:#fff;">${title}</h2>
    <p style="margin:0 0 20px;font-size:0.875rem;color:rgba(255,255,255,0.5);">${description}</p>
    <p style="margin:0 0 8px;font-size:0.875rem;color:rgba(255,255,255,0.7);">
      Check your connection and our
      <a href="https://status.spicylyrics.org" style="color:#fff;text-decoration:underline;">Status Page</a>.
    </p>
    <p style="margin:0 0 20px;font-size:0.8rem;color:rgba(255,255,255,0.4);">
      Still having issues?
      <a href="https://discord.com/invite/uqgXU5wh8j" style="color:rgba(255,255,255,0.6);text-decoration:underline;">Discord</a>
    </p>
  `;
  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;justify-content:center;";
  const switchBtn = makeBtn("Switch Build Channel");
  switchBtn.addEventListener("click", showChannelSwitcher);
  btnRow.appendChild(switchBtn);
  div.appendChild(btnRow);
  return div;
};

const showVersionError = () => {
  showPanel("Spicy Lyrics", (scroll) => {
    scroll.appendChild(makeErrorContent(
      "Failed to load",
      "We couldn\u2019t connect after multiple attempts."
    ));
  });
};

const showImportError = () => {
  showPanel("Spicy Lyrics", (scroll) => {
    scroll.appendChild(makeErrorContent(
      "Failed to initialize",
      "The extension couldn\u2019t be loaded properly."
    ));
  });
};

const selectVersionFromChannel = () => {
  const channel = getCurrentChannel();
  const map = getFullChannelMap();
  const hosts = map[channel] ?? map.Stable;

  const fixedVersion = hosts.length >= 3 ? hosts[2] : null;
  console.log(`[Spicy Lyrics] [Entry] Channel: ${channel}, API: ${hosts[0]}, Storage: ${hosts[1]}${fixedVersion ? `, Fixed Version: ${fixedVersion}` : ""}`);
  return { apiHost: hosts[0], storageHost: hosts[1], fixedVersion };
};

const load = async () => {
  await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (
        Spicetify !== undefined &&
        Spicetify.React !== undefined &&
        Spicetify.ReactDOM !== undefined &&
        Spicetify.ReactDOMServer !== undefined &&
        Spicetify.LocalStorage !== undefined
      ) {
        clearInterval(interval);
        resolve();
      }
    }, 10);
  });

  // Inject styles so the panel works regardless of which plugin version is loaded
  injectStyles();

  // Initialize the custom-channel gate before any UI tries to read it
  getCustomChannelAccessEnabled();

  // Register channel settings in the settings page (works even if plugin fails)
  registerChannelSettings();
  registerSettingsPageUnlockGesture();

  const { apiHost, storageHost, fixedVersion } = selectVersionFromChannel();
  let lastError;
  let version;

  if (fixedVersion) {
    version = fixedVersion;
  } else {
    for (let i = 0; i < 10; i++) {
      try {
        version = await getVersionFromHost(apiHost);
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!version) {
      console.error(`[Spicy Lyrics] [Entry] Failed to fetch version after 10 attempts:`, lastError);
      showVersionError();
      return;
    }
  }

  for (let i = 0; i < 3; i++) {
    try {
      await loadExtension(storageHost, version);
      renderChannelSettings();
      return;
    } catch (err) {
      lastError = err;
    }
  }

  console.error(`[Spicy Lyrics] [Entry] Failed to import extension after 3 attempts:`, lastError);
  showImportError();
};

load();
