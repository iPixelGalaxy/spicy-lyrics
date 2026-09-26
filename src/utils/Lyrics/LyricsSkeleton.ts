import { isExperimentEnabled } from "../experiments.ts";

const DEFAULT_LABEL = "Loading Lyrics";

// Fixed widths so the placeholder reads like ragged lyric lines and never reshuffles.
const LINE_WIDTHS = [74, 58, 86, 49, 68, 81, 55, 72, 63, 84, 52, 77, 66, 88, 57, 70];

export const SkeletonMarkup = `
  <div class="LyricsSkeleton" aria-hidden="true">
    <div class="SkeletonLines" aria-hidden="true">
      ${LINE_WIDTHS.map((w, i) => `<div class="SkeletonLine" style="width: ${w}%; --i: ${i}"></div>`).join("")}
    </div>
    <div class="SkeletonStatus" role="status" aria-live="polite">
      <span class="SkeletonLabel">${DEFAULT_LABEL}</span><span class="SkeletonDots" aria-hidden="true"><i></i><i></i><i></i></span>
    </div>
  </div>`;

export const IsLyricsSkeletonEnabled = () => isExperimentEnabled("lyricsSkeleton");
