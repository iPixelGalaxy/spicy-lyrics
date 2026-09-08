import parseTTMLToLyrics from "../ParseTTML";

export async function ParseTTML(ttml: string): Promise<any | null> {
  try {
    return { Result: parseTTMLToLyrics(ttml) };
  } catch (error) {
    console.error("Error parsing TTML:", error);
    return null;
  }
}
