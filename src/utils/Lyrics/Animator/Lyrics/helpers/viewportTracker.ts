/**
 * Active-line-based processing range for lyrics animation culling.
 * Instead of measuring DOM positions (fragile with SimpleBar),
 * we center the processing window around the currently active line index.
 * Only lines within the buffer are animated (springs, blur, glow, gradient).
 * State classes are always set for all lines (cheap).
 */

const PROCESSING_BUFFER = 5; // lines above/below active line to process

let _activeLineIndex: number | null = null;
let _totalLines = 0;

/**
 * Update the active line index for culling.
 * Call this when an active line is found during the animation loop.
 */
export function setActiveLineIndex(index: number, totalLines: number): void {
  _activeLineIndex = index;
  _totalLines = totalLines;
}

/**
 * Check whether a line at the given index is within the processing range.
 * Lines outside this range skip expensive spring/style work.
 */
export function isLineInViewportRange(index: number): boolean {
  // No active line known yet — process all lines until we find one
  if (_activeLineIndex === null) return true;

  return (
    index >= _activeLineIndex - PROCESSING_BUFFER &&
    index <= _activeLineIndex + PROCESSING_BUFFER
  );
}

/**
 * Reset the viewport tracker state (call on lyrics change/reset).
 */
export function resetViewportTracker(): void {
  _activeLineIndex = null;
  _totalLines = 0;
}

/**
 * Get the current active line index for debugging.
 */
export function getActiveLineIndex(): number | null {
  return _activeLineIndex;
}
