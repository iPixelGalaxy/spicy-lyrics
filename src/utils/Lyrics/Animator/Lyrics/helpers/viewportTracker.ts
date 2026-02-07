/**
 * Index-based viewport tracking for lyrics animation culling.
 * Uses offsetTop (no reflow) instead of getBoundingClientRect (causes reflow).
 */

const VIEWPORT_BUFFER = 3; // lines above/below visible range

let _visibleStart = 0;
let _visibleEnd = 0;
let _frameCount = 0;
const UPDATE_EVERY_N_FRAMES = 5;

/**
 * Update the visible line index range based on scroll container state.
 * Should be called every frame; internally throttles to every N frames.
 * @param scrollContainer The scrollable container element
 * @param lines Array of line objects with HTMLElement property
 * @param forceUpdate Skip throttling and update immediately
 */
export function updateViewportRange(
  scrollContainer: HTMLElement | null,
  lines: Array<{ HTMLElement: HTMLElement }>,
  forceUpdate = false
): void {
  _frameCount++;
  if (!forceUpdate && _frameCount % UPDATE_EVERY_N_FRAMES !== 0) return;

  if (!scrollContainer || lines.length === 0) {
    _visibleStart = 0;
    _visibleEnd = lines.length - 1;
    return;
  }

  const scrollTop = scrollContainer.scrollTop;
  const viewHeight = scrollContainer.clientHeight;
  const viewBottom = scrollTop + viewHeight;

  let firstVisible = -1;
  let lastVisible = -1;

  for (let i = 0; i < lines.length; i++) {
    const el = lines[i].HTMLElement;
    if (!el) continue;

    // offsetTop is relative to the offsetParent, which avoids forced reflow
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;

    // Check if the line overlaps with the visible area
    if (bottom >= scrollTop && top <= viewBottom) {
      if (firstVisible === -1) firstVisible = i;
      lastVisible = i;
    } else if (firstVisible !== -1) {
      // Once we've found visible lines and gone past them, stop
      break;
    }
  }

  if (firstVisible === -1) {
    // No lines visible — default to all lines to avoid skipping animation
    _visibleStart = 0;
    _visibleEnd = lines.length - 1;
    return;
  }

  // Apply buffer
  _visibleStart = Math.max(0, firstVisible - VIEWPORT_BUFFER);
  _visibleEnd = Math.min(lines.length - 1, lastVisible + VIEWPORT_BUFFER);
}

/**
 * Check whether a line at the given index is within the current viewport range.
 */
export function isLineInViewportRange(index: number): boolean {
  return index >= _visibleStart && index <= _visibleEnd;
}

/**
 * Reset the viewport tracker state (call on lyrics change/reset).
 */
export function resetViewportTracker(): void {
  _visibleStart = 0;
  _visibleEnd = 0;
  _frameCount = 0;
}

/**
 * Get the current visible range for debugging.
 */
export function getViewportRange(): { start: number; end: number } {
  return { start: _visibleStart, end: _visibleEnd };
}
