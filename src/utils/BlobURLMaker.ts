const BlobURLCache = new Map<string, string>();
const MAX_ENTRIES = 32;
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
    BlobURLCache.delete(normalizedUrl);
    BlobURLCache.set(normalizedUrl, existingBlobURL);
    return existingBlobURL;
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

    BlobURLCache.set(normalizedUrl, blobUrl);
    if (BlobURLCache.size > MAX_ENTRIES) {
      const [oldestUrl, oldestBlobUrl] = BlobURLCache.entries().next().value!;
      BlobURLCache.delete(oldestUrl);
      URL.revokeObjectURL(oldestBlobUrl);
    }
    return blobUrl;
  } catch (error) {
    console.error("Error fetching and converting to blob URL:", error);
    throw error;
  }
}
