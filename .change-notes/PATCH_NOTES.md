## v100.10.44

### Upstream

- **Updated to upstream 6.3.20**
  Includes the latest upstream lyric handling, cache, and display changes.

### Cinema Lyrics Window

- **More reliable popout opening and closing**
  Closing the Cinema Lyrics Window while it is opening now cancels the pending setup. Switching to the main lyrics page or Picture-in-Picture transfers the view cleanly. A temporary rendering error no longer stops lyric updates.

- **Cover art no longer animates over itself**
  Opening Cinema no longer crossfades a track's cover art into the same image. Normal cover transitions still play when the track artwork changes.

### Lyrics and animation

- **Romanized-only lyrics remain visible**
  Lyrics that contain only a romanized form are kept and displayed instead of being removed as empty lines.

- **Gravity mode mounts after lyrics render**
  Space Gravity now waits for the lyric view to mount before taking over its layout.

### Animator presets

- **Preset sharing and clipboard actions fixed**
  Saved animator presets copy, import, and share without dropping their settings.

### Settings

- **Browser profile option**
  Add a browser profile in advanced settings and open community profiles with it.

## v100.10.43

- **Updated to upstream 6.3.15**

### Update popup

- **Patch notes after an update**
  The update popup now loads every patch-note entry between the installed and previous versions, with a scrollable reading area for larger updates.

- **Pixel Edition walkthrough**
  Updates from outside the 100.10 release series include a link to the Pixel Edition feature walkthrough.

### Settings

- **Settings sections reorganized**
  Appearance, Effects, Sources, and Advanced settings now appear in clearer sections with search and keyboard navigation. The panel has a pinned footer, tighter sizing, and a wider source manager.

- **Hide settings controls refined**
  Hidden settings filter correctly, protected controls stay available, and visual experiments can be hidden from the main panel.

### Lyric animation

- **Animator presets**
  Choose Default, Pixel, or Custom behavior. Custom presets can be edited, saved, loaded, shared, and imported. Default matches upstream animation behavior while Pixel keeps Spicy Lyrics behavior.

- **Smoother lyric transitions**
  Lyrics position before they reveal. Lines ending at the same time now finish their animation instead of leaving one line raised. The existing low-frame-rate flash protection remains in place.

- **Comma spacing**
  Lyric commas now keep correct spacing, including Unicode punctuation.

### Lyrics view

- **Refined view controls**
  Fullscreen controls have updated glass styling, wrapping, hover behavior, opacity, positioning, and rounded edges.

- **Credit reveals fixed**
  Community credit details load asynchronously and fade in place. Pinned provider and writer credits remain visible correctly.

- **Other fixes**
  The local TTML database back button now returns correctly. Source credits distinguish automatic splitting from provider-supplied timing.

## v100.10.42

### Reliability

- **Recover from damaged settings and cache data**
  Invalid settings, interface state, and cache records no longer block startup or lyric fetching. Valid stored fields remain intact when missing or incompatible fields are repaired.

- **Keep animation loops alive**
  Interval-driven UI no longer creates duplicate loops after a restart. A callback failure no longer freezes later updates.

- **Prevent stale lyrics after database changes**
  Deleting local TTML while changing tracks no longer applies results to the wrong song. Old database errors also clear when the track list becomes empty.

### Artwork

- **Prevent stale cover art**
  Rapid track changes no longer allow an older artwork request to replace the current cover. Repeated loads share pending requests, expired entries refresh correctly, and failed blob conversions fall back to the original image URL.

### Playback controls

- **Fix interrupted volume drags**
  Fullscreen and Cinema volume controls now release correctly after pointer cancellation, touch cancellation, window blur, or teardown. Right-clicks and horizontal-only wheel input no longer change volume.

- **Fix interrupted and duplicate seeks**
  Timeline drags now release their control lock after cancellation or blur, stop when the track changes, and avoid sending the same seek twice. Invalid timing and zero-width timelines are ignored.

## v100.10.41

- **Pinned Lyrics Footer**
  Appearance now has Off, No Writers, and Full modes. No Writers pins source and community credits while writers scroll at lyric end.

- **Experimental splitting labels**
  Lyrics sources now show compact `(+ extra splits)` and `(+ experimental splitting)` labels.

- **Space Gravity active-line control**
  Fixed the active-line arrow remaining visible after leaving Space Gravity mode.

- **Playback progress fallback**
  Playback progress now falls back to player state when local position updates stall.

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

## v100.10.38

- Updated to be inline with 6.3.10

- **Split gibberish words**
  Space Gravity now separates gibberish lyrics into individual words.

## v100.10.37

- **Space Gravity Mode**
  Refined word physics, pacing, rotation, density, cover-art avoidance, control clearance, lyric seeking, credits, and overlapping-line highlighting.

- **Better word handling**
  Space Gravity now preserves generated-word, CJK, and TTML word boundaries. Fixed missing characters and romanization alignment.

- **DJ cover colours**
  Now Playing and fullscreen lyrics use DJ cover-art colours without canvas rendering. Fixed DJ release-year display.

- **Cinema and popup fixes**
  Cinema settings now close correctly. Stale popup buttons no longer remain after startup.

## v100.10.36

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

## v100.10.35

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

## v100.10.34

- **Stable playback timeline**
  Fullscreen playback progress stays on Spotify's live clock when Playback Offset changes.

- **Local TTML spaces**
  Locally uploaded TTML keeps word boundaries from spaces inside timed spans, including word-synced lyrics.

- **Experimental SliderBar wording**
  The experimental progress-bar setting now uses the upstream SliderBar name and description.

## v100.10.33

- **Updated for 6.3.0**
  Synced the fork with upstream 6.3.0 changes while retaining the fork's fullscreen volume placement options.

- **Fullscreen volume controls**
  Volume sliders now use the upstream volume icon inside a glass-style bar. Left, right, and below placements brighten on mouse activity, expand while hovered or dragged, and use matching thickness.

- **Rounded playback progress**
  The played portion of the fullscreen timeline now has rounded ends instead of a flat progress edge.

- **Experimental settings**
  Cinema Lyrics Window and Experimental Word Sync moved to Experiments. The Cinema setting now enables its playback-bar button directly and includes the DevTools help link. Popup Lyrics settings now describe their playback-bar button behavior.

## v100.10.32

- Updated to be inline with 6.2.4

## v100.10.31

### Features

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

### Fixes

- **Stable lyric updates**
  Reloading lyrics or changing romanization keeps the current reading position instead of briefly jumping to the top. Lines ending at the same time no longer leave one line raised.

- **Local TTML romanization parsing**
  Locally uploaded TTML now reads nested romanization data.

- **Smoother lyric loading handoff**
  Loading previews now clear cleanly before the finished lyric view appears.
