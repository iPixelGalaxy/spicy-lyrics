import Defaults from "../components/Global/Defaults.ts";
import storage from "./storage.ts";
import { RemoveAllLyricsCaches, RemoveCurrentLyrics_AllCaches, RemoveCurrentLyrics_StateCache, RemoveLyricsCache, ReloadCurrentLyrics } from "./LyricsCacheTools.ts";
import {
  LYRICS_SOURCE_PROVIDER_DEFINITIONS,
  normalizeLyricsSourceOrder,
  normalizeDisabledLyricsSourceIds,
  stringifyLyricsSourceOrder,
  type LyricsSourceProviderId,
} from "./Lyrics/LyricsSourcePreferences.ts";
import { refreshMusixmatchToken } from "./Lyrics/ExternalSources.ts";

function attachDevModeGesture() {
  let rightClickCount = 0;
  let leftClickCount = 0;
  let clickTimeout: ReturnType<typeof setTimeout> | null = null;

  const resetCounts = () => {
    rightClickCount = 0;
    leftClickCount = 0;
  };

  const queueReset = () => {
    if (clickTimeout) clearTimeout(clickTimeout);
    clickTimeout = setTimeout(resetCounts, 3000);
  };

  const setupHeading = () => {
    const container = document.getElementById("spicy-lyrics-settings");
    if (!container) return;

    const heading = container.querySelector<HTMLElement>("h2");
    if (!heading || (heading as any).__spicy_devmode_gesture) return;
    (heading as any).__spicy_devmode_gesture = true;

    heading.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      rightClickCount++;
      leftClickCount = 0;
      queueReset();

      if (rightClickCount < 7) return;

      resetCounts();
      storage.set("developerMode", "true");
      Spicetify.showNotification("Developer Mode enabled");
    });

    heading.addEventListener("click", (e) => {
      if ((e as MouseEvent).button !== 0) return;

      leftClickCount++;
      rightClickCount = 0;
      queueReset();

      if (leftClickCount < 6) return;

      resetCounts();
      storage.set("developerMode", "false");
      Spicetify.showNotification("Developer Mode disabled");
    });
  };

  const waitAndSetup = () => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;

      if (document.getElementById("spicy-lyrics-settings")) {
        clearInterval(interval);
        setupHeading();
        return;
      }

      if (attempts > 100) {
        clearInterval(interval);
      }
    }, 50);
  };

  Spicetify.Platform.History.listen((e: any) => {
    if (e.pathname === "/preferences") {
      waitAndSetup();
    }
  });

  if (Spicetify.Platform.History.location.pathname === "/preferences") {
    waitAndSetup();
  }
}

function showLyricsSourcePreferencesPanel() {
  if (document.querySelector(".SpicyLyricsSourceOrderOverlay")) return;

  const modalPadding = 24;
  const preferredWidth = 720;
  const page = document.querySelector<HTMLElement>("#SpicyLyricsPage");
  let workingOrder = normalizeLyricsSourceOrder(Defaults.LyricsSourceOrder);
  let workingDisabled = new Set<LyricsSourceProviderId>(Defaults.DisabledLyricsSourceIds);
  let workingMusixmatchToken = storage.get("musixmatchToken")?.toString().trim() ?? "";
  let workingIgnoreMusixmatchWordSync = Defaults.IgnoreMusixmatchWordSync;
  let workingPrioritizeAppleMusic = Defaults.PrioritizeAppleMusicQuality;
  const initialOrder = stringifyLyricsSourceOrder(workingOrder);
  const initialDisabled = JSON.stringify([...workingDisabled].sort());
  const initialMusixmatchToken = workingMusixmatchToken;
  const initialIgnoreMusixmatchWordSync = workingIgnoreMusixmatchWordSync;
  const initialPrioritizeAppleMusic = workingPrioritizeAppleMusic;
  let musixmatchStatusText = workingMusixmatchToken
    ? "Using a saved custom Musixmatch token."
    : "No custom token saved. The built-in fallback token will be used.";
  let updateMusixmatchStatus: ((text: string) => void) | null = null;
  let cacheCleared = false;

  const backdrop = document.createElement("div");
  backdrop.className = "SpicyLyricsSettingsOverlay SpicyLyricsSourceOrderOverlay";

  const container = document.createElement("div");
  container.className = "SpicyLyricsSettingsContainer";

  const getViewportBounds = () => ({
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const getPanelBounds = () => {
    if (!page) return getViewportBounds();
    const rect = page.getBoundingClientRect();
    if (rect.width <= modalPadding * 2 || rect.height <= modalPadding * 2) {
      return getViewportBounds();
    }
    return rect;
  };

  const applyPanelBounds = () => {
    const bounds = getPanelBounds();
    const availableWidth = Math.max(0, Math.min(bounds.width, window.innerWidth) - modalPadding * 2);
    const availableHeight = Math.max(0, Math.min(bounds.height, window.innerHeight) - modalPadding * 2);
    const width = Math.min(preferredWidth, availableWidth);
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;

    container.style.width = `${width}px`;
    container.style.maxHeight = `${availableHeight}px`;

    const actualHeight = container.offsetHeight;
    const maxLeft = Math.max(modalPadding, window.innerWidth - modalPadding - width);
    const maxTop = Math.max(modalPadding, window.innerHeight - modalPadding - actualHeight);
    const left = Math.min(Math.max(centerX - width / 2, modalPadding), maxLeft);
    const top = Math.min(Math.max(centerY - actualHeight / 2, modalPadding), maxTop);

    container.style.left = `${left}px`;
    container.style.top = `${top}px`;
  };

  const header = document.createElement("div");
  header.className = "SpicyLyricsSettingsHeader";

  const titleWrap = document.createElement("div");
  const title = document.createElement("span");
  title.textContent = "Lyrics Source Preferences";

  const subtitle = document.createElement("p");
  subtitle.textContent =
    "Higher sources are tried first. Changes apply immediately and clear the lyrics cache.";
  subtitle.style.margin = "6px 0 0";
  subtitle.style.opacity = "0.7";
  subtitle.style.lineHeight = "1.4";

  titleWrap.appendChild(title);
  titleWrap.appendChild(subtitle);
  header.appendChild(titleWrap);

  const closeButton = document.createElement("button");
  closeButton.className = "SpicyLyricsSettingsHeaderClose";
  closeButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  header.appendChild(closeButton);

  const scroll = document.createElement("div");
  scroll.className = "SpicyLyricsSettingsScroll";

  const list = document.createElement("div");
  Object.assign(list.style, {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  });

  const closePanel = () => {
    window.removeEventListener("resize", applyPanelBounds);
    backdrop.remove();
  };

  const setMusixmatchStatus = (text: string) => {
    musixmatchStatusText = text;
    updateMusixmatchStatus?.(text);
  };

  const save = async () => {
    const normalizedOrder = normalizeLyricsSourceOrder(workingOrder);
    const serializedOrder = stringifyLyricsSourceOrder(normalizedOrder);
    const serializedDisabled = JSON.stringify([...workingDisabled].sort());

    storage.set("lyricsSourceOrder", serializedOrder);
    storage.set("disabledLyricsSources", JSON.stringify([...workingDisabled]));
    storage.set("musixmatchToken", workingMusixmatchToken);
    storage.set("ignoreMusixmatchWordSync", workingIgnoreMusixmatchWordSync.toString());
    storage.set("prioritizeAppleMusicQuality", workingPrioritizeAppleMusic.toString());

    Defaults.LyricsSourceOrder = normalizedOrder;
    Defaults.DisabledLyricsSourceIds = normalizeDisabledLyricsSourceIds(serializedDisabled);
    Defaults.IgnoreMusixmatchWordSync = workingIgnoreMusixmatchWordSync;
    Defaults.PrioritizeAppleMusicQuality = workingPrioritizeAppleMusic;

    const changed =
      serializedOrder !== initialOrder ||
      serializedDisabled !== initialDisabled ||
      workingMusixmatchToken !== initialMusixmatchToken ||
      workingIgnoreMusixmatchWordSync !== initialIgnoreMusixmatchWordSync ||
      workingPrioritizeAppleMusic !== initialPrioritizeAppleMusic;

    if (changed && !cacheCleared) {
      cacheCleared = true;
      await RemoveAllLyricsCaches(false);
    }
  };

  const renderList = () => {
    list.innerHTML = "";
    updateMusixmatchStatus = null;

    workingOrder.forEach((providerId, index) => {
      const definition = LYRICS_SOURCE_PROVIDER_DEFINITIONS[providerId];
      const isDisabled = workingDisabled.has(providerId);

      const row = document.createElement("div");
      Object.assign(row.style, {
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "16px",
        alignItems: "center",
        padding: "14px 16px",
        borderRadius: "12px",
        background: "rgba(var(--spice-rgb-text), 0.04)",
        border: "1px solid rgba(var(--spice-rgb-text), 0.06)",
      });

      const info = document.createElement("div");
      info.style.transition = "opacity 0.15s";
      info.style.opacity = isDisabled ? "0.45" : "";

      const name = document.createElement("div");
      name.textContent = `${index + 1}. ${definition.label}`;
      name.style.fontWeight = "600";
      name.style.marginBottom = "4px";

      const description = document.createElement("div");
      description.textContent = definition.description;
      description.style.opacity = "0.72";
      description.style.lineHeight = "1.35";

      info.appendChild(name);
      info.appendChild(description);

      if (providerId === "musixmatch") {
        const tokenBlock = document.createElement("div");
        Object.assign(tokenBlock.style, {
          marginTop: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        });

        const tokenInput = document.createElement("input");
        tokenInput.type = "text";
        tokenInput.className = "sl-input";
        tokenInput.placeholder = "Place your Musixmatch token here";
        tokenInput.value = workingMusixmatchToken;
        tokenInput.autocomplete = "off";
        tokenInput.spellcheck = false;
        tokenInput.style.flex = "1 1 280px";
        tokenInput.style.minWidth = "0";
        tokenInput.addEventListener("input", () => {
          workingMusixmatchToken = tokenInput.value.trim();
          void save();
        });

        const tokenActionsRow = document.createElement("div");
        Object.assign(tokenActionsRow.style, {
          display: "flex",
          gap: "8px",
          alignItems: "center",
          flexWrap: "wrap",
        });

        const refreshButton = document.createElement("button");
        refreshButton.className = "sl-btn";
        refreshButton.textContent = "Refresh";

        const clearButton = document.createElement("button");
        clearButton.className = "sl-btn";
        clearButton.textContent = "Clear";

        const status = document.createElement("div");
        status.textContent = musixmatchStatusText;
        Object.assign(status.style, {
          minHeight: "18px",
          fontSize: "12px",
          opacity: "0.72",
          lineHeight: "1.35",
        });
        updateMusixmatchStatus = (text: string) => {
          status.textContent = text;
        };

        refreshButton.addEventListener("click", async () => {
          refreshButton.disabled = true;
          clearButton.disabled = true;
          setMusixmatchStatus("Refreshing Musixmatch token...");

          try {
            const token = await refreshMusixmatchToken(false);
            if (!token) {
              setMusixmatchStatus("Failed to refresh the Musixmatch token.");
              return;
            }

            workingMusixmatchToken = token;
            tokenInput.value = token;
            setMusixmatchStatus("Musixmatch token refreshed.");
            void save();
          } finally {
            refreshButton.disabled = false;
            clearButton.disabled = false;
          }
        });

        clearButton.addEventListener("click", () => {
          workingMusixmatchToken = "";
          tokenInput.value = "";
          setMusixmatchStatus("Custom token cleared. The built-in fallback token will be used.");
          void save();
        });

        const ignoreWordSyncRow = document.createElement("div");
        Object.assign(ignoreWordSyncRow.style, {
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
        });

        const toggleControl = document.createElement("label");
        toggleControl.className = "sl-toggle";

        const ignoreWordSyncInput = document.createElement("input");
        ignoreWordSyncInput.type = "checkbox";
        ignoreWordSyncInput.checked = workingIgnoreMusixmatchWordSync;
        ignoreWordSyncInput.addEventListener("change", () => {
          workingIgnoreMusixmatchWordSync = ignoreWordSyncInput.checked;
          void save();
        });

        const toggleKnob = document.createElement("span");

        const toggleLabel = document.createElement("div");
        toggleLabel.textContent = "Ignore word syncs";
        Object.assign(toggleLabel.style, {
          fontSize: "13px",
          opacity: "0.9",
        });

        toggleControl.appendChild(ignoreWordSyncInput);
        toggleControl.appendChild(toggleKnob);
        ignoreWordSyncRow.appendChild(toggleControl);
        ignoreWordSyncRow.appendChild(toggleLabel);

        tokenActionsRow.appendChild(tokenInput);
        tokenActionsRow.appendChild(refreshButton);
        tokenActionsRow.appendChild(clearButton);
        tokenBlock.appendChild(tokenActionsRow);
        tokenBlock.appendChild(ignoreWordSyncRow);
        tokenBlock.appendChild(status);
        info.appendChild(tokenBlock);
      }

      if (providerId === "apple") {
        const appleBlock = document.createElement("div");
        Object.assign(appleBlock.style, {
          marginTop: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        });

        const prioritizeRow = document.createElement("div");
        Object.assign(prioritizeRow.style, {
          display: "flex",
          alignItems: "center",
          gap: "8px",
        });

        const prioritizeControl = document.createElement("label");
        prioritizeControl.className = "sl-toggle";

        const prioritizeInput = document.createElement("input");
        prioritizeInput.type = "checkbox";
        prioritizeInput.checked = workingPrioritizeAppleMusic;
        prioritizeInput.addEventListener("change", () => {
          workingPrioritizeAppleMusic = prioritizeInput.checked;
          void save();
        });

        const prioritizeKnob = document.createElement("span");

        const prioritizeLabel = document.createElement("div");
        prioritizeLabel.textContent = "Prioritize higher quality lyrics";
        Object.assign(prioritizeLabel.style, {
          fontSize: "13px",
          opacity: "0.9",
        });

        const prioritizeHint = document.createElement("div");
        prioritizeHint.textContent =
          "When enabled, Apple Music lyrics are preferred over Musixmatch if they are of equal or greater quality (e.g. line syncs with end times, word syncs).";
        Object.assign(prioritizeHint.style, {
          fontSize: "12px",
          opacity: "0.6",
          lineHeight: "1.35",
          marginTop: "4px",
        });

        prioritizeControl.appendChild(prioritizeInput);
        prioritizeControl.appendChild(prioritizeKnob);
        prioritizeRow.appendChild(prioritizeControl);
        prioritizeRow.appendChild(prioritizeLabel);
        appleBlock.appendChild(prioritizeRow);
        appleBlock.appendChild(prioritizeHint);
        info.appendChild(appleBlock);
      }

      // Controls: stacked arrow buttons + enable/disable toggle
      const controls = document.createElement("div");
      Object.assign(controls.style, {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexShrink: "0",
      });

      const createMoveButton = (direction: "up" | "down", delta: -1 | 1, disabled: boolean) => {
        const button = document.createElement("button");
        button.className = "sl-btn sl-btn-icon";
        button.disabled = disabled;
        button.setAttribute("aria-label", direction === "up" ? "Move up" : "Move down");
        button.innerHTML =
          direction === "up"
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><polyline points="18 15 12 9 6 15"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><polyline points="6 9 12 15 18 9"/></svg>`;
        button.addEventListener("click", () => {
          const nextIndex = index + delta;
          if (nextIndex < 0 || nextIndex >= workingOrder.length) return;
          const nextOrder = [...workingOrder];
          [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
          workingOrder = nextOrder;
          void save();
          renderList();
        });
        return button;
      };

      const arrowsWrap = document.createElement("div");
      Object.assign(arrowsWrap.style, {
        display: "flex",
        flexDirection: "column",
        gap: "3px",
      });
      arrowsWrap.appendChild(createMoveButton("up", -1, index === 0));
      arrowsWrap.appendChild(createMoveButton("down", 1, index === workingOrder.length - 1));

      const enableToggle = document.createElement("label");
      enableToggle.className = "sl-toggle";

      const enableInput = document.createElement("input");
      enableInput.type = "checkbox";
      enableInput.checked = !isDisabled;
      enableInput.addEventListener("change", () => {
        if (enableInput.checked) {
          workingDisabled.delete(providerId);
        } else {
          const enabledCount = workingOrder.length - workingDisabled.size;
          if (enabledCount <= 1) {
            enableInput.checked = true;
            return;
          }
          workingDisabled.add(providerId);
        }
        info.style.opacity = workingDisabled.has(providerId) ? "0.45" : "";
        void save();
      });

      const enableKnob = document.createElement("span");
      enableToggle.appendChild(enableInput);
      enableToggle.appendChild(enableKnob);

      controls.appendChild(arrowsWrap);
      controls.appendChild(enableToggle);

      row.appendChild(info);
      row.appendChild(controls);
      list.appendChild(row);
    });
  };

  closeButton.addEventListener("click", closePanel);
  backdrop.addEventListener("click", closePanel);
  container.addEventListener("click", (event) => event.stopPropagation());

  renderList();

  container.appendChild(header);
  scroll.appendChild(list);
  container.appendChild(scroll);
  backdrop.appendChild(container);
  document.body.appendChild(backdrop);

  applyPanelBounds();
  window.addEventListener("resize", applyPanelBounds);
}

export function showSettingsPanel() {
  if (document.querySelector(".SpicyLyricsSettingsOverlay")) return;

  const modalPadding = 24;
  const preferredWidth = 1160;
  const preferredHeightRatio = 0.72;
  const minimumHeight = 420;
  const page = document.querySelector<HTMLElement>("#SpicyLyricsPage");

  const backdrop = document.createElement("div");
  backdrop.className = "SpicyLyricsSettingsOverlay";

  const container = document.createElement("div");
  container.className = "SpicyLyricsSettingsContainer";

  const getViewportBounds = () => ({
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const getPanelBounds = () => {
    if (!page) return getViewportBounds();

    const rect = page.getBoundingClientRect();
    if (rect.width <= modalPadding * 2 || rect.height <= modalPadding * 2) {
      return getViewportBounds();
    }

    return rect;
  };

  const applyPanelBounds = () => {
    const bounds = getPanelBounds();
    const availableWidth = Math.max(0, Math.min(bounds.width, window.innerWidth) - modalPadding * 2);
    const availableHeight = Math.max(0, Math.min(bounds.height, window.innerHeight) - modalPadding * 2);
    const width = Math.min(preferredWidth, availableWidth);
    const preferredHeight = Math.max(minimumHeight, bounds.height * preferredHeightRatio);
    const height = Math.min(preferredHeight, availableHeight);
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const maxLeft = Math.max(modalPadding, window.innerWidth - modalPadding - width);
    const maxTop = Math.max(modalPadding, window.innerHeight - modalPadding - height);
    const left = Math.min(Math.max(centerX - width / 2, modalPadding), maxLeft);
    const top = Math.min(Math.max(centerY - height / 2, modalPadding), maxTop);

    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    container.style.left = `${left}px`;
    container.style.top = `${top}px`;
  };

  const closePanel = () => {
    window.removeEventListener("resize", applyPanelBounds);
    backdrop.remove();
  };

  applyPanelBounds();
  window.addEventListener("resize", applyPanelBounds);
  backdrop.addEventListener("click", closePanel);
  container.addEventListener("click", (e) => e.stopPropagation());

  const header = document.createElement("div");
  header.className = "SpicyLyricsSettingsHeader";
  const title = document.createElement("span");
  title.textContent = "Spicy Lyrics Settings";
  const closeBtn = document.createElement("button");
  closeBtn.className = "SpicyLyricsSettingsHeaderClose";
  closeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  closeBtn.addEventListener("click", closePanel);
  header.appendChild(title);
  header.appendChild(closeBtn);

  const scroll = document.createElement("div");
  scroll.className = "SpicyLyricsSettingsScroll";

  function group(name: string) {
    const h = document.createElement("h3");
    h.className = "sl-settings-group";
    h.textContent = name;
    scroll.appendChild(h);
  }

  function makeRow(label: string, control: HTMLElement) {
    const div = document.createElement("div");
    div.className = "sl-settings-row";
    const lbl = document.createElement("span");
    lbl.className = "sl-settings-label";
    lbl.textContent = label;
    div.appendChild(lbl);
    div.appendChild(control);
    scroll.appendChild(div);
  }

  function toggle(label: string, value: boolean, onChange: (v: boolean) => void) {
    const wrap = document.createElement("label");
    wrap.className = "sl-toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = value;
    input.addEventListener("change", () => onChange(input.checked));
    const knob = document.createElement("span");
    wrap.appendChild(input);
    wrap.appendChild(knob);
    makeRow(label, wrap);
  }

  function dropdown(label: string, options: string[], selectedIndex: number, onChange: (v: string) => void) {
    const sel = document.createElement("select");
    sel.className = "sl-select";
    options.forEach((opt, i) => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      if (i === selectedIndex) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => onChange(sel.value));
    makeRow(label, sel);
  }

  function button(label: string, btnText: string, onClick: () => void | Promise<void>) {
    const btn = document.createElement("button");
    btn.className = "sl-btn";
    btn.textContent = btnText;
    btn.addEventListener("click", () => onClick());
    makeRow(label, btn);
  }

  // --- Appearance ---
  group("Appearance");

  let customFontRow: HTMLElement | null = null;

  toggle("Custom Font", Defaults.CustomFontEnabled, (v) => {
    storage.set("customFontEnabled", v.toString());
    Defaults.CustomFontEnabled = v;
    const page = document.querySelector<HTMLElement>("#SpicyLyricsPage");
    if (v) {
      if (customFontRow) customFontRow.style.display = "";
      if (Defaults.CustomFont) {
        document.documentElement.style.setProperty("--spicy-custom-font", Defaults.CustomFont);
      }
      page?.classList.remove("UseSpicyFont");
    } else {
      if (customFontRow) customFontRow.style.display = "none";
      document.documentElement.style.removeProperty("--spicy-custom-font");
      page?.classList.add("UseSpicyFont");
      (window as any).__spicy_load_fonts?.();
    }
  });

  {
    const row = document.createElement("div");
    row.className = "sl-settings-row";
    row.style.display = Defaults.CustomFontEnabled ? "" : "none";
    const lbl = document.createElement("span");
    lbl.className = "sl-settings-label";
    lbl.textContent = "Font Name";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "sl-input";
    input.placeholder = "Spotify Mix";
    input.value = Defaults.CustomFont;
    input.addEventListener("input", () => {
      const val = input.value.trim();
      storage.set("customFont", val);
      Defaults.CustomFont = val;
      if (val) {
        document.documentElement.style.setProperty("--spicy-custom-font", val);
      } else {
        document.documentElement.style.removeProperty("--spicy-custom-font");
      }
    });
    row.appendChild(lbl);
    row.appendChild(input);
    scroll.appendChild(row);
    customFontRow = row;
  }

  toggle("Lock the MediaBox size while in Forced Compact Mode", Defaults.CompactMode_LockedMediaBox, (v) => {
    storage.set("lockedMediaBox", v.toString());
    Defaults.CompactMode_LockedMediaBox = v;
  });

  toggle("Right Align Lyrics", Defaults.RightAlignLyrics, (v) => {
    storage.set("rightAlignLyrics", v.toString());
    Defaults.RightAlignLyrics = v;
  });

  toggle("Minimal Lyrics Mode (Only in Fullscreen/Cinema View)", Defaults.MinimalLyricsMode, (v) => {
    storage.set("minimalLyricsMode", v.toString());
    Defaults.MinimalLyricsMode = v;
    ReloadCurrentLyrics();
  });

  dropdown(
    "Syllable Rendering",
    ["Default", "Merge Words", "Reduce Splits"],
    Defaults.SyllableRendering === "Reduce Splits"
      ? 2
      : Defaults.SyllableRendering === "Merge Words"
        ? 1
        : 0,
    (v) => {
      storage.set("syllableRendering", v);
      Defaults.SyllableRendering = v;
      ReloadCurrentLyrics();
    }
  );

  dropdown(
    "Meme Format",
    ["Off", "Weeb (・`ω´・)", "Gibberish (Wenomechainsama)"],
    Defaults.MemeFormat === "Gibberish" ? 2 : Defaults.MemeFormat === "Weeb" ? 1 : 0,
    (v) => {
      const processedValue =
        v === "Weeb (・`ω´・)"
          ? "Weeb"
          : v === "Gibberish (Wenomechainsama)"
            ? "Gibberish"
            : "Off";
      storage.set("memeFormat", processedValue);
      Defaults.MemeFormat = processedValue;
      ReloadCurrentLyrics();
    }
  );

  dropdown(
    "Release Year Position",
    ["Off", "Before Artist", "After Artist"],
    Defaults.ReleaseYearPosition === "After Artist"
      ? 2
      : Defaults.ReleaseYearPosition === "Before Artist"
        ? 1
        : 0,
    (v) => {
      storage.set("releaseYearPosition", v);
      Defaults.ReleaseYearPosition = v;
      import("../components/Utils/NowBar.ts").then(({ UpdateNowBar }) => UpdateNowBar(true));
    }
  );

  dropdown(
    "Simple Lyrics",
    ["Off", "Calculate (Performance)", "Animated (Legacy, Laggy)"],
    !Defaults.SimpleLyricsMode
      ? 0
      : Defaults.SimpleLyricsMode_RenderingType === "animate"
        ? 2
        : 1,
    (v) => {
      const simpleLyricsEnabled = v !== "Off";
      const processed = v === "Animated (Legacy, Laggy)" ? "animate" : "calculate";
      storage.set("simpleLyricsMode", simpleLyricsEnabled.toString());
      storage.set("simpleLyricsModeRenderingType", processed);
      Defaults.SimpleLyricsMode = simpleLyricsEnabled;
      Defaults.SimpleLyricsMode_RenderingType = processed;
      Defaults.SimpleLyricsMode_RenderingType_Default = processed === "animate" ? 1 : 0;
      ReloadCurrentLyrics();
    }
  );

  // --- Background ---
  group("Background");

  toggle("Hide Now Playing View Dynamic Background", Defaults.hide_npv_bg, (v) => {
    storage.set("hide_npv_bg", v.toString());
    Defaults.hide_npv_bg = v;
  });

  toggle("Use Old Background Animation", Defaults.UseOldBackgroundAnimation, (v) => {
    storage.set("useOldBackgroundAnimation", v.toString());
    Defaults.UseOldBackgroundAnimation = v;
    import("../components/DynamicBG/dynamicBackground.ts").then(({ ReapplyDynamicBackgrounds }) => {
      void ReapplyDynamicBackgrounds();
    });
  });

  toggle("Static Background", Defaults.StaticBackground_Preset, (v) => {
    storage.set("staticBackground", v.toString());
    Defaults.StaticBackground = v;
  });

  dropdown(
    "Static Background Type (Only works when Static Background is Enabled)",
    ["Auto", "Artist Header Visual", "Cover Art", "Color"],
    Defaults.StaticBackgroundType_Preset,
    (v) => {
      storage.set("staticBackgroundType", v);
      Defaults.StaticBackgroundType = v;
    }
  );

  // --- Playback & Controls ---
  group("Playback & Controls");

  toggle("Replace Spotify Playbar with NowBar", Defaults.ReplaceSpotifyPlaybar, (v) => {
    storage.set("replaceSpotifyPlaybar", v.toString());
    Defaults.ReplaceSpotifyPlaybar = v;
  });

  toggle("Cover Art Animation", Defaults.CoverArtAnimation, (v) => {
    storage.set("coverArtAnimation", v.toString());
    Defaults.CoverArtAnimation = v;
  });

  toggle("Disable Popup Lyrics", !Defaults.PopupLyricsAllowed, (v) => {
    storage.set("disablePopupLyrics", v.toString());
    Defaults.PopupLyricsAllowed = !v;
    window.location.reload();
  });

  dropdown(
    "View Controls Position",
    ["Top", "Bottom"],
    Defaults.ViewControlsPosition === "Bottom" ? 1 : 0,
    (v) => {
      storage.set("viewControlsPosition", v);
      Defaults.ViewControlsPosition = v;
    }
  );

  dropdown(
    "Always show in Fullscreen/Cinema",
    ["None", "Time", "Controls", "Both"],
    Defaults.AlwaysShowInFullscreen === "Both"
      ? 3
      : Defaults.AlwaysShowInFullscreen === "Controls"
        ? 2
        : Defaults.AlwaysShowInFullscreen === "Time"
          ? 1
          : 0,
    (v) => {
      storage.set("alwaysShowInFullscreen", v);
      Defaults.AlwaysShowInFullscreen = v;
    }
  );

  dropdown(
    "Volume Slider in Fullscreen/Cinema",
    ["Off", "Left Side", "Right Side", "Below"],
    Defaults.ShowVolumeSliderFullscreen === "Below" ? 3
      : Defaults.ShowVolumeSliderFullscreen === "Right Side" ? 2
      : Defaults.ShowVolumeSliderFullscreen === "Left Side" ? 1
      : 0,
    (v) => {
      storage.set("showVolumeSliderFullscreen", v);
      Defaults.ShowVolumeSliderFullscreen = v;
    }
  );

  dropdown(
    "Escape Key Function",
    ["Default", "Exit Fullscreen", "Exit Fully"],
    Defaults.EscapeKeyFunction === "Exit Fully"
      ? 2
      : Defaults.EscapeKeyFunction === "Exit Fullscreen"
        ? 1
        : 0,
    (v) => {
      storage.set("escapeKeyFunction", v);
      Defaults.EscapeKeyFunction = v;
    }
  );

  // --- Cache ---
  group("Cache");

  button("Clear All Cache", "Clear All Cache", async () => {
    await RemoveAllLyricsCaches(true);
  });

  button("Clear Lyrics for the current song from all caches", "Clear Current Song", async () => {
    await RemoveCurrentLyrics_AllCaches(true);
  });

  button("Clear Cached Lyrics (Lyrics Stay in Cache for 3 days)", "Clear Cached Lyrics", async () => {
    await RemoveLyricsCache(true);
  });

  button("Clear Current Song Lyrics from internal state", "Clear Current Lyrics", () => {
    RemoveCurrentLyrics_StateCache(true);
  });

  // --- Advanced ---
  group("Advanced");

  button(`Build Channel (Current: ${Defaults.BuildChannel})`, "Manage", () => {
    (window as any)._spicy_lyrics_channels?.showSwitcher?.();
  });

  button("Browse Local TTML Database", "Browse Database", () => {
    (window as any).__spicy_ttml_explore_db?.();
  });

  button("Lyrics Source Preferences", "Manage Sources", () => {
    showLyricsSourcePreferencesPanel();
  });

  toggle("Enable word sync on everything (Experimental)", Defaults.EnableExperimentalWordSync, (v) => {
    storage.set("enableExperimentalWordSync", v.toString());
    Defaults.EnableExperimentalWordSync = v;
    ReloadCurrentLyrics();
  });

  if (storage.get("developerMode") === "true") {
    toggle("Developer Mode", Defaults.DeveloperMode, (v) => {
      storage.set("developerMode", v.toString());
      Defaults.DeveloperMode = v;
    });
  }

  container.appendChild(header);
  container.appendChild(scroll);
  backdrop.appendChild(container);
  document.body.appendChild(backdrop);
}

export async function setSettingsMenu() {
  while (!Spicetify.React || !Spicetify.ReactDOM) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  const { SettingsSection } = await import("../edited_packages/spcr-settings/settingsSection.tsx");

  generalSettings(SettingsSection);
}

function generalSettings(SettingsSection: any) {
  const settings = new SettingsSection("Spicy Lyrics", "spicy-lyrics-settings");
  settings.addButton(
    "open-spicy-settings",
    "Open the Spicy Lyrics settings panel",
    "Open Settings",
    () => showSettingsPanel()
  );

  settings.pushSettings();
  attachDevModeGesture();
}
