import parseTTMLToLyrics from "../ParseTTML";
import { isLyricsfile, parseLyricsfileToLyrics } from "../ParseLyricsfile";

export async function ParseTTML(content: string): Promise<any | null> {
  try {
    if (isLyricsfile(content)) {
      return { Result: parseLyricsfileToLyrics(content) };
    }
    return { Result: parseTTMLToLyrics(content) };
  } catch (error) {
    try {
      // Fallback: try lyricsfile parser if TTML failed
      return { Result: parseLyricsfileToLyrics(content) };
    } catch {
      console.error("Error parsing lyrics content (TTML / Lyricsfile):", error);
      return null;
    }
  }
}

