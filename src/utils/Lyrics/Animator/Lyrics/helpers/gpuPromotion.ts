// Promote an element to its own compositor layer for GPU-accelerated animations
export function promoteToGPU(el: HTMLElement): void {
  // Hint to the browser that transform and opacity will change frequently
  el.style.willChange = "transform, opacity, text-shadow, scale";
  // Avoid costly repaints due to backface rendering
  el.style.backfaceVisibility = "hidden";
}

// Variant that also hints filter changes (useful for blur)
export function promoteToGPUWithFilter(el: HTMLElement): void {
  const existing = el.style.willChange?.trim();
  const desired = "transform, opacity, text-shadow, scale, filter";
  if (!existing || existing.indexOf("filter") === -1) {
    el.style.willChange = desired;
  }
  el.style.backfaceVisibility = "hidden";
}
