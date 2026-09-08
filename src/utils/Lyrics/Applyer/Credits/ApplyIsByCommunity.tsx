import { IsPIP } from "../../../../components/Utils/PopupLyrics.ts";
import {
  closeIframeProfileModal,
  resolveProfileIdentity,
  showIframeProfileModal,
} from "../../../../components/ReactComponents/IframeProfile/IframeProfileModal.tsx";
import { PinFooterDetailWithoutWriters } from "./CreateLyricsFooter.ts";

let isByCommunityAbortController: AbortController | null = null;
let madeTippys = new Set<any>();
const CREDIT_NAME_SETTLE_MS = 50;

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

function openProfile(userId: string | undefined, profileElement: HTMLElement, signal: AbortSignal) {
  if (!userId || signal.aborted) return;
  const profileDocument = profileElement.ownerDocument;
  const url = `https://spicylyrics.org/uid/${encodeURIComponent(userId)}`;

  const feedback = profileDocument.createElement("span");
  feedback.className = "sl-profile-feedback";
  const clearFeedback = () => {
    feedback.remove();
    feedback.replaceChildren();
    profileElement.removeAttribute("aria-busy");
  };
  signal.addEventListener("abort", clearFeedback, { once: true });
  showIframeProfileModal(userId, profileDocument, {
    signal,
    onState: (state) => {
      clearFeedback();
      if (signal.aborted || state === "closed" || state === "ready") return;
      const status = profileDocument.createElement("span");
      status.setAttribute("role", "status");
      if (state === "loading") {
        profileElement.setAttribute("aria-busy", "true");
        const spinner = profileDocument.createElement("span");
        spinner.className = "sl-profile-loading";
        spinner.setAttribute("aria-hidden", "true");
        status.className = "sl-profile-status-text";
        status.textContent = "Loading profile";
        feedback.append(spinner, status);
      } else {
        status.textContent = "Couldn't load profile here.";
        feedback.appendChild(status);
        const browserLink = profileDocument.createElement("a");
        browserLink.className = "sl-profile-action";
        browserLink.href = url;
        browserLink.target = "_blank";
        browserLink.rel = "noopener noreferrer";
        browserLink.textContent = "Open in browser";
        browserLink.addEventListener("click", () => {
          closeIframeProfileModal(userId);
          clearFeedback();
        }, { signal });
        feedback.appendChild(browserLink);
      }
      profileElement.after(feedback);
    },
  });
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

  const preferredProfileName = (username?: string, displayName?: string) => {
    const cleanUsername = username?.trim();
    const cleanDisplayName = displayName?.trim();
    if (cleanUsername && cleanDisplayName && cleanUsername.toLowerCase() === cleanDisplayName.toLowerCase()) {
      return cleanDisplayName;
    }
    return cleanUsername ?? cleanDisplayName;
  };

  const makerDisplayName = data.TTMLUploadMetadata?.Maker?.displayName ?? data.TTMLUploadMetadata?.Maker?.display_name ?? data.TTMLUploadMetadata?.Maker?.globalName ?? data.TTMLUploadMetadata?.Maker?.global_name;
  const makerUsername = preferredProfileName(data.TTMLUploadMetadata?.Maker?.username, makerDisplayName);
  const makerAvatar = data.TTMLUploadMetadata?.Maker?.avatar;
  const uploaderDisplayName = data.TTMLUploadMetadata?.Uploader?.displayName ?? data.TTMLUploadMetadata?.Uploader?.display_name ?? data.TTMLUploadMetadata?.Uploader?.globalName ?? data.TTMLUploadMetadata?.Uploader?.global_name;
  const uploaderUsername = preferredProfileName(data.TTMLUploadMetadata?.Uploader?.username, uploaderDisplayName);
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
  PinFooterDetailWithoutWriters(songInfoElement, LyricsContainer);

  const communityCreditElements = [
    ...Array.from(LyricsContainer.children).filter((element) =>
      element.classList.contains("Credits") || element.classList.contains("LyricsProvider"),
    ),
    songInfoElement,
  ];
  const creditWindow = LyricsContainer.ownerDocument.defaultView ?? window;
  const reducedMotion = creditWindow.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const creditStates = communityCreditElements.map((element) => ({
    element: element as HTMLElement,
    opacity: creditWindow.getComputedStyle(element).opacity,
    slide: !reducedMotion && element.closest(".LyricsPinnedFooter") !== null,
  }));
  creditStates.forEach(({ element: creditElement, slide }) => {
    // Commit the hidden starting state without transitioning away from visible.
    creditElement.style.transition = "none";
    creditElement.style.opacity = "0";
    if (slide) creditElement.style.transform = "translateY(4px)";
  });

  let creditsRevealed = false;
  let revealFrame: number | null = null;
  let revealTimer: number | null = null;
  signal.addEventListener("abort", () => {
    if (revealFrame !== null) creditWindow.cancelAnimationFrame(revealFrame);
    if (revealTimer !== null) creditWindow.clearTimeout(revealTimer);
  }, { once: true });

  const revealCredits = () => {
    if (creditsRevealed || signal.aborted) return;
    creditsRevealed = true;
    if (revealTimer !== null) {
      creditWindow.clearTimeout(revealTimer);
      revealTimer = null;
    }
    revealFrame = creditWindow.requestAnimationFrame(() => {
      if (signal.aborted) return;
      revealFrame = creditWindow.requestAnimationFrame(() => {
        revealFrame = null;
        if (signal.aborted) return;
        creditStates.forEach(({ element, opacity, slide }) => {
          if (!element.isConnected) return;
          element.style.transition = slide
            ? "opacity 180ms cubic-bezier(0.22, 1, 0.36, 1), transform 220ms cubic-bezier(0.22, 1, 0.36, 1)"
            : "opacity 180ms cubic-bezier(0.22, 1, 0.36, 1)";
          element.style.opacity = opacity;
          if (slide) element.style.transform = "translateY(0)";
        });
      });
    });
  };

  revealTimer = creditWindow.setTimeout(revealCredits, CREDIT_NAME_SETTLE_MS);
  if (!data.TTMLUploadMetadata) return;

  const updateDiscordUsername = (
    userId: string | undefined,
    element: HTMLSpanElement | undefined,
    displayName?: string,
  ) => {
    if (!userId || !element) return Promise.resolve();
    return resolveProfileIdentity(userId).then((profile) => {
      if (!signal.aborted && profile) {
        const renderedName = element.textContent?.trim();
        const profileName = preferredProfileName(
          profile.username,
          renderedName || displayName || profile.displayName,
        ) ?? profile.username;
        element.textContent = profileName;
        const avatar = element.parentElement?.querySelector("img");
        if (avatar) avatar.alt = `${profileName}'s avatar`;
      }
    });
  };
  const profileUpdates = [
    updateDiscordUsername(data.TTMLUploadMetadata?.Maker?.id, makerUsernameSpan, makerDisplayName),
    updateDiscordUsername(data.TTMLUploadMetadata?.Uploader?.id, uploaderUsernameSpan, uploaderDisplayName),
  ];
  void Promise.allSettled(profileUpdates).then(revealCredits);

  const uploaderSpan = songInfoElement.querySelector<HTMLElement>(".Uploader .song-info-profile-section");
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
        openProfile(data.TTMLUploadMetadata?.Uploader?.id, uploaderSpan, signal);
        if (IsPIP) {
          globalThis.focus();
        }
      },
      { signal }
    );
  }

  const makerSpan = songInfoElement.querySelector<HTMLElement>(".Maker .song-info-profile-section");
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
        openProfile(data.TTMLUploadMetadata?.Maker?.id, makerSpan, signal);
        if (IsPIP) {
          globalThis.focus();
        }
      },
      { signal }
    );
  }
}
