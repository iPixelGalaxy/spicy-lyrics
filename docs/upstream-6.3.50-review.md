# Upstream 6.3.50 integration review

This branch merges upstream `52ba258f5736fef15320139c18ecf55eec798e3b` into the fork at `435aed5`. The settings-menu edit was saved separately in signed commit `3671164`. `backup/dev-before-6.3.50` records the original fork tip. The application version remains `100.10.45`.

The merge retains fork providers and source priority, animator presets, local TTML, experimental word splitting, Gravity, credits, background modes, volume controls, Cinema, and Picture-in-Picture. README and release notes remain unchanged. The local `AGENTS.md` is excluded from the tracked tree.

## Integration choices

- Smooth Scrolling and Early Scroll default off. Early Scroll retains 250 ms, adjustable from 0 to 800 ms. Seek compensation defaults on and seeks 300 ms early, clamped to zero, including Gravity clicks. Local FLAC seeking remains blocked.
- The existing Lyrics Display settings category contains the scrolling controls and seek compensation. The skeleton experiment and all new controls support search and hidden settings. The native Spotify lyrics-button setting defaults off.
- One loader controller owns both the skeleton and fallback spinner. It retains track ownership, queue messages, cancellation, owner-window scheduling, and presentation-specific exit timing. Successful fetching leaves the loader in place until rendering finishes. An exhausted provider search returns the queued state only when no enabled provider supplied lyrics.
- Fullscreen close reports completion or cancellation. Route changes tear down immediately; close-button, Escape, and metadata navigation respect cancelled closes. Fork Escape settings and optional exit animation remain available.
- Dynamic artwork starts a small-cover preview after 250 ms when the full cover is still pending. Serialized updates, current-track checks, instance ownership, and fork cover fallbacks protect background changes.
- The DOM TTML parser preserves romanization spaces and plain-text entries while excluding nested background vocals from lead text. Lyric-cache version 6 does not reset settings or saved TTML.
- `builds/main/entrypoint.mjs` contains the channel manager and recovery flow. Existing v1.1 and v2.0 entrypoints resolve that file within their own repository and branch. The public fork stub points to the Pixel fork. Custom channels use their configured hosts; pinned channels load their exact version without version polling. Only official, unpinned channels consult official outage status. A bundle that fails during initialization is not evaluated again in that session.

## Build result

`bun run build -test Y:\website` passed and copied the application bundle to `Y:\website`. No tests were added or run. The application build does not compile or execute the standalone launcher. The scenarios below remain manual review items, not claims of runtime verification.

## Manual review

- Check scrolling with both toggles off, then enable Smooth Scrolling and Early Scroll independently and together. Use 0, 250, and 800 ms; interrupt scrolling manually, resize the page, switch animator presets, and cross interlude boundaries.
- Click ordinary lyrics and Gravity words with compensation on and off. Check lyrics starting before 300 ms and confirm local FLAC seeking remains blocked.
- Load uncached and cached tracks, saved TTML, and tracks with no lyrics. Switch skeleton/spinner during loading and while queued. Skip tracks rapidly, go offline, and close or reopen the page during a fetch. Confirm fallback providers can resolve a queued primary source.
- Open Picture-in-Picture and Cinema, hide the Spotify window, and confirm lyrics, scrolling, and loader completion continue in the visible window. Recheck the three retained fixes: owner-window rendering, cancelled loading, and immediate auxiliary-lyric reveal.
- Close fullscreen with and without animation. Double-click Close, press Escape while closing, reopen immediately, and navigate elsewhere during the exit. Check each Escape mode, metadata links, volume dragging, and view-control tooltips.
- Throttle cover downloads and skip tracks during the preview. Close and reopen the page during loading. Check local covers, episodes, static and dynamic background modes, and transitions.
- Check every source ordering option, local TTML modes, romanization with plain text and nested background vocals, credits, experimental word splitting, Gravity, and all animator presets.
- In the standalone launcher, check normal startup, delayed Spicetify readiness, failed version requests, failed module downloads, retry/backoff, background recovery, and channel switching. A startup exception must show recovery without reevaluating the same bundle. An unpinned channel can report a newer fix; a pinned channel must offer reload/channel switching without querying a version endpoint. An official outage must not suppress custom-channel or pinned-bundle retries.

No push, release build, version change, or GitHub Actions are part of this review branch.
