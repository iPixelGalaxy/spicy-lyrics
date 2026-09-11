# Default animator upstream audit

## Findings

The fork did introduce changes that reduce motion. Commit `526f804` changed idle word and emphasis scale from `0.95` to `1`, and added `scale: 1 !important` to joined syllables and their letters. At the unchanged ordinary-word peak of `1.0505`, the curve's idle-to-peak span fell from `0.1005` to `0.0505`, almost half. The CSS override suppressed scale animation completely for matching tokens, regardless of spring output. These are confirmed source changes, not a measurement of perceived animation quality or actual spring overshoot. [1][2]

Commit `607e183` restored those two behaviors for Default, but its claim of complete upstream parity was premature. It left fork geometry adjustments enabled under Default, did not invalidate cached Custom blur, and added model traversal to an immediate module-initialization subscription. The previous approved plan also required an exact Simple-mode peak literal and detached-element updates; the implementation did not fully provide them. [3]

The current fix addresses those remaining differences without inventing stronger springs. It does not establish that any one of them caused the reported live symptom: no affected song, active preset, or live playback trace was available during the investigation.

## Reference and comparison boundaries

The reference is Spikerko/spicy-lyrics `main`, commit `2a14863f8c29782f9ab3becff2b1360dfb74a4fb`, verified against the upstream remote HEAD. That revision is the 6.3.15 merge. The local upstream reference matches that SHA. Comparisons covered the animator, spring integrator, lyric setter, render loop, emphasis construction, lyric CSS, virtualizer, and relevant history. [1]

For equivalent lyric data and settings, upstream uses:

| Parameter | Upstream value |
| --- | --- |
| Word and emphasis idle scale | `0.95` |
| Word peak scale | `1.0505` |
| Emphasis peak scale | `1.175` |
| Simple-mode emphasis peak | `1.07` |
| Scale frequency / damping | `0.88 Hz` / `0.64` |
| Vertical frequency / damping | `1.45 Hz` / `0.4` |
| Glow frequency / damping | `1.18 Hz` / `0.56` |

These spring constants were already present in the fork. Upstream itself introduced their tuning in `fe88e20`; they are not evidence of a recent fork bug fix weakening the springs. The spring integration equations and the lyric state setter match upstream, apart from the fork's additive `SetTuning` method. Existing dot and line animation formulas also match. [1][4]

## Remaining defects and changes

### Geometry changes survived Default selection

The font-overhang correction adds `0.3em` horizontal padding and negative margins, plus `0.15em` vertical padding and negative margins, to animated words, letters, and letter groups. A separate line-synced correction adds vertical padding and compensating line margins. These corrections were restored by `5c8090a` and remained active under Default after `607e183`. [3][5]

Negative margins compensate layout space; they do not make a padded transform reference box identical to the original box. This matters particularly for split syllables using left/right transform origins and nested letter-group transforms. The specification supports a geometry difference, but does not prove it subjectively reduces liveliness. [6]

The audit patch excluded these padding and margin corrections from Default. A subsequent requested compatibility fix restores them for all presets to prevent clipping with wide or overhanging glyphs. This is an intentional geometry exception to upstream parity; upstream curves, spring tuning, and transform origins remain unchanged. Default still excludes joined-syllable scale suppression.

### Custom blur survived a preset switch

`Animate` calls `applyBlur` when `Blurring_LastLine` changes. Switching presets changed resolved tuning but did not clear that index. During the same active line, a previous Custom blur could therefore remain visible until a line change or virtualizer mount. Changing only compositor hints did not force a recalculation. [3][7]

Tuning changes now invalidate the blur index and affected style caches/queues. The next normal animation frame reapplies the resolved values. Active word/letter springs are retuned without discarding their current position or velocity. Dot and line springs keep their upstream-specific constants.

### Initialization and detached lyrics

`lyrics.ts` imports the animator, which in turn imports `LyricsObject` from `lyrics.ts`. The immediate `subscribe(rebuildAnimatorTuning)` callback added in `607e183` traversed that object during module initialization. Depending on evaluation order, the model can still be uninitialized. This is a circular-initialization hazard established by source inspection, not a captured runtime exception. [3]

Initial curve construction now reads only tuning and curve data. Live model traversal runs in a non-immediate listener after a tuning change. It visits connected and detached lyric models, retunes existing springs, and updates unsung scales, including letter-group parents and individual letters. PageView no longer writes scales independently of the animator's caches. Newly constructed lyrics continue to use preset-aware idle scales.

### Default must not derive from editable defaults

The old resolver treated Default and Pixel alike, deriving both from the Custom parameter registry. It also mutated shared curve arrays and calculated Simple-mode emphasis peak as `letterPeakScale - 0.105`. The tiny numerical difference from literal `1.07` is not a credible explanation for a visible loss of liveliness, but violates an exact-literal baseline. [7]

Default now resolves a frozen upstream tuning snapshot. The original curve arrays remain unmodified; Default uses them directly. Pixel/Custom build adjusted curves separately. Simple-mode changes rebuild from the selected preset so they cannot restore stale or inappropriate curve data. Saved Custom values, import formats, and suggested slider ranges are unchanged.

## History checked but not blamed

The low-FPS timing lead and gradient changes were removed by later history; they are not still present in the compared core animation loop. Earlier wrapped-row origin corrections were also subsequently removed. Reverting every commit named “fix” would reintroduce old problems without establishing a cause. [8]

Generated experimental word timing intentionally disables letter emphasis in this fork. Native syllable lyrics use upstream's duration-based emphasis eligibility. Synthetic timings, alternate sources, fonts, Simple mode, and Space Gravity are not equivalent playback inputs. That distinction remains; this patch does not silently alter synthetic timing policy.

## Verification and limits

Source comparison establishes the upstream constants, unchanged integration equations, historical scale suppression, geometry difference, and missing invalidation path. `bun run build -test Y:\website` passed and copied the test bundle to `Y:\website` (231 modules transformed). No tests were added or run. A successful bundle cannot establish visual parity or reproduce module evaluation in Spotify.

No Spotify debugging endpoint was available on the checked local ports. The remaining visual acceptance check is the same track and lyric source, Default selected, matching Simple-mode settings, and optional effects disabled. Check cold startup, a sustained emphasized word, split syllables, backing vocals, dots, and switching from extreme Custom tuning back to Default while the same line remains active. Also inspect future lines after scrolling them back into view and moving the page into a popout. Active springs retain motion history during switching; a cold start is the cleanest baseline comparison.

## Sources

1. Spikerko. [Upstream main, 6.3.15 merge](https://github.com/Spikerko/spicy-lyrics/commit/2a14863f8c29782f9ab3becff2b1360dfb74a4fb), 2026-09-08. [Animator source at that revision](https://github.com/Spikerko/spicy-lyrics/blob/2a14863f8c29782f9ab3becff2b1360dfb74a4fb/src/utils/Lyrics/Animator/Lyrics/LyricsAnimator.ts). Remote HEAD and files also inspected through local Git.
2. iPixelGalaxy. Local Git commit `526f804fb2d86d3ee684cea977b9767287c8235d`, “Refine Animator”; animator, shared constants, and Mixed.css diff.
3. iPixelGalaxy. Local Git commit `607e183e5938e4143dfaa9627d93301004eb7a97`, “Match default animator upstream”; full patch and parent comparison.
4. Spikerko. Local upstream Git commit `fe88e204ef59f3979cbd03d73f5a735d92b14ad2`, “Tune lyrics animation springs and offsets”, 2026-06-14.
5. iPixelGalaxy. Local Git commit `5c8090a4b1e43120104bcdf01ec49c06749160f1`, “Restore experimental lyric animation”; Mixed.css patch.
6. CSS Working Group. [CSS Transforms Module Level 1: transform-origin](https://drafts.csswg.org/css-transforms/#transform-origin-property), accessed 2026-09-10.
7. iPixelGalaxy. Local Git commit `08f53f0`, “Add animator presets”, and Tuning.ts/LyricsAnimator.ts at `607e183`; resolution, refresh, and cache paths.
8. iPixelGalaxy. Local Git commits `9c4e67c`, `cdacd86`, `58b70ed`, and `9022a64`; timing, gradients, and transform-origin restoration history. These records are cited as local repository evidence; no public availability is assumed.
