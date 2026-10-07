// Match canvas wrappers when the NPV changes, rather than during every
// document-wide restyle. Album-cover pseudo-elements remain untouched.
const VISUAL_MARKERS = [
  { className: "spicy-npv-canvas-video", selector: "video" },
  {
    className: "spicy-npv-canvas-image",
    selector: [
      ".main-nowPlayingView-canvasVisualEnhancement div:has(> img)",
      '[data-testid="track-visual-enhancement"] + * div:has(> img)',
    ].join(", "),
  },
  {
    className: "spicy-npv-canvas-host",
    selector: [
      '.main-nowPlayingView-coverArtContainer:has(video, .main-nowPlayingView-canvasVisualEnhancement img)',
      'div:has(> [data-testid="track-visual-enhancement"]):has(video)',
      'div:has(> [data-testid="track-visual-enhancement"] + * img)',
    ].join(", "),
  },
  {
    className: "spicy-npv-canvas-overlay",
    selector: [
      ".main-nowPlayingView-coverArtContainer :is(div, .E08D6ucrHuPJYzzGO7HG):has(video)",
      "div.Of__Db4QgB9osz_mFxhw:has(video)",
      "div.UUydeXMsXVZofB0YAOgm:has(.main-trackInfo-container)",
      "div.main-nowPlayingView-contextItemInfo:has(.main-trackInfo-container)",
      ":is(.main-nowPlayingView-coverArtVisualEnhancement ~ *, .main-nowPlayingView-coverArtVisualEnhancement *, .main-nowPlayingView-coverArtVisualEnhancement ~ * *):not(.main-nowPlayingView-coverArtVisualEnhancement):is(:has(video, .main-nowPlayingView-canvasVisualEnhancement img), .main-nowPlayingView-canvasVisualEnhancement:has(img), .main-nowPlayingView-canvasVisualEnhancement :has(img)):not(.main-image-image.cover-art-image)",
      ':is([data-testid="track-visual-enhancement"] ~ *, [data-testid="track-visual-enhancement"] ~ * *):has(video, img)',
      '[data-testid="track-visual-enhancement"] *:has(video)',
    ].join(", "),
  },
];

export function SyncNPVVisuals(npv: HTMLElement | null): void {
  if (!npv) return;
  for (const { className, selector } of VISUAL_MARKERS) {
    const targets = new Set(npv.querySelectorAll<HTMLElement>(selector));
    for (const marked of npv.querySelectorAll<HTMLElement>(`.${className}`)) {
      if (!targets.has(marked)) marked.classList.remove(className);
    }
    for (const target of targets) {
      if (!target.classList.contains(className)) target.classList.add(className);
    }
  }
}
