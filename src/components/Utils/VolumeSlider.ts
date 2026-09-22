import Global from "../Global/Global.ts";
import { Icons } from "../Styling/Icons.ts";
import { SetControlsDragLock } from "./Fullscreen.ts";

let cleanupFn: (() => void) | null = null;

export function SetupVolumeSlider(container: HTMLElement, horizontal?: boolean) {
  CleanUpVolumeSlider();
  const targetDocument = container.ownerDocument;
  const targetWindow = targetDocument.defaultView ?? window;
  let muteResync: number | null = null;

  const icon = targetDocument.createElement("div");
  icon.className = "VolumeIcon";
  icon.innerHTML = Icons.Volume;
  icon.addEventListener("click", () => {
    try {
      Spicetify.Player.toggleMute();
    } finally {
      if (muteResync !== null) targetWindow.clearTimeout(muteResync);
      muteResync = targetWindow.setTimeout(() => {
        muteResync = null;
        updateFromVolume();
      }, 60);
    }
  });

  const sliderBar = targetDocument.createElement("div");
  sliderBar.className = "SliderBar";

  const setIconForVolume = (vol: number) => {
    sliderBar.classList.toggle("Muted", vol <= 0);
    sliderBar.classList.toggle("Low", vol > 0 && vol < 0.5);
    sliderBar.classList.toggle("High", vol >= 0.5);
  };

  const handle = targetDocument.createElement("div");
  handle.className = "Handle";
  sliderBar.appendChild(handle);
  sliderBar.appendChild(icon);

  if (horizontal) {
    container.classList.add("Horizontal");
    container.appendChild(sliderBar);
  } else {
    container.appendChild(sliderBar);
  }

  let isDragging = false;
  let prevUserSelect = "";
  let lastRenderedVolume: number | null = null;
  let lastCommittedVolume = Spicetify.Player.getVolume();
  let lastCommitTime = -Infinity;
  let pendingCommit: number | null = null;
  let commitTimer: number | null = null;
  let pointer: { clientX: number; clientY: number } | null = null;
  let dragRect: DOMRect | null = null;
  let geometryDirty = false;
  let dragFrame: number | null = null;

  const renderVolume = (volume: number) => {
    if (volume === lastRenderedVolume) return;
    lastRenderedVolume = volume;
    sliderBar.style.setProperty("--SliderProgress", volume.toString());
    setIconForVolume(volume);
  };

  const cancelPendingCommit = () => {
    if (commitTimer !== null) targetWindow.clearTimeout(commitTimer);
    commitTimer = null;
    pendingCommit = null;
  };

  const flushPendingCommit = () => {
    commitTimer = null;
    if (!isDragging || pendingCommit === null) return;
    const remaining = 70 - (targetWindow.performance.now() - lastCommitTime);
    if (remaining > 0) {
      commitTimer = targetWindow.setTimeout(flushPendingCommit, Math.ceil(remaining));
      return;
    }
    const percentage = pendingCommit;
    pendingCommit = null;
    if (percentage === lastCommittedVolume) return;
    lastCommitTime = targetWindow.performance.now();
    lastCommittedVolume = percentage;
    Spicetify.Player.setVolume(percentage);
  };

  const commitVolume = (percentage: number, force = false) => {
    if (force) {
      cancelPendingCommit();
      lastCommitTime = targetWindow.performance.now();
      lastCommittedVolume = percentage;
      Spicetify.Player.setVolume(percentage);
      return;
    }
    pendingCommit = percentage;
    if (commitTimer === null) flushPendingCommit();
  };

  const getPointerPercentage = (): number => {
    if (!pointer) return lastRenderedVolume ?? Spicetify.Player.getVolume();
    if (geometryDirty || !dragRect) {
      dragRect = sliderBar.getBoundingClientRect();
      geometryDirty = false;
    }
    if ((horizontal ? dragRect.width : dragRect.height) <= 0) return Spicetify.Player.getVolume();
    return horizontal
      ? Math.max(0, Math.min(1, (pointer.clientX - dragRect.left) / dragRect.width))
      : Math.max(0, Math.min(1, (dragRect.bottom - pointer.clientY) / dragRect.height));
  };

  const flushDragFrame = () => {
    dragFrame = null;
    if (!isDragging || !pointer) return;
    // Refresh invalidated geometry before any style or player writes.
    const percentage = getPointerPercentage();
    renderVolume(percentage);
    commitVolume(percentage);
  };

  const scheduleDragFrame = () => {
    if (dragFrame === null) dragFrame = targetWindow.requestAnimationFrame(flushDragFrame);
  };

  const invalidateGeometry = () => {
    if (!isDragging) return;
    geometryDirty = true;
    scheduleDragFrame();
  };
  const onScroll = (event: Event) => {
    const target = event.target as Node | null;
    if (target?.contains(sliderBar)) invalidateGeometry();
  };
  const geometryObserver = new targetWindow.ResizeObserver(invalidateGeometry);

  const updateFromVolume = () => {
    if (isDragging) return;
    renderVolume(Spicetify.Player.getVolume());
  };

  updateFromVolume();

  const rememberPointer = (event: MouseEvent | TouchEvent) => {
    if ("touches" in event) {
      const touch = event.touches[0] ?? event.changedTouches?.[0];
      if (touch) pointer = { clientX: touch.clientX, clientY: touch.clientY };
    } else {
      pointer = { clientX: event.clientX, clientY: event.clientY };
    }
  };

  const handleDragStart = (event: MouseEvent | TouchEvent) => {
    if (isDragging || ("button" in event && event.button !== 0)) return;
    if ((event.target as HTMLElement | null)?.closest?.(".VolumeIcon")) return;
    if (event.cancelable) event.preventDefault();
    dragRect = sliderBar.getBoundingClientRect();
    geometryDirty = false;
    lastCommittedVolume = Spicetify.Player.getVolume();
    isDragging = true;
    SetControlsDragLock(true);
    sliderBar.classList.add("Dragging");
    prevUserSelect = targetDocument.body.style.userSelect;
    targetDocument.body.style.userSelect = "none";
    targetDocument.addEventListener("mousemove", handleDragMove);
    targetDocument.addEventListener("touchmove", handleDragMove, { passive: false });
    targetDocument.addEventListener("mouseup", handleDragEnd);
    targetDocument.addEventListener("touchend", handleDragEnd);
    targetDocument.addEventListener("touchcancel", handleDragCancel);
    targetWindow.addEventListener("blur", handleDragCancel);
    targetWindow.addEventListener("resize", invalidateGeometry);
    targetDocument.addEventListener("scroll", onScroll, true);
    for (let ancestor: HTMLElement | null = sliderBar; ancestor; ancestor = ancestor.parentElement) {
      geometryObserver.observe(ancestor);
    }
    handleDragMove(event);
  };

  const handleDragMove = (event: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    if (event.cancelable) event.preventDefault();
    rememberPointer(event);
    scheduleDragFrame();
  };

  const releaseDrag = () => {
    if (isDragging) {
      isDragging = false;
      sliderBar.classList.remove("Dragging");
      targetDocument.body.style.userSelect = prevUserSelect;
      SetControlsDragLock(false);
    }
    targetDocument.removeEventListener("mousemove", handleDragMove);
    targetDocument.removeEventListener("touchmove", handleDragMove);
    targetDocument.removeEventListener("mouseup", handleDragEnd);
    targetDocument.removeEventListener("touchend", handleDragEnd);
    targetDocument.removeEventListener("touchcancel", handleDragCancel);
    targetWindow.removeEventListener("blur", handleDragCancel);
    targetWindow.removeEventListener("resize", invalidateGeometry);
    targetDocument.removeEventListener("scroll", onScroll, true);
    geometryObserver.disconnect();
    cancelPendingCommit();
    if (dragFrame !== null) {
      targetWindow.cancelAnimationFrame(dragFrame);
      dragFrame = null;
    }
    pointer = null;
    dragRect = null;
    geometryDirty = false;
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    rememberPointer(event);
    const percentage = getPointerPercentage();
    releaseDrag();
    renderVolume(percentage);
    commitVolume(percentage, true);
  };

  const handleDragCancel = () => {
    releaseDrag();
    updateFromVolume();
  };

  sliderBar.addEventListener("mousedown", handleDragStart);
  sliderBar.addEventListener("touchstart", handleDragStart, { passive: false });

  const wheelHandler = (event: WheelEvent) => {
    if (event.deltaY === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const next = Math.max(0, Math.min(1, Spicetify.Player.getVolume() + (event.deltaY < 0 ? 0.05 : -0.05)));
    renderVolume(next);
    commitVolume(next, !isDragging);
  };
  sliderBar.addEventListener("wheel", wheelHandler, { passive: false });

  const volumeEventId = Global.Event.listen("playback:volume", (volume: number) => {
    if (isDragging || typeof volume !== "number") return;
    renderVolume(volume);
  });

  const pollInterval = targetWindow.setInterval(updateFromVolume, 250);

  cleanupFn = () => {
    releaseDrag();
    targetWindow.clearInterval(pollInterval);
    if (muteResync !== null) targetWindow.clearTimeout(muteResync);
    sliderBar.removeEventListener("mousedown", handleDragStart);
    sliderBar.removeEventListener("touchstart", handleDragStart);
    sliderBar.removeEventListener("wheel", wheelHandler);
    Global.Event.unListen(volumeEventId);
    container.innerHTML = "";
    container.classList.remove("Horizontal");
    container.classList.remove("RightSide");
  };
}

export function CleanUpVolumeSlider() {
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }
}
