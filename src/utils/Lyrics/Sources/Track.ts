import { SpotifyPlayer } from "../../../components/Global/SpotifyPlayer.ts";
import type { TrackLyricsInfo } from "./Types.ts";

function buildTrackLyricsInfo(
  uri: string,
  id: string,
  title: string,
  artist: string,
  album: string,
  durationMs: number
): TrackLyricsInfo | null {
  if (!id || !title || !artist || durationMs <= 0) {
    return null;
  }

  return {
    uri,
    id,
    durationMs,
    title,
    artist,
    album,
  };
}

export async function getTrackLyricsInfo(uri: string): Promise<TrackLyricsInfo | null> {
  const id = uri.split(":")[2] ?? "";
  if (!id) return null;

  if (!Spicetify.URI.isTrack(uri) && !uri.startsWith("spotify:local:")) {
    return null;
  }

  const currentUri = SpotifyPlayer.GetUri() ?? "";
  const currentId = SpotifyPlayer.GetId() ?? "";
  if (uri !== currentUri && id !== currentId) return null;

  const title = SpotifyPlayer.GetName() ?? "";
  const artist =
    SpotifyPlayer.GetArtists()
      ?.map((entry) => entry.name)
      .filter(Boolean)
      .join(", ") ?? "";
  const album = SpotifyPlayer.GetAlbumName() ?? "";
  const durationMs = SpotifyPlayer.GetDuration();

  return buildTrackLyricsInfo(uri, id, title, artist, album, durationMs);
}
