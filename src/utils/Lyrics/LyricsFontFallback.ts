import { GLYPH_PROBE_FONT } from "../../components/Styling/GlyphProbeFont.ts";
import { toCssFontFamily } from "../cssFontFamily.ts";

const PROBE_FAMILY = "SpicyLyricsGlyphProbe";
const probes = new WeakMap<Document, Promise<CanvasRenderingContext2D | null>>();

function getGlyphProbe(targetDocument: Document): Promise<CanvasRenderingContext2D | null> {
  const existing = probes.get(targetDocument);
  if (existing) return existing;

  const probe = (async () => {
    if (typeof FontFace === "undefined" || !targetDocument.fonts) return null;
    try {
      const font = new FontFace(PROBE_FAMILY, `url("${GLYPH_PROBE_FONT}")`);
      await font.load();
      targetDocument.fonts.add(font);
      const context = targetDocument.createElement("canvas").getContext("2d");
      if (!context) return null;
      context.font = `700 48px ${PROBE_FAMILY}`;
      if (context.measureText("A中ا𐐀").width !== 0) {
        targetDocument.fonts.delete(font);
        return null;
      }
      return context;
    } catch {
      return null;
    }
  })();
  probes.set(targetDocument, probe);
  return probe;
}

export async function needsDefaultLyricsFont(
  fontFamily: string,
  text: string,
  targetDocument: Document
): Promise<boolean> {
  const family = toCssFontFamily(fontFamily);
  if (!family) return false;

  const characters = new Map<string, number>();
  let total = 0;
  for (const character of text.normalize("NFC")) {
    if (/[\p{White_Space}\p{Control}\p{Format}\p{Mark}]/u.test(character)) continue;
    characters.set(character, (characters.get(character) ?? 0) + 1);
    total++;
  }
  if (total === 0) return false;

  const context = await getGlyphProbe(targetDocument);
  if (!context) return false;
  const font = `700 48px ${family}`;
  try {
    await targetDocument.fonts.load(font, [...characters.keys()].join(""));
  } catch {
    // An unavailable face falls through to the blank probe, just like missing glyphs.
  }

  context.font = `700 48px ${PROBE_FAMILY}`;
  context.font = `${font}, ${PROBE_FAMILY}`;
  let unsupported = 0;
  for (const [character, count] of characters) {
    if (context.measureText(character).width === 0) unsupported += count;
    if (unsupported > total / 2) return true;
  }
  return false;
}
