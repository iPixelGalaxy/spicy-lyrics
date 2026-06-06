// Spotify's own volume icons (extracted from the Spotify web player)
let cleanupFn: (() => void) | null = null;

const VolumeIcons = {
  off:    `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M13.86 5.47a.75.75 0 0 0-1.061 0l-1.47 1.47-1.47-1.47A.75.75 0 0 0 8.8 6.53L10.269 8l-1.47 1.47a.75.75 0 1 0 1.06 1.06l1.47-1.47 1.47 1.47a.75.75 0 0 0 1.06-1.06L12.39 8l1.47-1.47a.75.75 0 0 0 0-1.06"></path><path d="M10.116 1.5A.75.75 0 0 0 8.991.85l-6.925 4a3.64 3.64 0 0 0-1.33 4.967 3.64 3.64 0 0 0 1.33 1.332l6.925 4a.75.75 0 0 0 1.125-.649v-1.906a4.7 4.7 0 0 1-1.5-.694v1.3L2.817 9.852a2.14 2.14 0 0 1-.781-2.92c.187-.324.456-.594.78-.782l5.8-3.35v1.3c.45-.313.956-.55 1.5-.694z"></path></svg>`,
  low:    `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.64 3.64 0 0 1-1.33-4.967 3.64 3.64 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.14 2.14 0 0 0 0 3.7l5.8 3.35V2.8zm8.683 4.29V5.56a2.75 2.75 0 0 1 0 4.88"></path></svg>`,
  medium: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.64 3.64 0 0 1-1.33-4.967 3.64 3.64 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.14 2.14 0 0 0 0 3.7l5.8 3.35V2.8zm8.683 6.087a4.502 4.502 0 0 0 0-8.474v1.65a3 3 0 0 1 0 5.175z"></path></svg>`,
  high:   `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.64 3.64 0 0 1-1.33-4.967 3.64 3.64 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.14 2.14 0 0 0 0 3.7l5.8 3.35V2.8zm8.683 4.29V5.56a2.75 2.75 0 0 1 0 4.88"></path><path d="M11.5 13.614a5.752 5.752 0 0 0 0-11.228v1.55a4.252 4.252 0 0 1 0 8.127z"></path></svg>`,
};

function getVolumeIcon(vol: number): string {
  if (vol <= 0)    return VolumeIcons.off;
  if (vol < 0.33)  return VolumeIcons.low;
  if (vol < 0.66)  return VolumeIcons.medium;
  return VolumeIcons.high;
}

export function SetupVolumeSlider(container: HTMLElement, horizontal?: boolean) {
  CleanUpVolumeSlider();
  const targetDocument = container.ownerDocument;
  const targetWindow = targetDocument.defaultView ?? window;

  let lastRenderedIcon = "";
  const setIconForVolume = (vol: number) => {
    const nextIcon = getVolumeIcon(vol);
    if (nextIcon === lastRenderedIcon) return;
    lastRenderedIcon = nextIcon;
    icon.innerHTML = nextIcon;
  };

  const icon = targetDocument.createElement("div");
  icon.className = "VolumeIcon";
  setIconForVolume(Spicetify.Player.getVolume());
  icon.addEventListener("click", () => {
    const vol = Spicetify.Player.getVolume();
    const nextVolume = vol > 0 ? 0 : 0.5;
    Spicetify.Player.setVolume(nextVolume);
    sliderBar.style.setProperty("--SliderProgress", nextVolume.toString());
    setIconForVolume(nextVolume);
  });

  const sliderBar = targetDocument.createElement("div");
  sliderBar.className = "SliderBar";

  const handle = targetDocument.createElement("div");
  handle.className = "Handle";
  sliderBar.appendChild(handle);

  if (horizontal) {
    container.classList.add("Horizontal");
    container.appendChild(icon);
    container.appendChild(sliderBar);
  } else {
    const topSpacer = targetDocument.createElement("div");
    topSpacer.className = "VolumeIconSpacer";
    container.appendChild(topSpacer);
    container.appendChild(sliderBar);
    container.appendChild(icon);
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
      if (!touch) return 0;
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    const rect = sliderBar.getBoundingClientRect();
    if (horizontal) {
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    }
    return Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
  };

  const handleDragStart = (event: MouseEvent | TouchEvent) => {
    isDragging = true;
    prevUserSelect = targetDocument.body.style.userSelect;
    targetDocument.body.style.userSelect = "none";
    targetDocument.addEventListener("mousemove", handleDragMove);
    targetDocument.addEventListener("touchmove", handleDragMove);
    targetDocument.addEventListener("mouseup", handleDragEnd);
    targetDocument.addEventListener("touchend", handleDragEnd);
    handleDragMove(event);
  };

  const handleDragMove = (event: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    pendingPercentage = getPercentageFromEvent(event);
    if (dragFrame === null) {
      dragFrame = targetWindow.requestAnimationFrame(flushDragFrame);
    }
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    isDragging = false;
    targetDocument.body.style.userSelect = prevUserSelect;
    targetDocument.removeEventListener("mousemove", handleDragMove);
    targetDocument.removeEventListener("touchmove", handleDragMove);
    targetDocument.removeEventListener("mouseup", handleDragEnd);
    targetDocument.removeEventListener("touchend", handleDragEnd);
    const percentage = getPercentageFromEvent(event);
    pendingPercentage = percentage;
    if (dragFrame !== null) {
      targetWindow.cancelAnimationFrame(dragFrame);
      dragFrame = null;
    }
    sliderBar.style.setProperty("--SliderProgress", percentage.toString());
    setIconForVolume(percentage);
    commitVolume(percentage, true);
  };

  sliderBar.addEventListener("mousedown", handleDragStart);
  sliderBar.addEventListener("touchstart", handleDragStart);

  const pollInterval = targetWindow.setInterval(updateFromVolume, 250);

  cleanupFn = () => {
    targetWindow.clearInterval(pollInterval);
    sliderBar.removeEventListener("mousedown", handleDragStart);
    sliderBar.removeEventListener("touchstart", handleDragStart);
    targetDocument.removeEventListener("mousemove", handleDragMove);
    targetDocument.removeEventListener("touchmove", handleDragMove);
    targetDocument.removeEventListener("mouseup", handleDragEnd);
    targetDocument.removeEventListener("touchend", handleDragEnd);
    if (dragFrame !== null) {
      targetWindow.cancelAnimationFrame(dragFrame);
      dragFrame = null;
    }
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
