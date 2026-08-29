# Low-frame-rate lyric flash: upstream comparison

Audience: Spicy Lyrics maintainer

Date: 2026-08-28

## Answer

The fork advanced all active-line state by 67ms. Upstream uses playback position plus the user timing offset. This fork-only lead promotes the next line before its first lyric frame and is the remaining candidate after the earlier gradient patch failed.

## Evidence

- Fork commit `b7a30c8` introduced `AnimationResponseLeadMs = 67` and added it to `findActiveElement()` and `Animate()`.
- `upstream/main` uses `currentTime + timeOffset` in `findActiveElement()` and `position + timeOffset`, with a 33.5ms Simple Lyrics adjustment, in `Animate()`.
- The fork-only lead is applied before every line, word, and letter active-state calculation.

## Fix

The renderer now uses upstream timing in both functions. The earlier fork-only active-gradient override is removed because it did not resolve the affected user's flash.

## Limitation

The build validates TypeScript and bundling. Reproducing the low-frame-rate paint sequence requires the affected user environment.
