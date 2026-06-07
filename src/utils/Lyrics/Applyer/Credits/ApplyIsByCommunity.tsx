import { IsPIP } from "../../../../components/Utils/PopupLyrics.ts";
import {
  closeIframeProfileModal,
  showIframeProfileModal,
} from "../../../../components/ReactComponents/IframeProfile/IframeProfileModal.tsx";

let isByCommunityAbortController: AbortController | null = null;
let madeTippys = new Set<any>();

export function CleanUpIsByCommunity(closeProfileModal: boolean = false) {
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

function openProfile(userId: string | undefined) {
  if (!userId) return;
  if (!IsPIP) {
    showIframeProfileModal(userId, PageDocument);
    return;
  }
  const url = `https://spicylyrics.org/uid/${encodeURIComponent(userId)}`;
  globalThis.open?.(url, "_blank", "noopener,noreferrer");
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

  const makerUsername = data.TTMLUploadMetadata?.Maker?.username;
  const makerAvatar = data.TTMLUploadMetadata?.Maker?.avatar;
  const uploaderUsername = data.TTMLUploadMetadata?.Uploader?.username;
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
  };

  if (makerUsername) {
    createProfileSection("Maker", "Made by", makerUsername, makerAvatar);
  }

  if (uploaderUsername) {
    const labelText = makerUsername ? "Uploaded by" : "Made by";
    createProfileSection("Uploader", labelText, uploaderUsername, uploaderAvatar);
  }
  LyricsContainer.appendChild(songInfoElement);

  if (!data.TTMLUploadMetadata) return;

  const uploaderSpan = songInfoElement.querySelector(".Uploader .song-info-profile-section");
  if (uploaderSpan) {
    if (!IsPIP) {
      madeTippys.add(
        Spicetify.Tippy(uploaderSpan, {
          ...Spicetify.TippyProps,
          content: `View TTML Profile`,
        })
      )
    }
    uploaderSpan.addEventListener(
      "click",
      () => {
        openProfile(data.TTMLUploadMetadata?.Uploader?.id);
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
          content: `View TTML Profile`,
        })
      )
    }
    makerSpan.addEventListener(
      "click",
      () => {
        openProfile(data.TTMLUploadMetadata?.Maker?.id);
        if (IsPIP) {
          globalThis.focus();
        }
      },
      { signal }
    );
  }
}
