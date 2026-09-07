import { IsPIP } from "../../../../components/Utils/PopupLyrics.ts";
import {
  closeIframeProfileModal,
  resolveProfileUsername,
  showIframeProfileModal,
} from "../../../../components/ReactComponents/IframeProfile/IframeProfileModal.tsx";

let isByCommunityAbortController: AbortController | null = null;
let madeTippys = new Set<any>();
let openingProfile = false;

export function CleanUpIsByCommunity(closeProfileModal: boolean = false) {
  openingProfile = false;
  if (closeProfileModal) {
    closeIframeProfileModal();
  }
  if (isByCommunityAbortController) {
    isByCommunityAbortController.abort();
    isByCommunityAbortController = null;
  }

  madeTippys.forEach((tippy) => {
    if (tippy && typeof tippy.destroy === "function") {
      tippy.destroy();
    }
  });
  madeTippys.clear();
}

async function openProfile(userId: string | undefined, profileElement: HTMLElement) {
  if (!userId) return;
  if (openingProfile) return;
  if (IsPIP) {
    const url = `https://spicylyrics.org/uid/${encodeURIComponent(userId)}`;
    globalThis.open?.(url, "_blank", "noopener,noreferrer");
    return;
  }

  openingProfile = true;
  profileElement.setAttribute("aria-busy", "true");
  const spinner = PageDocument.createElement("span");
  spinner.className = "sl-profile-loading";
  spinner.setAttribute("role", "status");
  spinner.setAttribute("aria-label", "Loading profile");
  profileElement.appendChild(spinner);

  const username = await resolveProfileUsername(userId);
  spinner.remove();
  profileElement.removeAttribute("aria-busy");
  openingProfile = false;

  if (isByCommunityAbortController?.signal.aborted) return;
  if (!username) {
    globalThis.open?.(`https://spicylyrics.org/uid/${encodeURIComponent(userId)}`, "_blank", "noopener,noreferrer");
    return;
  }
  openingProfile = false;
  showIframeProfileModal(userId, username, PageDocument);
}

let PageDocument: Document = document;

export function ApplyIsByCommunity(data: any, LyricsContainer: HTMLElement): void {
  if (!data.source || !LyricsContainer) return;
  if (data.source !== "spl") return;
  PageDocument = LyricsContainer.ownerDocument;

  // Clean up any previous listeners before adding new ones
  if (isByCommunityAbortController) {
    isByCommunityAbortController.abort();
  }

  if (madeTippys.size > 0) {
    madeTippys.forEach((tippy) => {
      if (tippy && typeof tippy.destroy === "function") {
        tippy.destroy();
      }
    });
    madeTippys.clear();
  }

  isByCommunityAbortController = new AbortController();
  const { signal } = isByCommunityAbortController;

  const songInfoElement = PageDocument.createElement("div");
  songInfoElement.classList.add("SongInfo");

  const makerUsername = data.TTMLUploadMetadata?.Maker?.username ?? data.TTMLUploadMetadata?.Maker?.displayName;
  const makerAvatar = data.TTMLUploadMetadata?.Maker?.avatar;
  const uploaderUsername = data.TTMLUploadMetadata?.Uploader?.username ?? data.TTMLUploadMetadata?.Uploader?.displayName;
  const uploaderAvatar = data.TTMLUploadMetadata?.Uploader?.avatar;

  // Helper for creating a profile section (Maker / Uploader) safely
  const createProfileSection = (
    type: "Maker" | "Uploader",
    labelText: string,
    username: string,
    avatarUrl?: string
  ) => {
    const wrapperSpan = PageDocument.createElement("span");
    wrapperSpan.classList.add(type);

    const innerSpan = PageDocument.createElement("span");

    const labelSpan = PageDocument.createElement("span");
    labelSpan.style.opacity = "0.5";
    labelSpan.textContent = `${labelText} `;

    const profileSectionSpan = PageDocument.createElement("span");
    profileSectionSpan.classList.add("song-info-profile-section");

    // "@username"
    const atText = PageDocument.createTextNode("@");
    profileSectionSpan.appendChild(atText);

    const usernameSpan = PageDocument.createElement("span");
    usernameSpan.textContent = username;
    profileSectionSpan.appendChild(usernameSpan);

    // Optional avatar image
    if (avatarUrl) {
      const avatarWrapper = PageDocument.createElement("span");
      const img = PageDocument.createElement("img");
      img.src = avatarUrl;
      img.alt = `${username}'s avatar`;
      img.onerror = () => {
        img.style.display = "none";
      };
      avatarWrapper.appendChild(img);
      profileSectionSpan.appendChild(avatarWrapper);
    }

    innerSpan.appendChild(labelSpan);
    innerSpan.appendChild(profileSectionSpan);
    wrapperSpan.appendChild(innerSpan);

    songInfoElement.appendChild(wrapperSpan);
    return usernameSpan;
  };

  let makerUsernameSpan: HTMLSpanElement | undefined;
  let uploaderUsernameSpan: HTMLSpanElement | undefined;
  if (makerUsername) {
    makerUsernameSpan = createProfileSection("Maker", "Made by", makerUsername, makerAvatar);
  }

  if (uploaderUsername) {
    const labelText = makerUsername ? "Uploaded by" : "Made by";
    uploaderUsernameSpan = createProfileSection("Uploader", labelText, uploaderUsername, uploaderAvatar);
  }
  LyricsContainer.appendChild(songInfoElement);

  if (!data.TTMLUploadMetadata) return;

  const updateDiscordUsername = (userId: string | undefined, element: HTMLSpanElement | undefined) => {
    if (!userId || !element) return;
    void resolveProfileUsername(userId).then((username) => {
      if (!signal.aborted && username) element.textContent = username;
    });
  };
  updateDiscordUsername(data.TTMLUploadMetadata?.Maker?.id, makerUsernameSpan);
  updateDiscordUsername(data.TTMLUploadMetadata?.Uploader?.id, uploaderUsernameSpan);

  const uploaderSpan = songInfoElement.querySelector(".Uploader .song-info-profile-section");
  if (uploaderSpan) {
    if (!IsPIP) {
      madeTippys.add(
        Spicetify.Tippy(uploaderSpan, {
          ...Spicetify.TippyProps,
          ...(uploaderSpan.ownerDocument === document
            ? {}
            : { appendTo: () => uploaderSpan.ownerDocument.body }),
          content: `View TTML Profile`,
        })
      )
    }
    uploaderSpan.addEventListener(
      "click",
      () => {
        void openProfile(data.TTMLUploadMetadata?.Uploader?.id, uploaderSpan);
        if (IsPIP) {
          globalThis.focus();
        }
      },
      { signal }
    );
  }

  const makerSpan = songInfoElement.querySelector(".Maker .song-info-profile-section");
  if (makerSpan) {
    if (!IsPIP) {
      madeTippys.add(
        Spicetify.Tippy(makerSpan, {
          ...Spicetify.TippyProps,
          ...(makerSpan.ownerDocument === document
            ? {}
            : { appendTo: () => makerSpan.ownerDocument.body }),
          content: `View TTML Profile`,
        })
      )
    }
    makerSpan.addEventListener(
      "click",
      () => {
        void openProfile(data.TTMLUploadMetadata?.Maker?.id, makerSpan);
        if (IsPIP) {
          globalThis.focus();
        }
      },
      { signal }
    );
  }
}
