import { useCallback, useEffect, useState } from "react";
import { LocalLyricsManager } from "../../../../utils/Lyrics/manager";
import { $currentLyricsData } from "../../../../utils/stores";
import { ApplyLyricsIfCurrent } from "../../../../utils/Lyrics/Global/Applyer";
import fetchLyrics from "../../../../utils/Lyrics/fetchLyrics";
import { SpotifyPlayer } from "../../../Global/SpotifyPlayer";

export type UseLyricsDBResult = {
  uris: string[];
  loading: boolean;
  refresh: () => Promise<void>;
  remove: (uri: string) => Promise<void>;
  put: (uri: string, ttml: string) => Promise<void>;
  getRaw: (uri: string) => Promise<string | null>;
};

export function useLyricsDB(): UseLyricsDBResult {
  const [uris, setUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const keys = await LocalLyricsManager.listKeys();
      setUris(keys);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const remove = useCallback(async (uri: string) => {
    await LocalLyricsManager.remove(uri);
    // Only refresh the on-screen lyrics if the deleted entry belongs to the
    // track that's currently playing. Otherwise we'd wipe the playing track's
    // lyrics and re-apply the (now deleted) non-playing track's lyrics.
    if (SpotifyPlayer.GetUri() === uri) {
      $currentLyricsData.set("");
      setTimeout(() => {
        if (SpotifyPlayer.GetUri() !== uri) return;
        fetchLyrics(uri)
          .then((lyrics) => ApplyLyricsIfCurrent(uri, lyrics))
          .catch((error) => {
            console.error("Spicy Lyrics: could not refresh lyrics after deleting local TTML", error);
          });
      }, 25);
    }
    await refresh();
  }, [refresh]);

  const put = useCallback(async (uri: string, ttml: string) => {
    await LocalLyricsManager.put(uri, ttml);
    await refresh();
  }, [refresh]);

  const getRaw = useCallback(async (uri: string) => {
    return LocalLyricsManager.getRaw(uri);
  }, []);

  return { uris, loading, refresh, remove, put, getRaw };
}
