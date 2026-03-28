const FONT_LINK_ID = "spicy-lyrics-custom-font-url";

/**
 * Parses font family names from a Google Fonts URL.
 * Supports both css2 (?family=Name&family=Other+Name)
 * and legacy css (?family=Name|Other+Name) formats.
 *
 * Returns an array like ["Aldrich", "Press Start 2P"]
 */
export function parseFontNamesFromURL(url: string): string[] {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return [];
  }

  const names: string[] = [];

  // css2 format: multiple &family= params
  const families = parsed.searchParams.getAll("family");
  for (const f of families) {
    // strip axis tags like ":wght@400;700"
    const name = f.split(":")[0].replace(/\+/g, " ").trim();
    if (name) names.push(name);
  }

  // legacy format: family=Name|Other+Name
  if (names.length === 0) {
    const raw = parsed.searchParams.get("family");
    if (raw) {
      for (const f of raw.split("|")) {
        const name = f.split(":")[0].replace(/\+/g, " ").trim();
        if (name) names.push(name);
      }
    }
  }

  return names;
}

/**
 * Injects a <link> tag for the given font URL.
 * Removes any previously injected link first.
 */
export function injectFontURL(url: string): void {
  removeFontURL();
  if (!url) return;

  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = url;
  document.head.appendChild(link);
}

/**
 * Removes the injected font <link> tag if present.
 */
export function removeFontURL(): void {
  document.getElementById(FONT_LINK_ID)?.remove();
}

/**
 * Applies parsed font names from a URL as the CSS custom property.
 * Falls back to the manually entered font name if URL is empty.
 */
export function applyFontFromURL(url: string, fallbackFont: string): void {
  if (url) {
    const names = parseFontNamesFromURL(url);
    if (names.length > 0) {
      // Use the first parsed font as the active font
      document.documentElement.style.setProperty(
        "--spicy-custom-font",
        names.map((n) => `"${n}"`).join(", ")
      );
      return;
    }
  }
  // Fall back to manual font name
  if (fallbackFont) {
    document.documentElement.style.setProperty("--spicy-custom-font", fallbackFont);
  } else {
    document.documentElement.style.removeProperty("--spicy-custom-font");
  }
}
