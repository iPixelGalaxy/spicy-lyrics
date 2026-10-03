import { $animationFpsCap, $animationFpsCapEnabled } from "./stores.ts";

type FrameCallback = (timestamp: number) => void;
type FrameLoop = {
  targetWindow: Window;
  callbacks: Set<FrameCallback>;
  pending: Map<number, FrameCallback>;
  frameId: number | null;
  lastRender: number;
  loop: FrameCallback;
};

// Separate clocks let Cinema and PiP keep rendering while Spotify is hidden.
const loops = new WeakMap<Window, FrameLoop>();
const pendingOwners = new Map<number, FrameLoop>();
const reportedErrors = new WeakSet<FrameCallback>();
let nextPendingId = 1;
const FRAME_SLACK_MS = 1;
const MIN_FPS_CAP = 15;
const MAX_FPS_CAP = 240;
const DEFAULT_FPS_CAP = 60;

const computeFrameInterval = (): number => {
  if (!$animationFpsCapEnabled.get()) return 0;
  const saved = Number($animationFpsCap.get());
  const fps = Number.isFinite(saved)
    ? Math.min(MAX_FPS_CAP, Math.max(MIN_FPS_CAP, saved))
    : DEFAULT_FPS_CAP;
  return 1000 / fps;
};

let frameInterval = computeFrameInterval();
const updateFrameInterval = () => {
  frameInterval = computeFrameInterval();
};
$animationFpsCapEnabled.listen(updateFrameInterval);
$animationFpsCap.listen(updateFrameInterval);

function shouldRender(state: FrameLoop, timestamp: number): boolean {
  if (frameInterval === 0) {
    state.lastRender = timestamp;
    return true;
  }
  const elapsed = timestamp - state.lastRender;
  if (elapsed < frameInterval - FRAME_SLACK_MS) return false;
  // Keep the phase across refresh-rate jitter, but discard time after a stall.
  state.lastRender =
    elapsed >= frameInterval && elapsed < frameInterval * 2
      ? timestamp - (elapsed % frameInterval)
      : timestamp;
  return true;
}

function run(callback: FrameCallback, timestamp: number): void {
  try {
    callback(timestamp);
    reportedErrors.delete(callback);
  } catch (error) {
    if (!reportedErrors.has(callback)) {
      console.error("Spicy Lyrics: animation frame callback failed", error);
      reportedErrors.add(callback);
    }
  }
}

function schedule(state: FrameLoop): void {
  if (state.frameId === null && !state.targetWindow.closed &&
    (state.callbacks.size > 0 || state.pending.size > 0)) {
    state.frameId = state.targetWindow.requestAnimationFrame(state.loop);
  }
}

function stopIfIdle(state: FrameLoop): void {
  if (state.callbacks.size === 0 && state.pending.size === 0 && state.frameId !== null) {
    state.targetWindow.cancelAnimationFrame(state.frameId);
    state.frameId = null;
    state.lastRender = -Infinity;
  }
}

function getLoop(targetWindow: Window): FrameLoop {
  const existing = loops.get(targetWindow);
  if (existing) return existing;
  const state: FrameLoop = {
    targetWindow,
    callbacks: new Set(),
    pending: new Map(),
    frameId: null,
    lastRender: -Infinity,
    loop: (timestamp) => {
      state.frameId = null;
      if (shouldRender(state, timestamp)) {
        // Restarts and new requests wait until the next frame; cancellation
        // still takes effect for callbacks already in this frame's snapshot.
        const callbacks = [...state.callbacks];
        const pending = [...state.pending];
        for (const callback of callbacks) {
          if (state.callbacks.has(callback)) run(callback, timestamp);
        }
        for (const [id, callback] of pending) {
          if (!state.pending.delete(id)) continue;
          pendingOwners.delete(id);
          run(callback, timestamp);
        }
      }
      schedule(state);
    },
  };
  loops.set(targetWindow, state);
  targetWindow.addEventListener("pagehide", () => {
    if (state.frameId !== null) targetWindow.cancelAnimationFrame(state.frameId);
    state.frameId = null;
    state.callbacks.clear();
    for (const id of state.pending.keys()) pendingOwners.delete(id);
    state.pending.clear();
    loops.delete(targetWindow);
  }, { once: true });
  return state;
}

export function onAnimationFrame(callback: FrameCallback, targetWindow: Window = window): () => void {
  const state = getLoop(targetWindow);
  state.callbacks.add(callback);
  schedule(state);
  return () => {
    state.callbacks.delete(callback);
    stopIfIdle(state);
  };
}

export function requestCappedFrame(callback: FrameCallback, targetWindow: Window = window): number {
  const state = getLoop(targetWindow);
  const id = nextPendingId++;
  state.pending.set(id, callback);
  pendingOwners.set(id, state);
  schedule(state);
  return id;
}

export function cancelCappedFrame(id: number): void {
  const state = pendingOwners.get(id);
  if (!state) return;
  state.pending.delete(id);
  pendingOwners.delete(id);
  stopIfIdle(state);
}
