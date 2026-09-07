import React from "react";
import ReactDOM from "react-dom/client";
import { Query } from "../../../utils/API/Query.ts";

const IFRAME_ORIGIN = "https://spicylyrics.org";
const PROFILE_READY_TIMEOUT_MS = 8_000;
const USERNAME_CACHE_MS = 5 * 60_000;
const USERNAME_RETRY_MS = 30_000;
const usernameCache = new Map<string, { username: string | null; expires: number }>();
const usernameRequests = new Map<string, Promise<string | null>>();

export function resolveProfileUsername(userId: string): Promise<string | null> {
  const cached = usernameCache.get(userId);
  if (cached && cached.expires > Date.now()) return Promise.resolve(cached.username);
  const pending = usernameRequests.get(userId);
  if (pending) return pending;

  const request = Query([{
    operation: "ttmlProfile",
    variables: { userId, referrer: "lyricsCreditsView" },
  }])
    .then((result) => {
      const value = result.get("0")?.data?.profile?.data?.username;
      return typeof value === "string" && value.trim() ? value.trim() : null;
    })
    .catch(() => null)
    .then((username) => {
      usernameCache.set(userId, {
        username,
        expires: Date.now() + (username ? USERNAME_CACHE_MS : USERNAME_RETRY_MS),
      });
      return username;
    })
    .finally(() => usernameRequests.delete(userId));
  usernameRequests.set(userId, request);
  return request;
}

type ProfileState = "loading" | "ready" | "failed" | "closed";
interface ProfileOptions {
  signal: AbortSignal;
  onState: (state: ProfileState) => void;
}

interface ProfileSession {
  userId: string;
  document: Document;
  pending: boolean;
  close: () => void;
  reveal: () => void;
}

let activeSession: ProfileSession | null = null;

export function closeIframeProfileModal(userId?: string) {
  if (!userId || activeSession?.userId === userId) activeSession?.close();
}

function IframeProfileModal({ onClose, onOpenBrowser, attachFrame }: {
  onClose: () => void;
  onOpenBrowser: () => void;
  attachFrame: (frame: HTMLIFrameElement | null) => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="TTML profile"
        onClick={(event) => event.stopPropagation()}
        style={{
          position: "relative", background: "#0e0e0e",
          border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12,
          overflow: "hidden", boxShadow: "0 16px 60px rgba(0,0,0,0.8)",
          display: "flex", flexDirection: "column",
          width: "min(1100px, calc(100% - 48px))",
          height: "min(72%, calc(100% - 48px))",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close profile"
          style={{
            position: "absolute", top: 12, right: 12, zIndex: 1,
            width: 28, height: 28, display: "flex", alignItems: "center",
            justifyContent: "center", background: "rgba(255,255,255,0.08)",
            border: "none", borderRadius: "50%", cursor: "pointer",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M31.098 29.794L16.955 15.65 31.097 1.51 29.683.093 15.54 14.237 1.4.094-.016 1.508 14.126 15.65-.016 29.795l1.414 1.414L15.54 17.065l14.144 14.143" fill="currentColor" fillRule="evenodd" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onOpenBrowser}
          aria-label="Open profile in browser"
          style={{ position: "absolute", top: 12, right: 48, zIndex: 1, padding: "5px 9px", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 14, cursor: "pointer", color: "rgba(255,255,255,0.7)", fontSize: 11 }}
        >
          Browser
        </button>
        <iframe
          ref={attachFrame}
          title="TTML profile"
          allow="clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-popups"
          style={{ flex: 1, width: "100%", border: "none", display: "block", minHeight: 0 }}
        />
      </div>
    </div>
  );
}

/** One lifecycle owns lookup, the hidden frame, the deadline, and loading feedback. */
export function showIframeProfileModal(
  userId: string,
  targetDocument: Document,
  options: ProfileOptions,
) {
  if (options.signal.aborted) return;
  if (activeSession?.userId === userId && activeSession.document === targetDocument) return;
  closeIframeProfileModal();

  const targetWindow = targetDocument.defaultView ?? window;
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof ReactDOM.createRoot> | null = null;
  let iframe: HTMLIFrameElement | null = null;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const stopTimers = () => {
    clearTimeout(deadline);
  };
  const onAbort = () => {
    if (session.pending) close();
  };
  const close = () => {
    if (closed) return;
    closed = true;
    stopTimers();
    options.signal.removeEventListener("abort", onAbort);
    targetWindow.removeEventListener("message", onMessage);
    targetWindow.removeEventListener("keydown", onKeyDown, true);
    if (iframe) iframe.removeEventListener("load", reveal);
    root?.unmount();
    container?.remove();
    if (activeSession === session) activeSession = null;
    options.onState("closed");
  };
  const reveal = () => {
    if (closed || !container || !iframe || !session.pending) return;
    stopTimers();
    session.pending = false;
    container.inert = false;
    container.removeAttribute("aria-hidden");
    container.style.visibility = "visible";
    container.style.pointerEvents = "auto";
    options.onState("ready");
  };
  const fail = () => {
    if (closed) return;
    close();
    options.onState("failed");
  };
  const onMessage = (event: MessageEvent) => {
    if (closed || event.origin !== IFRAME_ORIGIN || !iframe ||
        event.source !== iframe.contentWindow) return;
    const message = event.data;
    if (session.pending || message?.type !== "events" || !Array.isArray(message.data?.events)) return;
    for (const item of message.data.events) {
      const patches = Array.isArray(item?.patches) ? item.patches : [];
      if (item?.action === "PATCH_PLAYBACK") {
        const uri = patches[0]?.playback_uri;
        if (typeof uri === "string" && /^spotify:[a-z]+:[A-Za-z0-9]+$/.test(uri)) {
          close();
          Spicetify.Player.playUri(uri);
          return;
        }
      } else if (item?.action === "MODIFY_APP_STATE" &&
          patches.some((patch: any) => patch?.ttml_profile_modal_open_state === false)) {
        close();
        return;
      }
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  };
  const session: ProfileSession = { userId, document: targetDocument, pending: true, close, reveal };
  activeSession = session;
  options.signal.addEventListener("abort", onAbort, { once: true });
  targetWindow.addEventListener("keydown", onKeyDown, true);
  // Register before creating/navigating the iframe, including cached page loads.
  targetWindow.addEventListener("message", onMessage);
  options.onState("loading");
  deadline = setTimeout(() => {
    if (closed || !session.pending) return;
    fail();
  }, PROFILE_READY_TIMEOUT_MS);

  void resolveProfileUsername(userId).then((username) => {
    if (closed || options.signal.aborted) return;
    if (!username) {
      fail();
      return;
    }
    try {
      container = targetDocument.createElement("div");
      // The outermost host must not intercept clicks or keyboard focus while loading.
      container.style.cssText = "position:fixed;inset:0;z-index:9999;visibility:hidden;pointer-events:none;";
      container.inert = true;
      container.setAttribute("aria-hidden", "true");
      targetDocument.documentElement.appendChild(container);
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(IframeProfileModal, {
        onClose: close,
        onOpenBrowser: () => {
          targetWindow.open(`https://spicylyrics.org/uid/${encodeURIComponent(userId)}`, "_blank", "noopener,noreferrer");
          close();
        },
        attachFrame: (frame: HTMLIFrameElement | null) => {
          iframe = frame;
          if (!frame || closed) return;
          frame.addEventListener("load", reveal, { once: true });
          frame.src = `${IFRAME_ORIGIN}/embed/${encodeURIComponent(username)}`;
        },
      }));
    } catch {
      fail();
    }
  });
}
