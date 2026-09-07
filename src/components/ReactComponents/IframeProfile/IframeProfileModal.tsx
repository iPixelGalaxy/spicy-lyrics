import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { Query } from "../../../utils/API/Query.ts";

const IFRAME_ORIGIN = "https://spicylyrics.org";
const PROFILE_READY_TIMEOUT_MS = 8_000;
const usernameCache = new Map<string, string>();
const usernameRequests = new Map<string, Promise<string | null>>();

export function resolveProfileUsername(userId: string): Promise<string | null> {
  const cached = usernameCache.get(userId);
  if (cached) return Promise.resolve(cached);
  let request = usernameRequests.get(userId);
  if (!request) {
    request = Query([{ operation: "ttmlProfile", variables: { userId, referrer: "lyricsCreditsView" } }])
      .then((result) => {
        const username = result.get("0")?.data?.profile?.data?.username;
        if (typeof username !== "string" || !username) return null;
        usernameCache.set(userId, username);
        return username;
      })
      .catch(() => null)
      .finally(() => usernameRequests.delete(userId));
    usernameRequests.set(userId, request);
  }
  return request;
}

interface IframeProfileModalProps {
  userId: string;
  username: string;
  onClose: () => void;
  onBrowserFallback: () => void;
  messageWindow: Window;
}

function IframeProfileModal({ userId, username, onClose, onBrowserFallback, messageWindow }: IframeProfileModalProps) {
  const [ready, setReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.origin !== IFRAME_ORIGIN || event.source !== iframeRef.current?.contentWindow) return;
    if (event.data?.type === "spicy-profile-status" && event.data?.version === 1 && event.data?.userId === userId) {
      if (event.data.status === "ready") setReady(true);
      if (event.data.status === "error") onBrowserFallback();
      return;
    }
    if (event.data?.type !== "events") return;
    for (const frameEvent of event.data?.data?.events ?? []) {
      if (frameEvent.action === "PATCH_PLAYBACK") {
        const uri = frameEvent.patches?.[0]?.playback_uri;
        if (typeof uri === "string" && /^spotify:[a-z]+:[A-Za-z0-9]+$/.test(uri)) {
          onClose();
          Spicetify.Player.playUri(uri);
        }
      } else if (frameEvent.action === "MODIFY_APP_STATE" && frameEvent.patches?.some((patch: any) => patch.ttml_profile_modal_open_state === false)) {
        onClose();
      }
    }
  }, [onBrowserFallback, onClose, userId]);

  useEffect(() => {
    messageWindow.addEventListener("message", handleMessage);
    const timeout = ready ? null : setTimeout(onBrowserFallback, PROFILE_READY_TIMEOUT_MS);
    return () => {
      messageWindow.removeEventListener("message", handleMessage);
      if (timeout) clearTimeout(timeout);
    };
  }, [handleMessage, messageWindow, onBrowserFallback, ready]);

  return (
    <div onClick={onClose} aria-hidden={!ready} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", opacity: ready ? 1 : 0, pointerEvents: ready ? "auto" : "none", transition: "opacity 120ms ease" }}>
      <div onClick={(event) => event.stopPropagation()} style={{ position: "relative", background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, overflow: "hidden", boxShadow: "0 16px 60px rgba(0,0,0,0.8)", display: "flex", flexDirection: "column", width: "min(1100px, calc(100% - 48px))", height: "min(72%, calc(100% - 48px))" }}>
        <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 12, right: 12, zIndex: 1, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", cursor: "pointer", color: "rgba(255,255,255,0.7)" }}>
          <svg width="14" height="14" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M31.098 29.794L16.955 15.65 31.097 1.51 29.683.093 15.54 14.237 1.4.094-.016 1.508 14.126 15.65-.016 29.795l1.414 1.414L15.54 17.065l14.144 14.143" fill="currentColor" fillRule="evenodd" /></svg>
        </button>
        <iframe ref={iframeRef} src={`${IFRAME_ORIGIN}/embed/${encodeURIComponent(username)}`} allow="clipboard-write" sandbox="allow-scripts allow-same-origin allow-popups" style={{ flex: 1, width: "100%", border: "none", display: "block", minHeight: 0 }} />
      </div>
    </div>
  );
}

let profileRoot: ReturnType<typeof ReactDOM.createRoot> | null = null;
let profileContainer: HTMLElement | null = null;
let profileHost: HTMLElement | null = null;
let profileHostPreviousPosition = "";
let resizeHandler: (() => void) | null = null;
let profileWindow: Window | null = null;

export function closeIframeProfileModal() {
  if (resizeHandler) (profileWindow ?? window).removeEventListener("resize", resizeHandler);
  resizeHandler = null;
  profileRoot?.unmount();
  profileRoot = null;
  profileContainer?.remove();
  profileContainer = null;
  if (profileHost) profileHost.style.position = profileHostPreviousPosition;
  profileHost = null;
  profileHostPreviousPosition = "";
  profileWindow = null;
}

export function showIframeProfileModal(userId: string, username: string, targetDocument: Document = document) {
  closeIframeProfileModal();
  const host = targetDocument.documentElement;
  const targetWindow = targetDocument.defaultView ?? window;
  const openInBrowser = () => {
    targetWindow.open(`https://spicylyrics.org/uid/${encodeURIComponent(userId)}`, "_blank", "noopener,noreferrer");
    closeIframeProfileModal();
  };
  profileHost = host;
  profileHostPreviousPosition = host.style.position;
  if (!host.style.position || host.style.position === "static") host.style.position = "relative";
  const container = targetDocument.createElement("div");
  const setContainerSize = () => {
    const rect = host.getBoundingClientRect();
    container.style.cssText = `position:absolute;top:0;left:0;width:${rect.width}px;height:${rect.height}px;z-index:9999;`;
  };
  setContainerSize();
  host.appendChild(container);
  profileContainer = container;
  resizeHandler = setContainerSize;
  profileWindow = targetWindow;
  targetWindow.addEventListener("resize", resizeHandler);
  profileRoot = ReactDOM.createRoot(container);
  profileRoot.render(React.createElement(IframeProfileModal, { userId, username, onClose: closeIframeProfileModal, onBrowserFallback: openInBrowser, messageWindow: targetWindow }));
}
