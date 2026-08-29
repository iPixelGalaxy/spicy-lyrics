# Low-frame-rate lyric flash diagnosis

Audience: Spicy Lyrics maintainer

Date: 2026-08-28

## Answer

The prior fix set `--active-gradient-position` to raw line progress, from `0%` to `100%`. The word renderer uses `-20%` to `100%`. A delayed frame promoted a new line with a value ahead of its word gradient, exposing the bright portion of the line gradient.

## Evidence

- Commit `0457693` added `--active-gradient-position` before applying the `Active` class in both animator branches.
- The same commit used `getProgressPercentage(...) * 100`, producing `0%` through `100%`.
- Syllable words calculate their non-simple gradient as `-20 + 120 * percentage` in `LyricsAnimator.ts`.
- `Mixed.css` initializes non-sung lines at `-20%` and uses the gradient position in each line and word background.

## Fix

Both line branches now set `--active-gradient-position` with `-20 + 120 * percentage` before adding `Active`. The line and word gradient positions now start and progress on the same scale.

## Limitation

The build validates TypeScript and bundling. Reproducing the low-frame-rate paint sequence requires the affected user environment.
