

# iPixel Spicy Lyrics Dev Channel

> **This is an unofficial development build of Spicy Lyrics**, maintained by iPixelGalaxy (but imma be so fr, this is claude code doing all the heavy lifting, I'm just a guy with too many ideas).
> It runs alongside the official version and gives you access to features before they ship to stable.

---

## Installation

### Step 1 — Remove Spicy Lyrics from the Marketplace

> Skip this step if you haven't installed Spicy Lyrics before.

If you have Spicy Lyrics installed from the **Spicetify Marketplace**, uninstall it first — running both at the same time will cause conflicts.

1. Open Spicetify Marketplace
2. Go to the **Extensions** tab and find Spicy Lyrics
3. Click **Uninstall**

---

### Step 2 — Install this build manually

1. Make sure [Spicetify](https://spicetify.app) is installed
2. Download the extension file: **[spicy-lyrics-pixel.mjs](https://ipixelgalaxy.com/TempFiles/spicy-lyrics-pixel.mjs)**
3. Move the file into your Spicetify Extensions directory
   - Find the correct path here: [spicetify.app — Manual Installation](https://spicetify.app/docs/customization/extensions#manual-installation)
   - Or run `spicetify config-dir` to open the path
4. Run the following commands in your terminal:
   ```
   spicetify config extensions spicy-lyrics-pixel.mjs
   spicetify apply
   ```

---

### Step 3 — Connect to the iPixel Dev build channel

Once the plugin is loaded, you need to point it at the dev server:

1. In Spotify, go to **Settings** (the cog icon in the top-right)
2. Scroll down until you see the **Spicy Lyrics** section
3. Click **Open Settings**
4. Scroll to the bottom and find **Build Channel** under the **Advanced** section, then click **Manage**
5. If the custom channel controls are hidden, right-click the **Build Channel** label seven times quickly to unlock custom channels
6. Enter `ipixelgalaxy.com` as the server URL
7. Check the **"Use the same host for both API and Storage"** box
8. Name the branch something like **`iPixel Dev`**
9. Click **Save Channel**
10. Click **Apply & Reload** — Spicy Lyrics will restart on the dev channel

---

## Staying on the Official Version

This build is designed to **coexist with the official Spicy Lyrics release**. If you run into a serious bug or just want to fall back, you can switch back to the Stable channel from within the Build Channel settings at any time — no reinstall needed.

---

> Built on the `dev` branch. Features here may be unstable, incomplete, or subject to change before reaching the official release (if ever 💀, lowkey, this is just my playground).

## What's New

## v100.10.40

- **In-app community profiles**
  Contributor profiles now open directly inside Spotify instead of sending you to a browser. Fallback to browser if it fails to fetch the profile.

- **Build Channel controls redesigned**
  The Advanced settings section now places Build Channel at the top, with an inline branch dropdown and a Manage button.

- **Branch manager**
  Manage Branches now lists Stable, Beta, and all saved custom branches in one place. You can switch branches directly, see the active branch as Selected, add new branches, and remove custom branches.

- **Protected built-in branches**
  Stable and Beta remain available in the manager but cannot be removed.

- **Stable-plugin support**
  The entrypoint adds the same channel selector and branch manager to the upstream Stable plugin settings, without modifying the upstream plugin.

- **Safer Musixmatch fallback**
  Musixmatch results are rejected when they belong to the wrong track, preventing mismatched lyrics from appearing.

- **Lyric timing restored**
  Restored upstream lyric timing behavior.

- **Custom font improvements**
  Added a webfont source option and disabled synthetic font styling for more faithful custom-font rendering.

## v100.10.39

- **Updated to be inline with 6.3.12 to follow API changes**

- Add settings hiding, with a manager, restore controls, live edits, and search access.

- Remove the nonfunctional Timeline Outside Media Box option.

- Fixed brief white flash on next active lyric line during low frame rates.

- **Unique Word Filters**
  Added `Gibberish`, `all lowercase`, `ALL UPPERCASE`, and `Off`.

- **Settings layout**
  Moved Space Gravity and Unique Word Filters to top of Lyrics Display. Dropdowns now size left for longer options.

<details>
<summary>v100.10.38</summary>

### v100.10.38

- Updated to be inline with 6.3.10

- **Split gibberish words**
  Space Gravity now separates gibberish lyrics into individual words.

</details>

<details>
<summary>v100.10.37</summary>

### v100.10.37

- **Space Gravity Mode**
  Refined word physics, pacing, rotation, density, cover-art avoidance, control clearance, lyric seeking, credits, and overlapping-line highlighting.

- **Better word handling**
  Space Gravity now preserves generated-word, CJK, and TTML word boundaries. Fixed missing characters and romanization alignment.

- **DJ cover colours**
  Now Playing and fullscreen lyrics use DJ cover-art colours without canvas rendering. Fixed DJ release-year display.

- **Cinema and popup fixes**
  Cinema settings now close correctly. Stale popup buttons no longer remain after startup.

</details>

<details>
<summary>v100.10.36</summary>

### v100.10.36

- **Space Gravity Mode**
  Improved word visibility, duet colours, instrumental endings, credits, cover avoidance, and switching mode without rebuilding lyrics.
  Line and static lyrics now use temporary word sync when Gravity needs it.

- **Instrumental dots**
  Restored smooth full dot animation and fade-out.

- **Lyric seek lead-in removed**
  Clicking lyrics now seeks at their exact timing point again.

- **Pinned credits**
  Improved final-lyric clearance and fade behavior.

- **Cinema**
  Cinema pop-out now disabled by default.

- **Scrollbar**
  Fixed hover visibility.

</details>

<details>
<summary>v100.10.35</summary>

### v100.10.35

- **Space Gravity Mode**
  An Appearance option lets synced lyric words drift freely from their normal line positions. It supports instrumental dots, background vocals, duet colouring, cover-art avoidance, and persistent credits.

- **Experimental Apple Music word sync**
  Apple Music lyrics can split combined words and hyphenated phrases into timed words. Bracketed backing vocals are recognised as background vocals, and credits note when word splitting helped.

- **Pinned lyric credits**
  Experiments can keep credits and source information visible while scrolling, with enough room to reach final lyrics.

- **Lyric click lead-in**
  Clicking a lyric now seeks 400ms before its timing point for a smoother handoff.

- **Added Extra Glow On Active Line**
  Added Extra Glow if hovering over active line

</details>

<details>
<summary>v100.10.34</summary>

### v100.10.34

- **Stable playback timeline**
  Fullscreen playback progress stays on Spotify's live clock when Playback Offset changes.

- **Local TTML spaces**
  Locally uploaded TTML keeps word boundaries from spaces inside timed spans, including word-synced lyrics.

- **Experimental SliderBar wording**
  The experimental progress-bar setting now uses the upstream SliderBar name and description.

</details>

<details>
<summary>v100.10.33</summary>

### v100.10.33

- **Updated for 6.3.0**
  Synced the fork with upstream 6.3.0 changes while retaining the fork's fullscreen volume placement options.

- **Fullscreen volume controls**
  Volume sliders now use the upstream volume icon inside a glass-style bar. Left, right, and below placements brighten on mouse activity, expand while hovered or dragged, and use matching thickness.

- **Rounded playback progress**
  The played portion of the fullscreen timeline now has rounded ends instead of a flat progress edge.

- **Experimental settings**
  Cinema Lyrics Window and Experimental Word Sync moved to Experiments. The Cinema setting now enables its playback-bar button directly and includes the DevTools help link. Popup Lyrics settings now describe their playback-bar button behavior.

</details>

<details>
<summary>v100.10.31</summary>

### v100.10.31

- **Configurable lyrics-view cache button**
  Advanced settings can now show a cache button in lyrics controls. Choose whether it clears current-song caches, current state, or stored cache.

- **Tighter settings dropdowns**
  Settings dropdowns now resize to the selected option instead of reserving space for their longest option.

- **Faster multi-source lyric loading**
  Enabled lyric sources now start together while configured priority and Apple Music quality rules still choose the result.

- **Scroll to active lyric control**
  When the active lyric leaves the viewport, a directional button can bring it back into view. Enabled by default and configurable in settings.

- **Lyric-shaped loading preview**
  Lyrics now show a shimmer preview shaped from the first available lyric source while the final result is selected.

- **Stable lyric updates**
  Reloading lyrics or changing romanization keeps the current reading position instead of briefly jumping to the top. Lines ending at the same time no longer leave one line raised.

- **Local TTML romanization parsing**
  Locally uploaded TTML now reads nested romanization data.

- **Smoother lyric loading handoff**
  Loading previews now clear cleanly before the finished lyric view appears.

</details>

<details>
<summary>v100.10.30</summary>

### v100.10.30

- **NPV lyrics reopen stability**
  Collapsing and reopening the Now Playing View lyrics card now keeps the loaded lyrics ready instead of rebuilding the renderer.

- **Local TTML romanizations**
  Romanizations included in locally uploaded TTML files are available in the lyrics renderer.

---

</details>

<details>
<summary>v100.10.29</summary>

### v100.10.29

- Updated to be in line with Spicy Lyrics 6.2.3.

---

</details>

<details>
<summary>v100.10.28</summary>

### v100.10.28

- Updated to be in line with Spicy Lyrics 6.1.1.

---

</details>

<details>
<summary>v100.10.27</summary>

### v100.10.27

- **External Cinema Lyrics window**
  Added a new playbar button that opens Spicy Lyrics in a separate cinema-mode window. You can move it to another display or fullscreen it while keeping the main Spotify window interactable.

---

</details>

<details>
<summary>v100.10.26</summary>

### v100.10.26

- The new starting point, all older changes merged into one easy to read list at the bottom.

---

</details>

<details>
<summary>Major Features</summary>

## Features

- **Persistent / temporary / session TTML load modes reworked to require less clicks**  
  The Load TTML modal now supports the following options for one click loads:
  - **Persistent Load**: saves to the local TTML database.
  - **Temporary Load**: applies to the current song until refresh.
  - **Session Load**: applies to the current track until Spotify restarts.
  - **Load TTML modal is more direct**
  The upload flow now clearly exposes Guide, Reset TTML, TTML Database, and the three upload modes.

- **Iframe profile modal**  
  Community maker/uploader profiles can open in an in-app iframe modal instead of always opening externally.

- **Experimental word sync**  
  Added an **Experimental Word Sync** setting that can convert line-synced or static lyrics into generated word-by-word sync using timing distribution and Spotify audio analysis where available.

- **Custom font setting**  
  Added **Use Custom Font** and **Font Name** controls. Empty font names now fall back cleanly to the bundled/Spotify-style font path instead of leaving the renderer in a broken custom-font state.

- **Configurable lyrics source priority**  
  Added a full **Manage Sources** flow for choosing the lyric provider order and disabling individual sources. The default order is now **Spicy Lyrics → Musixmatch → Apple Music → Spotify → LRCLIB → Netease**, with LRCLIB and Netease disabled by default.

- **Additional lyrics providers**  
  Added external source support for **Musixmatch**, **Apple Music**, **Spotify**, **LRCLIB**, and **Netease**, alongside the Spicy Lyrics API. Provider results are normalized into the existing lyrics formats and tagged with source metadata.

- **Source-specific settings**  
  Added expandable source settings inside Manage Sources:
  - **Musixmatch Token** field with a **Refresh** button.
  - **Ignore Musixmatch Word Sync** toggle.
  - **Prioritize Apple Music Quality** toggle.

- **Gibberish lyrics mode**  
  Added **Gibberish Lyrics Mode**, including a large word transformation dictionary and support for applying transformed text through static, line, and syllable lyrics.
</details>

<details>
<summary>Customization / Small Features</summary>

## Customization / Small Features

- **Lyrics hover pill toggle**  
  Added a setting to show a pill-style background when hovering lyrics.

- **Fullscreen close animation toggle**  
  Added an option to animate closing fullscreen instead of always closing instantly.

- **Release year display**  
  Added a **Release Year Position** setting to show album release year near NowBar metadata.

- **Always-show fullscreen controls/time**  
  Added **Always Show In Fullscreen** options so time, controls, or both can stay visible in fullscreen/cinema layouts.

- **Cover art animation toggle**  
  Added a setting to enable or disable NowBar cover art transitions.

- **Fullscreen volume slider**  
  Added a fullscreen/cinema volume slider with placement options: **Off**, **Left**, **Right**, and **Below**.

- **Background mode selector**  
  Added a unified **Background Type** setting with **Default**, **Legacy**, **Auto**, **Artist Header**, **Cover Art**, and **Color** modes.

- **Escape key behavior setting**  
  Added configurable Escape behavior: **Default**, **Exit Fullscreen**, or **Exit Fully**.

- **Lyrics source credit display**  
  Lyrics now display clearer provider/source information, including Spicy Lyrics, Spotify, Apple Music, Musixmatch, LRCLIB, Netease, and Local DB labels.

- **Right-align lyrics toggle**  
  Added a setting that flips/opposes lyric alignment for duet-style layouts.

- **Musixmatch token refresh**  
  Added automatic/manual Musixmatch token refresh support. If no user token is stored, Spicy Lyrics can refresh and persist a usable token.

- **Apple Music quality preference**  
  Added quality scoring so Apple Music can be preferred when it has equal or better timing quality. Apple Music only wins equal-quality ties when the lyrics contain real line-ending pauses.

- **v2.0 entrypoint**  
  Added `builds/v2.0/entrypoint.mjs`, which can fetch versions from a selected channel, load the matching remote bundle, expose channel settings, and support fixed-version custom channels.

</details>

<details>
<summary>Bug Fixes</summary>

## Bug Fixes

- **Fixed settings-owned modals lingering across navigation**  
  Settings, Build Channel, Manage Sources, and settings-owned TTML Database modals close when navigating away from relevant Spicy Lyrics routes.

- **Romanization compatibility improvements**  
  Added normalization for legacy romanization fields so older `RomanizedText` / `IncludesRomanization` payloads still populate the newer transliteration fields.

- **Fixed default dynamic background staying grey on local tracks**  
  Default mode now handles `spotify:localfileimage:` URLs explicitly by loading the image without Kawarp's forced cross-origin path and passing the loaded image element into Kawarp.

- **Fixed local art timing race**  
  The NowBar now emits a cover-art-ready event after resolving the real display image. Dynamic backgrounds reapply for local tracks when that event fires, so the background does not get stuck on an early placeholder/empty state.

- **Fixed metadata marquee measurement**
  NowBar song/artist marquee behavior now uses resize observation and actual scroll widths to avoid unnecessary marquee or clipped metadata.

- **Fixed popup/PiP button visibility sync**  
  The popup lyrics setting now registers/deregisters the Spicy popup button and toggles Spotify's PiP button consistently.

- **Fixed musical/interlude line seek behavior**  
  Instrumental/dot-line style lyrics are handled more carefully so they do not behave like normal seekable vocal lines.

</details>

<details>
<summary>Quality of Life</summary>

## Quality of Life

- **Fixed auto-scroll jumping upward for background vocals**  
  If a background vocal above the current foreground line remains active, the renderer no longer scrolls upward automatically and creates a jarring jump.

- **Fixed renderer word activation feeling delayed**  
  Word activation now leads playback timing slightly and uses retuned spring values for a more responsive but still smooth feel.

- **Local FLAC detection**  
  Added local FLAC detection based on metadata/file signatures so local FLAC behavior can be handled differently where Spotify's local playback behavior is unreliable.

- **TTML profile / community credit improvements**  
  Lyrics can show richer community metadata, maker/uploader profile links, source labels, and experimental word-sync notices.

- **Client-side TTML parsing**  
  Added a client-side TTML parser so uploaded TTML files can be parsed in Spotify without needing to send them through the server first.

- **Settings panel redesign and regrouping**  
  Settings are now grouped into **Appearance**, **Lyrics Display**, **Interface**, and **Advanced**, with search and section filtering.

- **TTML database access from settings**  
  Added **Browse TTML Database** to the Advanced settings section, including modal navigation from settings into the database and back again.

- **Back navigation for settings-owned modals**  
  Manage Sources and Browse TTML Database can return to the settings modal while preserving the previous scroll position, which matters because these entries live near the bottom of the settings panel.

- **Settings search covers new source/provider names**  
  Search can find Manage Sources and individual provider labels/descriptions.

- **Advanced settings are less cluttered**  
  Cache actions, Manage Sources, Browse TTML Database, Build Channel, and Developer Mode are grouped together.

- **Background and cache sections were folded into better groups**  
  The old separate Background and Cache sections were removed in favor of the consolidated Appearance and Advanced sections.

- **TTML database navigation feels modal-native**  
  Switching between Load TTML, TTML Database, and Settings uses modal transitions instead of closing/reopening the entire overlay.

- **Experimental word sync warns users**  
  Generated word sync displays a notice explaining that line/static lyrics were automatically converted.

- **Release year lookup is cached**  
  Album release years are cached in the NowBar so repeated metadata renders do not keep hitting the lookup path.

- **Fullscreen media controls respect compact/PiP constraints**  
  Timeline, playback controls, and volume slider placement now avoid layouts where those controls do not fit.

</details>

<details>
<summary>More random notes of nerds</summary>

## Random Notes for Devs (idk what I'm doing but this is stuff that happen)

- **New release build wrapper**  
  `package.json` now routes `build` and `build:release` through `node project/build.mjs`, while `build:creator` keeps the raw Spicetify Creator build.

- **Versioned build output script**  
  Added `project/build.mjs`, which accepts `--version`, injects `SPICY_LYRICS_BUILD_VERSION`, copies the versioned bundle, and writes a `version` file.

- **Spicetify Creator version injection**  
  `spice.config.ts` now reads `process.env.SPICY_LYRICS_BUILD_VERSION` before falling back to `ProjectVersion`.

- **Entrypoint moved to v2.0**  
  `builds/spicy-lyrics.mjs` now imports `builds/v2.0/entrypoint.mjs`.

- **Added extension metadata file**  
  Added `src/settings.json` with extension name, id, and description metadata.

- **Centralized persisted settings atoms**  
  Added/expanded nanostore-backed settings in `src/utils/stores.ts`, including migration for old key names like `skip-spicy-font` and `show_npv_dynamic_bg`.

- **Added storage compatibility wrapper**  
  Added `src/utils/storage.ts` to bridge older `SpicyLyrics-*` storage calls into the new nanostore-backed settings where needed.

- **Defaults are now bound live to stores**  
  `app.tsx` binds settings stores into `Defaults`, allowing many settings to apply immediately without reload.

- **Legacy static background compatibility writes**  
  Fork background settings are mirrored into old `SpicyLyrics-staticBackground` keys so switching back to official/stable builds behaves predictably.

- **Removed old update checker module**  
  `src/utils/version/CheckForUpdates.tsx` was removed. Version notification now happens through the startup version comparison/update dialog flow.

- **Modal component gained transition support**  
  `PopupModal` now supports content transitions, modal ids, header-left content, custom close handlers, and restoring scroll positions.

- **Modal ids enable targeted styling/navigation behavior**  
  Settings, Build Channel, Lyrics Sources Manager, and settings-owned TTML Database modals now get dedicated modal classes.

- **Build Channel opener utility**  
  Added `openBuildChannelPanel.tsx` to mount the Build Channel panel in the shared modal system.

- **Lyrics Sources opener utility**  
  Added `openLyricsSourcesManager.tsx` to mount Manage Sources with a settings-aware back button.

- **TTML Database opener utility expanded**  
  `openLyricsDBPanel.tsx` now handles settings-aware open/back behavior and scroll restoration.

- **Lyrics source preference helpers**  
  Added `LyricsSourcePreferences.ts` for provider definitions, source order normalization, disabled-source normalization, and label resolution.

- **Lyrics source cache versioning**  
  Added a source cache version/signature to avoid reusing provider caches across incompatible source-setting changes.

- **In-flight lyrics fetch deduplication**  
  `fetchLyrics` now tracks active fetch promises by song key to prevent duplicate fetches from racing each other.

- **Song-key helper for local tracks**  
  Added `getSongKey()` so local tracks can use the full local URI as their stable id instead of incorrectly using `uri.split(":")[2]`.

- **Session TTML store**  
  Added `SessionTTMLStore` for session-only TTML loads.

- **Shared lyrics presentation helper**  
  `fetchLyrics` now uses a common presentation path for cached, session, local database, and freshly fetched lyrics.

- **Client TTML parser implementation**  
  Added `src/utils/Lyrics/ParseTTML.ts`, with timestamp parsing, iTunes metadata parsing, translations/transliterations, songwriter metadata, background vocals, and syllable extraction.

- **TTML manager parser updates**  
  Existing manager TTML parser now routes through the newer parsing behavior.

- **Experimental word sync implementation**  
  Added `src/utils/Lyrics/ExperimentalWordSync.ts` with timing distribution, bracket/background-vocal parsing, static lyric timing generation, and audio-analysis support.

- **Gibberish transform implementation**  
  Added `src/utils/Lyrics/GibberishTransform.ts`, including dictionary and phonetic fallback logic.

- **Lyrics apply path now guards against stale URI application**  
  `ShouldApplyLyricsForUri` and `ApplyLyricsIfCurrent` protect against async responses applying to the wrong current track.

- **Lyrics apply path can mutate alignment**  
  Right-align mode flips `OppositeAligned` values before rendering.

- **Syllable rendering now supports generated/gibberish fields**  
  Syllable apply logic understands `GibberishText`, `experimentalWordSync`, source fields, and optional word joining/reduction helpers.

- **Static and line renderers support extra metadata**  
  Static/line apply paths were updated for source info, gibberish text, experimental sync notices, and user-uploaded metadata.

- **Lyrics virtualizer adjustments**  
  Virtualizer behavior was adjusted to work with the updated renderer/apply flows.

- **Audio analysis cache pruning**  
  Dynamic background/audio analysis code now prunes cache entries for inactive tracks and avoids stale async speed updates.

- **Dynamic background loader wrapper**  
  Added a `loadKawarpCover` helper that selects the correct Kawarp loading path for normal web images, `blob:`/`data:image`, and `spotify:localfileimage:` images.

- **Kawarp map cleanup improvements**  
  Dynamic background disposal/removal now removes stale Kawarp instances when switching modes or reapplying backgrounds.

- **Blob URL cache normalization**  
  `BlobURLMaker` caches by normalized URL and avoids trying to fetch non-image Spotify URI schemes.

- **Fullscreen volume slider utility**  
  Added `src/components/Utils/VolumeSlider.ts` for reusable slider setup/cleanup.

- **Fullscreen exported refresh hooks**  
  Fullscreen now exports refresh helpers so settings changes can immediately update controls/volume layout.

- **NowBar component lifecycle cleanup**  
  NowBar now tracks active playback controls, timeline, heart state, release-year cache, and marquee observers more explicitly.

- **NowBar cover-art event**  
  NowBar emits `nowbar:cover-art` after resolving cover art so other systems can react after artwork is ready.

- **Session/navigation behavior expanded**  
  Session/PageView/app navigation logic was updated to support Escape behavior, settings-owned modal close behavior, and correct Spicy Lyrics route state.

- **Data migration touched for new settings shape**  
  Migration code was updated to account for the new settings/store layout.

- **Edited settings package integration**  
  The edited `spcr-settings` section component was adjusted for the redesigned settings entry.

- **CSS updates for the redesigned UI**  
  `ContentBox.css`, `settings-panel.css`, dynamic background CSS, lyrics CSS, and default CSS were expanded for the new modals, settings cards, source stacks, fullscreen controls, volume slider, cover transitions, and background modes.

- **Removed obsolete settings sections**  
  Deleted `BackgroundSection.tsx` and `CacheSection.tsx` after moving those controls into consolidated sections.

- **Lockfile/package updates**  
  `bun.lock` and `package.json` changed to reflect the updated build scripts/dependency state.

</details>
