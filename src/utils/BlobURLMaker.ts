const BlobURLCache = new Map<string, { blobUrl: string; expiresAt: number }>();
const pendingBlobURLs = new Map<string, Promise<string | null>>();

export default async function BlobURLMaker(url: string): Promise<string | null> {
  if (!url) throw new Error("SpicyLyrics: BlobURLMaker: url Missing");
  const normalizedUrl = url.startsWith("spotify:image:")
    ? `https://i.scdn.co/image/${url.replace("spotify:image:", "")}`
    : url;

  if (normalizedUrl.startsWith("spotify:")) {
    return null;
  }

  const existingBlobURL = BlobURLCache.get(normalizedUrl);
  if (existingBlobURL) {
    if (existingBlobURL.expiresAt > Date.now()) return existingBlobURL.blobUrl;
    // Existing artwork may still reference this URL; only expire the lookup.
    BlobURLCache.delete(normalizedUrl);
  }

  const pending = pendingBlobURLs.get(normalizedUrl);
  if (pending) return pending;

  const request = fetchBlobURL(normalizedUrl).finally(() => {
    pendingBlobURLs.delete(normalizedUrl);
  });
  pendingBlobURLs.set(normalizedUrl, request);
  return request;
}

async function fetchBlobURL(normalizedUrl: string): Promise<string | null> {
  try {
    const response = await fetch(normalizedUrl);
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const expiresAt = Date.now() + 1000 * 60 * 60;
    BlobURLCache.set(normalizedUrl, {
      blobUrl,
      expiresAt,
    });
    return blobUrl;
  } catch (error) {
    console.error("Error fetching and converting to blob URL:", error);
    throw error;
  }
}
