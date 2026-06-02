// deno-lint-ignore-file no-explicit-any
import GetProgress, {
  _DEPRECATED___GetProgress,
} from "../../utils/Gets/GetProgress.ts";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
//type ArtworkSize = "s" | "l" | "xl" | "d";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
//const TrackData_Map = new Map();

/* const old_SpotifyPlayer = {
    IsPlaying: false,
    GetTrackPosition: GetProgress,
    GetTrackDuration: (): number => {
        if (Spicetify.Player.data.item.duration?.milliseconds) {
            return Spicetify.Player.data.item.duration.milliseconds;
        }
        return 0;
    },
    Track: {
        GetTrackInfo: async () => {
            const spotifyHexString = SpicyHasher.spotifyHex(SpotifyPlayer.GetSongId());
            if (TrackData_Map.has(spotifyHexString)) return TrackData_Map.get(spotifyHexString);
            const URL = `https://spclient.wg.spotify.com/metadata/4/track/${spotifyHexString}?market=from_token`;
            const [data, status] = await (URL, true, true, false);
            if (status !== 200) return null;
            const parsedData = ((data.startsWith(`{"`) || data.startsWith("{"))
                                    ? JSON.parse(data)
                                    : data);
            TrackData_Map.set(spotifyHexString, parsedData);
            return parsedData;
        },
        SortImages: (images: any[]) => {
            // Define size thresholds
            const sizeMap = {
                s: "SMALL",
                l: "DEFAULT",
                xl: "LARGE"
            };

            // Sort the images into categories based on their size
            const sortedImages = images.reduce((acc, image) => {
                const { size } = image;

                if (size === sizeMap.s) {
                    acc.s.push(image);
                } else if (size === sizeMap.l) {
                    acc.l.push(image);
                } else if (size === sizeMap.xl) {
                    acc.xl.push(image);
                }

                return acc;
            }, { s: [], l: [], xl: [] });


            return sortedImages;
        }
    },
    Seek: (position: number) => {
        Spicetify.Player.origin.seekTo(position);
    },
    Artwork: {
        Get: async (size: ArtworkSize): Promise<string> => {
            const psize = (size === "d" ? null : (size?.toLowerCase() ?? null));
            const Data = await SpotifyPlayer.Track.GetTrackInfo();
            const Images = SpotifyPlayer.Track.SortImages(Data.album.cover_group.image);
            switch (psize) {
                case "s":
                    return `spotify:image:${Images.s[0].file_id}`;
                case "l":
                    return `spotify:image:${Images.l[0].file_id}`;
                case "xl":
                    return `spotify:image:${Images.xl[0].file_id}`;
                default:
                    return `spotify:image:${Images.l[0].file_id}`;
            }
        }
    },
    GetSongName: async (): Promise<string> => {
        const Data = await SpotifyPlayer.Track.GetTrackInfo();
        return Data.name;
    },
    GetAlbumName: (): string => {
        return Spicetify.Player.data.item.metadata.album_title;
    },
    GetSongId: (): string => {
        return Spicetify.Player.data.item.uri?.split(":")[2] ?? null;
    },
    GetArtists: async (): Promise<string[]> => {
        const data = await SpotifyPlayer.Track.GetTrackInfo();
        return data?.artist?.map(a => a.name) ?? [];
    },
    JoinArtists: (artists: string[]): string => {
        return artists?.join(", ") ?? null;
    },
    IsPodcast: false,
    _DEPRECATED_: {
        GetTrackPosition: _DEPRECATED___GetProgress
    },
    Pause: Spicetify.Player.pause,
    Play: Spicetify.Player.play,
    TogglePlayState: Spicetify.Player.togglePlay,
    Skip: {
        Next: Spicetify.Player.next,
        Prev: Spicetify.Player.back
    },
    LoopType: "none",
    ShuffleType: "none",
} */

const GetContentType = (): string => {
  if (Spicetify?.Player?.data?.item?.type) {
    return Spicetify.Player.data.item.type;
  }
  return "unknown";
};

const LOCAL_FLAC_METADATA_KEYS = [
  "file_format",
  "format",
  "codec",
  "container",
  "mime_type",
  "media_format",
  "extension",
  "filename",
  "local_file_path",
  "path",
  "url",
  "entity_uri",
  "media.type",
  "audio.format",
] as const;

const hasFlacSignature = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "flac" ||
    normalized === "audio/flac" ||
    normalized.endsWith(".flac")
  );
};

const LOCAL_COVER_METADATA_KEYS = [
  "image_url",
  "image_large_url",
  "image_xlarge_url",
  "imageUrl",
  "album_image_url",
  "albumImageUrl",
  "cover_url",
  "coverUrl",
  "artwork_url",
  "artworkUrl",
  "album_art_url",
  "albumArtUrl",
  "cover",
  "image",
] as const;

const normalizeCoverUrl = (value: unknown): string | undefined => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const trimmed = value.trim();
  if (trimmed.startsWith("spotify:image:")) {
    return trimmed.replace("spotify:image:", "https://i.scdn.co/image/");
  }
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  return undefined;
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const createLocalTrackFallbackCover = (): string => {
  const metadata = SpotifyPlayer.GetTrackMetadata();
  const seed = [
    SpotifyPlayer.GetName(),
    metadata.artist_name,
    metadata.album_title,
    SpotifyPlayer.GetUri(),
  ].filter(Boolean).join(" ");
  const hash = hashString(seed || "Spicy Lyrics Local Track");
  const hueA = hash % 360;
  const hueB = (hueA + 52 + (hash % 40)) % 360;
  const hueC = (hueA + 185 + (hash % 50)) % 360;
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 640;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "https://images.spikerko.org/SongPlaceholderFull.png";

  const base = ctx.createRadialGradient(190, 150, 20, 260, 250, 590);
  base.addColorStop(0, `hsl(${hueB}, 78%, 62%)`);
  base.addColorStop(0.54, `hsl(${hueA}, 64%, 36%)`);
  base.addColorStop(1, `hsl(${hueC}, 72%, 18%)`);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 640, 640);

  const glow = ctx.createRadialGradient(486, 158, 18, 486, 158, 176);
  glow.addColorStop(0, "rgba(255,255,255,0.3)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(486, 158, 176, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `hsla(${hueB}, 76%, 54%, 0.35)`;
  ctx.beginPath();
  ctx.arc(132, 512, 224, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `hsla(${hueC}, 78%, 28%, 0.5)`;
  ctx.beginPath();
  ctx.moveTo(0, 523);
  ctx.bezierCurveTo(49, 506, 106, 476, 172, 432);
  ctx.bezierCurveTo(264, 282, 377, 216, 510, 234);
  ctx.bezierCurveTo(544, 239, 572, 251, 596, 268);
  ctx.lineTo(640, 640);
  ctx.lineTo(0, 640);
  ctx.closePath();
  ctx.fill();

  return canvas.toDataURL("image/png");
};

const findCoverCandidate = (value: unknown, depth = 0): string | undefined => {
  if (!value || depth > 4) return undefined;
  const direct = normalizeCoverUrl(value);
  if (direct) return direct;

  if (Array.isArray(value)) {
    for (const item of value) {
      const cover = findCoverCandidate(item, depth + 1);
      if (cover) return cover;
    }
    return undefined;
  }

  if (typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of [
    "url",
    "uri",
    "image_url",
    "image_large_url",
    "image_xlarge_url",
    "cover_url",
    "artwork_url",
  ]) {
    const cover = normalizeCoverUrl(record[key]);
    if (cover) return cover;
  }
  for (const key of ["images", "image", "cover", "artwork", "album", "metadata"]) {
    const cover = findCoverCandidate(record[key], depth + 1);
    if (cover) return cover;
  }
  return undefined;
};

export type CoverSizes = "standard" | "small" | "large" | "xlarge";
export type Artist = {
  type: "artist";
  name: string;
  uri: string;
};

export const SpotifyPlayer = {
  IsPlaying: false,
  _DEPRECATED_: {
    GetTrackPosition: _DEPRECATED___GetProgress,
  },
  GetPosition: GetProgress,
  GetContentType: GetContentType,
  GetMediaType: (): string => {
    return Spicetify?.Player?.data?.item?.mediaType;
  },
  GetTrackMetadata: (): Record<string, unknown> => {
    return (Spicetify?.Player?.data?.item?.metadata ?? {}) as Record<
      string,
      unknown
    >;
  },
  IsLocalTrack: (): boolean => {
    const item = Spicetify?.Player?.data?.item;
    if (!item) return false;
    return Boolean(item.isLocal) || item.uri?.startsWith("spotify:local:");
  },
  IsLocalFlacTrack: (): boolean => {
    const item = Spicetify?.Player?.data?.item;
    if (!item || !SpotifyPlayer.IsLocalTrack()) return false;

    const metadata = SpotifyPlayer.GetTrackMetadata();
    for (const key of LOCAL_FLAC_METADATA_KEYS) {
      if (hasFlacSignature(metadata[key])) {
        return true;
      }
    }

    return [item.name, metadata.title].some((value) => hasFlacSignature(value));
  },
  GetDuration: (): number => {
    if (Spicetify?.Player?.data?.item?.duration?.milliseconds) {
      return Spicetify.Player.data.item.duration.milliseconds;
    }
    return 0;
  },
  Seek: (position: number): void => {
    (Spicetify?.Player as any)?.origin?.seekTo(position);
  },
  GetCover: (size: CoverSizes): string | undefined => {
    const item = Spicetify?.Player?.data?.item;
    if (!item) return "https://images.spikerko.org/SongPlaceholderFull.png";
    // @ts-ignore aaa
    const covers = item.images ?? item.show?.images;
    if (covers?.length > 0) {
      const requested = size.toLowerCase();
      const cover =
        covers.find((candidate: any) => candidate.label?.toLowerCase?.() === requested) ??
        covers.find((candidate: any) => candidate.label?.toLowerCase?.() === "large") ??
        covers.find((candidate: any) => candidate.label?.toLowerCase?.() === "default") ??
        covers[0];
      const coverUrl = findCoverCandidate(cover);
      if (coverUrl) return coverUrl;
    }
    const metadata = SpotifyPlayer.GetTrackMetadata();
    for (const key of LOCAL_COVER_METADATA_KEYS) {
      const cover = normalizeCoverUrl(metadata[key]);
      if (cover) return cover;
    }
    const nestedCover = findCoverCandidate(item);
    if (nestedCover) return nestedCover;
    if (SpotifyPlayer.IsLocalTrack()) {
      return createLocalTrackFallbackCover();
    }
    return "https://images.spikerko.org/SongPlaceholderFull.png";
  },
  GetCoverFrom: (
    size: CoverSizes,
    source: Array<{ url: string; label: string }> | Spicetify.ImagesEntity[]
  ): string | undefined => {
    if (source) {
      if (source.length > 0) {
        const cover = source?.find((cover) => cover.label === size);
        return (
          cover?.url ?? "https://images.spikerko.org/SongPlaceholderFull.png"
        );
      }
    }
    return "https://images.spikerko.org/SongPlaceholderFull.png";
  },
  GetName: (): string | undefined => {
    return Spicetify?.Player?.data?.item?.name;
  },
  GetShowName: (): string | undefined => {
    // @ts-ignore aaa
    return Spicetify?.Player?.data?.item?.show?.name;
  },
  GetAlbumName: (): string | undefined => {
    return Spicetify?.Player?.data?.item?.metadata?.album_title;
  },
  GetAlbumUri: (): string | undefined => {
    return Spicetify?.Player?.data?.item?.metadata?.album_uri;
  },
  GetAlbumReleaseYearSync: (): string | undefined => {
    const item: any = Spicetify?.Player?.data?.item;
    if (!item) return undefined;

    const metadata: any = item?.metadata;
    const yearCandidate =
      metadata?.album_year ??
      metadata?.albumYear ??
      metadata?.album_release_year ??
      metadata?.albumReleaseYear ??
      metadata?.release_year ??
      metadata?.releaseYear ??
      metadata?.year;
    if (typeof yearCandidate === "string" && /^\d{4}$/.test(yearCandidate)) {
      return yearCandidate;
    }

    const dateCandidate =
      item?.album?.release_date ??
      metadata?.album_date ??
      metadata?.albumDate ??
      metadata?.album_release_date ??
      metadata?.albumReleaseDate ??
      metadata?.release_date ??
      metadata?.releaseDate;

    if (typeof dateCandidate !== "string") return undefined;
    const year = dateCandidate.slice(0, 4);
    return /^\d{4}$/.test(year) ? year : undefined;
  },
  GetAlbumReleaseYear: async (albumUri?: string): Promise<string | undefined> => {
    try {
      const resolvedAlbumUri = albumUri ?? SpotifyPlayer.GetAlbumUri();
      if (!resolvedAlbumUri) return undefined;
      const result = await (Spicetify as any).GraphQL.Request(
        (Spicetify as any).GraphQL.Definitions.getAlbum,
        { uri: resolvedAlbumUri, locale: "", offset: 0, limit: 1 }
      );
      const isoString: string | undefined = result?.data?.albumUnion?.date?.isoString;
      if (!isoString) return undefined;
      const year = isoString.slice(0, 4);
      return /^\d{4}$/.test(year) ? year : undefined;
    } catch {
      return undefined;
    }
  },
  GetId: (): string | undefined => {
    return Spicetify?.Player?.data?.item?.uri?.split(":")[2];
  },
  GetReleaseYear: async (trackId: string): Promise<string | undefined> => {
    try {
      const resp = await (Spicetify as any).CosmosAsync.get(
        `https://api.spotify.com/v1/tracks/${trackId}`
      );
      const releaseDate: string | undefined = resp?.album?.release_date;
      const year = releaseDate ? releaseDate.slice(0, 4) : undefined;
      return year && /^\d{4}$/.test(year) ? year : undefined;
    } catch {
      return undefined;
    }
  },
  GetArtists: (): Artist[] | undefined => {
    return Spicetify?.Player?.data?.item?.artists as Artist[];
  },
  GetUri: (): string | undefined => {
    return (
      // @ts-ignore aaa
      Spicetify?.Player?.data?.item?.uri ?? Spicetify?.Player?.data?.track?.uri
    );
  },
  Pause: Spicetify?.Player?.pause,
  Play: Spicetify?.Player?.play,
  TogglePlayState: Spicetify?.Player?.togglePlay,
  Skip: {
    Next: Spicetify?.Player?.next,
    Prev: Spicetify?.Player?.back,
  },
  LoopType: "none",
  ShuffleType: "none",
  IsDJ: (): boolean => {
    const data = Spicetify?.Player?.data;
    if (!data) return false;
    return (
      data.item?.provider?.startsWith("narration") ||
      (data.restrictions?.disallowSeekingReasons?.length >
        0 &&
        data.restrictions?.disallowSeekingReasons[0]?.includes(
          "narration"
        )) ||
      data.item?.type === "unknown"
    );
  },
  IsLiked: () => Spicetify?.Player?.getHeart(),
  ToggleLike: async () => {
    const uris = [SpotifyPlayer.GetUri()];
    if (SpotifyPlayer.IsLiked()) {
      await Spicetify.Platform.LibraryAPI.remove({ uris });
    } else {
      await Spicetify.Platform.LibraryAPI.add({ uris });
    }
  },
  Playbar: (() => {
    let rightContainer: HTMLElement | null;
    let sibling: HTMLElement | null;
    const buttonsStash = new Set<HTMLElement>();

    type ButtonOnClick = (btn: Button) => void;

    class Button {
      public element: HTMLButtonElement;
      public iconElement: HTMLSpanElement;
      private _label: string;
      private _icon: string;
      private _onClick: ButtonOnClick;
      private _disabled: boolean;
      private _active: boolean;
      public tippy: any;

      constructor(
        label: string,
        icon: string,
        onClick: ButtonOnClick = () => {},
        disabled: boolean = false,
        active: boolean = false,
        registerOnCreate: boolean = true
      ) {
        this.element = document.createElement("button");
        this.element.classList.add("main-genericButton-button");
        this.iconElement = document.createElement("span");
        this.iconElement.classList.add("Wrapper-sm-only", "Wrapper-small-only");
        this.element.appendChild(this.iconElement);
        this.icon = icon;
        this.onClick = onClick;
        this.disabled = disabled;
        this.active = active;
        addClassname(this.element);
        this.tippy = (Spicetify as any).Tippy?.(this.element, {
          content: label,
          ...(Spicetify as any).TippyProps,
        });
        this.label = label;
        if (registerOnCreate) this.register();
      }
      get label(): string {
        return this._label;
      }
      set label(text: string) {
        this._label = text;
        if (!this.tippy) this.element.setAttribute("title", text);
        else this.tippy.setContent(text);
      }
      get icon(): string {
        return this._icon;
      }
      set icon(input: string) {
        let newInput = input;
        if (
          newInput &&
          (Spicetify as any).SVGIcons &&
          (Spicetify as any).SVGIcons[newInput]
        ) {
          newInput = `<svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor" stroke="currentColor">${
            (Spicetify as any).SVGIcons[newInput]
          }</svg>`;
        }
        this._icon = newInput;
        this.iconElement.innerHTML = newInput;
      }
      get onClick(): ButtonOnClick {
        return this._onClick;
      }
      set onClick(func: ButtonOnClick) {
        this._onClick = func;
        this.element.onclick = () => this._onClick(this);
      }
      get disabled(): boolean {
        return this._disabled;
      }
      set disabled(bool: boolean) {
        this._disabled = bool;
        this.element.disabled = bool;
        this.element.classList.toggle("disabled", bool);
      }
      set active(bool: boolean) {
        this._active = bool;
        this.element.classList.toggle("main-genericButton-buttonActive", bool);
        this.element.classList.toggle(
          "main-genericButton-buttonActiveDot",
          bool
        );
      }
      get active(): boolean {
        return this._active;
      }
      register() {
        buttonsStash.add(this.element);
        rightContainer?.prepend(this.element);
      }
      deregister() {
        buttonsStash.delete(this.element);
        this.element.remove();
      }
    }

    (function waitForPlaybarMounted() {
      rightContainer =
        document.querySelector<HTMLElement>(
          ".main-nowPlayingBar-right > div"
        ) ??
        document.querySelector<HTMLElement>(
          ".main-nowPlayingBar-extraControls"
        );
      if (!rightContainer) {
        setTimeout(waitForPlaybarMounted, 300);
        return;
      }
      for (const button of buttonsStash) {
        addClassname(button);
      }
      rightContainer.prepend(...Array.from(buttonsStash));
    })();

    function addClassname(element: HTMLElement) {
      sibling =
        document.querySelector<HTMLElement>(
          ".main-nowPlayingBar-right .main-genericButton-button"
        ) ??
        document.querySelector<HTMLElement>(
          ".main-nowPlayingBar-extraControls .main-genericButton-button"
        );
      if (!sibling) {
        setTimeout(addClassname, 300, element);
        return;
      }
      for (const className of Array.from(sibling.classList)) {
        if (!className.startsWith("main-genericButton"))
          element.classList.add(className);
      }
    }

    const widgetStash = new Set<HTMLElement>();
    let nowPlayingWidget: HTMLElement | null;

    type WidgetOnClick = (widget: Widget) => void;

    class Widget {
      public element: HTMLButtonElement;
      private _label: string;
      private _icon: string;
      private _onClick: WidgetOnClick;
      private _disabled: boolean;
      private _active: boolean;
      public tippy: any;

      constructor(
        label: string,
        icon: string,
        onClick: WidgetOnClick = () => {},
        disabled: boolean = false,
        active: boolean = false,
        registerOnCreate: boolean = true
      ) {
        this.element = document.createElement("button");
        this.element.className =
          "main-addButton-button control-button control-button-heart";
        this.icon = icon;
        this.onClick = onClick;
        this.disabled = disabled;
        this.active = active;
        this.tippy = (Spicetify as any).Tippy?.(this.element, {
          content: label,
          ...(Spicetify as any).TippyProps,
        });
        this.label = label;
        if (registerOnCreate) this.register();
      }
      get label(): string {
        return this._label;
      }
      set label(text: string) {
        this._label = text;
        if (!this.tippy) this.element.setAttribute("title", text);
        else this.tippy.setContent(text);
      }
      get icon(): string {
        return this._icon;
      }
      set icon(input: string) {
        let newInput = input;
        if (
          newInput &&
          (Spicetify as any).SVGIcons &&
          (Spicetify as any).SVGIcons[newInput]
        ) {
          newInput = `<svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">${
            (Spicetify as any).SVGIcons[newInput]
          }</svg>`;
        }
        this._icon = newInput;
        this.element.innerHTML = newInput;
      }
      get onClick(): WidgetOnClick {
        return this._onClick;
      }
      set onClick(func: WidgetOnClick) {
        this._onClick = func;
        this.element.onclick = () => this._onClick(this);
      }
      get disabled(): boolean {
        return this._disabled;
      }
      set disabled(bool: boolean) {
        this._disabled = bool;
        this.element.disabled = bool;
        this.element.classList.toggle("main-addButton-disabled", bool);
        (this.element as any).ariaDisabled = bool;
      }
      set active(bool: boolean) {
        this._active = bool;
        this.element.classList.toggle("main-addButton-active", bool);
        (this.element as any).ariaChecked = bool;
      }
      get active(): boolean {
        return this._active;
      }
      register() {
        widgetStash.add(this.element);
        nowPlayingWidget?.append(this.element);
      }
      deregister() {
        widgetStash.delete(this.element);
        this.element.remove();
      }
    }

    function waitForWidgetMounted() {
      nowPlayingWidget = document.querySelector<HTMLElement>(
        ".main-nowPlayingWidget-nowPlaying"
      );
      if (!nowPlayingWidget) {
        setTimeout(waitForWidgetMounted, 300);
        return;
      }
      nowPlayingWidget.append(...Array.from(widgetStash));
    }

    (function attachObserver() {
      const leftPlayer =
        document.querySelector<HTMLElement>(".main-nowPlayingBar-left") ??
        document.querySelector<HTMLElement>(".qqAX5M23YurntqVJ_8Dt") ??
        document.querySelector<HTMLElement>(".main-nowPlayingWidget-actionButtonWrapper") ??
        document.querySelector<HTMLElement>(
          ".main-nowPlayingWidget-nowPlaying > div:last-of-type"
        );
      if (!leftPlayer) {
        setTimeout(attachObserver, 300);
        return;
      }
      waitForWidgetMounted();
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.removedNodes.length > 0) {
            nowPlayingWidget = null;
            waitForWidgetMounted();
          }
        }
      });
      observer.observe(leftPlayer, { childList: true });
    })();

    return { Button, Widget };
  })(),
};
