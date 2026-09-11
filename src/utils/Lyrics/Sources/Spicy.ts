import Platform from "../../../components/Global/Platform.ts";
import { Query } from "../../API/Query.ts";
import { SLObjPack } from "../../objpack.ts";
import { resolveLyricsSourceLabel } from "../LyricsSourcePreferences.ts";
import { tryGetSongWriters } from "./Shared.ts";
import type { ExternalLyricsResult } from "./Types.ts";

const spicyLyricsPacker = new SLObjPack();

export async function fetchSpicyLyricsRaw(trackId: string): Promise<ExternalLyricsResult | null> {
  try {
    const queryLyrics = async (token: string) => {
      const queries = await Query(
        [
          {
            operation: "lyrics",
            variables: {
              id: trackId,
              auth: "SpicyLyrics-WebAuth",
            },
          },
        ],
        {
          "SpicyLyrics-WebAuth": `Bearer ${token}`,
        },
        // This user-initiated fetch is the breaker's health probe while the API
        // is paused. Query still limits it to one probe at a time.
        { probe: true }
      );
      return queries.get("0");
    };

    const token = await Platform.GetSpotifyAccessToken();
    let lyricsQuery = await queryLyrics(token);

    // A token can be rejected before Spotify updates its local authorization
    // state. Retire it and retry once with a fresh token.
    if (lyricsQuery?.httpStatus === 401) {
      Platform.InvalidateSpotifyAccessToken(token);
      const retryToken = await Platform.GetSpotifyAccessToken();
      if (retryToken !== token) lyricsQuery = await queryLyrics(retryToken);
    }

    if (!lyricsQuery || lyricsQuery.httpStatus !== 200) {
      return null;
    }

    const lyrics = Array.isArray(lyricsQuery.data)
      ? spicyLyricsPacker.unpack(lyricsQuery.data)
      : lyricsQuery.data;
    if (!lyrics) {
      return null;
    }

    return {
      lyrics: {
        ...(lyrics as Record<string, any>),
        fetchProvider: "spicy",
        sourceDisplayName: resolveLyricsSourceLabel(
          (lyrics as Record<string, any>).source,
          (lyrics as Record<string, any>).sourceDisplayName,
          "spicy"
        ),
      },
      status: 200,
    };
  } catch (error) {
    console.error("Failed to fetch lyrics from Spicy Lyrics provider:", error);
    return null;
  }
}

export async function fetchSpicyLyrics(
  rawPromise: Promise<ExternalLyricsResult | null>
): Promise<ExternalLyricsResult | null> {
  const raw = await rawPromise;
  if (!raw) return null;
  // Community-only: source must be "spl"
  if (raw.lyrics?.source !== "spl") return null;
  return raw;
}

export async function fetchAppleMusicLyrics(
  rawPromise: Promise<ExternalLyricsResult | null>
): Promise<ExternalLyricsResult | null> {
  const raw = await rawPromise;
  if (!raw) return null;
  // Apple Music only: source must be "aml"
  if (raw.lyrics?.source !== "aml") return null;
  return raw;
}

export async function fetchSpicySongWriters(
  rawPromise: Promise<ExternalLyricsResult | null>
): Promise<string[] | null> {
  const spicyResult = await rawPromise;
  return tryGetSongWriters(spicyResult?.lyrics);
}
