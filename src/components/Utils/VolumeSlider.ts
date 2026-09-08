import Global from "../Global/Global.ts";
import { Icons } from "../Styling/Icons.ts";

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

  setIconForVolume(Spicetify.Player.getVolume());

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
  let lastCommittedVolume = Spicetify.Player.getVolume();
  let lastCommitTime = 0;
  let pendingPercentage: number | null = null;
  let dragFrame: number | null = null;

  const commitVolume = (percentage: number, force = false) => {
    const now = performance.now();
    if (!force && now - lastCommitTime < 70 && Math.abs(percentage - lastCommittedVolume) < 0.02) {
      return;
    }
    lastCommitTime = now;
    lastCommittedVolume = percentage;
    Spicetify.Player.setVolume(percentage);
  };

  const flushDragFrame = () => {
    dragFrame = null;
    if (pendingPercentage === null) return;
    const percentage = pendingPercentage;
    sliderBar.style.setProperty("--SliderProgress", percentage.toString());
    setIconForVolume(percentage);
    commitVolume(percentage);
  };

  const updateFromVolume = () => {
    if (isDragging) return;
    const vol = Spicetify.Player.getVolume();
    sliderBar.style.setProperty("--SliderProgress", vol.toString());
    setIconForVolume(vol);
  };

  updateFromVolume();

  const getPercentageFromEvent = (event: MouseEvent | TouchEvent): number => {
    let clientX: number;
    let clientY: number;
    if ("touches" in event) {
      const touch = event.touches[0] ?? event.changedTouches?.[0];
      if (!touch) return Spicetify.Player.getVolume();
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    const rect = sliderBar.getBoundingClientRect();
    if ((horizontal ? rect.width : rect.height) <= 0) return Spicetify.Player.getVolume();
    if (horizontal) {
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    }
    return Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
  };

  const handleDragStart = (event: MouseEvent | TouchEvent) => {
    if (isDragging || ("button" in event && event.button !== 0)) return;
    if ((event.target as HTMLElement | null)?.closest?.(".VolumeIcon")) return;
    if (event.cancelable) event.preventDefault();
    isDragging = true;
    sliderBar.classList.add("Dragging");
    prevUserSelect = targetDocument.body.style.userSelect;
    targetDocument.body.style.userSelect = "none";
    targetDocument.addEventListener("mousemove", handleDragMove);
    targetDocument.addEventListener("touchmove", handleDragMove, { passive: false });
    targetDocument.addEventListener("mouseup", handleDragEnd);
    targetDocument.addEventListener("touchend", handleDragEnd);
    targetDocument.addEventListener("touchcancel", handleDragCancel);
    targetWindow.addEventListener("blur", handleDragCancel);
    handleDragMove(event);
  };

  const handleDragMove = (event: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    if (event.cancelable) event.preventDefault();
    pendingPercentage = getPercentageFromEvent(event);
    if (dragFrame === null) {
      dragFrame = targetWindow.requestAnimationFrame(flushDragFrame);
    }
  };

  const releaseDrag = () => {
    if (isDragging) {
      isDragging = false;
      sliderBar.classList.remove("Dragging");
      targetDocument.body.style.userSelect = prevUserSelect;
    }
    targetDocument.removeEventListener("mousemove", handleDragMove);
    targetDocument.removeEventListener("touchmove", handleDragMove);
    targetDocument.removeEventListener("mouseup", handleDragEnd);
    targetDocument.removeEventListener("touchend", handleDragEnd);
    targetDocument.removeEventListener("touchcancel", handleDragCancel);
    targetWindow.removeEventListener("blur", handleDragCancel);
    if (dragFrame !== null) {
      targetWindow.cancelAnimationFrame(dragFrame);
      dragFrame = null;
    }
    pendingPercentage = null;
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const percentage = getPercentageFromEvent(event);
    releaseDrag();
    sliderBar.style.setProperty("--SliderProgress", percentage.toString());
    setIconForVolume(percentage);
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
    sliderBar.style.setProperty("--SliderProgress", next.toString());
    setIconForVolume(next);
    commitVolume(next, true);
  };
  sliderBar.addEventListener("wheel", wheelHandler, { passive: false });

  const volumeEventId = Global.Event.listen("playback:volume", (volume: number) => {
    if (isDragging || typeof volume !== "number") return;
    sliderBar.style.setProperty("--SliderProgress", volume.toString());
    setIconForVolume(volume);
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
