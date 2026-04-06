

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

### v100.10.23 — Latest

- **Lyrics sources split by origin** — the Spicy Lyrics source now covers community lyrics only, Apple Music and Spotify are their own separate toggleable sources
- **New default source order** — Spicy Lyrics → Musixmatch → Apple Music → Spotify → LRCLIB → Netease
- **Smarter defaults** — Spicy Lyrics, Musixmatch, Apple Music, and Spotify are enabled out of the box; LRCLIB and Netease remain off by default
- **Ignore Musixmatch word sync enabled by default** — word sync from Musixmatch is ignored unless you opt back in
- **Auto Musixmatch token on first load** — a fresh token is fetched automatically if none is stored
- **Prioritize Apple Music Quality toggle** — when enabled (on by default), Apple Music lyrics are preferred over Musixmatch when they are of equal or greater quality; Apple Music only wins ties if its lyrics have real pauses between lines, so back-to-back continuous syncs (typical of Musixmatch-sourced timings) don't incorrectly trigger the preference

---

<details>
<summary>v100.10.22</summary>

- **Addition Lyric Sources** — HOLY MOLY 👀
- **At least one source always stays enabled** — the last remaining enabled source's toggle is locked so you can't accidentally disable everything
- **Default source is Spicy Lyrics only** — new installs (and anyone who hasn't customised the setting) start with only the Spicy Lyrics source active; others can be turned on as needed

</details>

<details>
<summary>v100.10.21</summary>

- **Lyric view keyboard shortcuts** — when the lyrics view is open, press `F` to toggle fullscreen (or promote cinema view to real fullscreen) and `R` to toggle romanization
- **Experimental word sync on line-timed lyrics** — new Advanced toggle: `Enable word sync on everything (Experimental)` synthesizes per-word timing from line sync using weighted timing math, and treats bracketed sections as background vocals where possible

</details>

<details>
<summary>v100.10.20</summary>

- **Merged latest changes from 5.22.2**

</details>

<details>
<summary>v100.10.19</summary>

- **Added Fun Options** Meme Format Options: Weeb, Gibberish (Gibberish is lowkey cooked, this one would require quite a bit of work to get right)

</details>

<details>
<summary>v100.10.18</summary>

- **Merged mainline Spicy Lyrics 5.22.0** — pulled the latest official release into the dev branch, including sidebar lyrics improvements, dynamic background fixes, and updated audio analysis caching
- **RTL lyrics fixes** — Arabic and other right-to-left lyrics now animate in the correct direction, syllable splits in the middle of words grow outward properly, and RTL lines no longer clip during animation
- **Local FLAC seek blocking** — clicking lyrics to seek is now disabled for local FLAC files because Spotify desyncs the audio from the timeline; a notification explains why
- **Musical interlude lines are no longer seekable** — clicking instrumental/musical lines no longer triggers a seek

</details>

<details>
<summary>v100.10.17</summary>

- **Client-side TTML parsing** — uploaded TTML files are now parsed directly in the Spotify client instead of being sent to the server first
- **Local TTML apply flow cleanup** — local TTML uploads now apply directly in-app after parsing instead of bouncing back through the normal fetch flow
- **TTML database browser improvements** — saved TTML entries now display readable song names instead of raw Spotify IDs or full local URIs, local artist names are deduplicated, and Spotify-track lookups use Spotify client metadata instead of the rate-limited public Web API

</details>

<details>
<summary>v100.10.16</summary>

- **Merged latest mainline Spicy Lyrics changes into dev** — pulled `main` forward into the iPixel dev branch, including the recent performance and background pipeline updates
- **Cover Art Animation toggle** — added a new setting to enable or disable the NowBar cover art transition, enabled by default
- **Refined cover art transition** — the cover art animation is now directional when changing tracks and behaves differently for next vs. previous track changes
- **Use Old Background Animation toggle** — added a fallback option that restores the older pre-merge dynamic background renderer

</details>

<details>
<summary>v100.10.15</summary>

- **Unified update popups** — the "updated" and "update available" dialogs now match the newer Spicy Lyrics modal styling
- **Hidden custom build channels** — custom channel controls are now tucked behind a seven-right-click unlock gesture on the Build Channel label to keep the default UI cleaner
- **Removed** the old server latency / connection indicator setting and related UI

</details>

<details>
<summary>v100.10.14</summary>

- **Rebased on main Spicy Lyrics** — refreshed the iPixel dev build onto the current mainline Spicy Lyrics base
- **Compact / fullscreen NowBar layout fixes** — tightened the compact NowBar so metadata, timeline, and controls no longer sprawl across the view
- **Fix Inline NowBar playbar** — when "Replace Spotify Playbar with NowBar" is enabled, the progress bar now renders inside the NowBar instead of relying on the fullscreen inline controls logic

</details>

<details>
<summary>v100.10.13</summary>

- **Release Year next to Artist** — new "Release Year Position" dropdown (Off / Before Artist / After Artist) shows the album release year beside the artist name in the NowBar, with smooth scroll fade anchored to the year dot

</details>

<details>
<summary>v100.10.12</summary>

- **Profile modal now covers the full Spotify window** — the iframe profile overlay now spans the entire Spotify app rather than just the lyrics panel

</details>

<details>
<summary>v100.10.11</summary>

- **Profile now loads as an iframe** — the profile panel is now served directly from spicylyrics.org as an embedded iframe, replacing the custom-built React layout
- **Click outside to close** — clicking anywhere on the backdrop dismisses the profile panel
- **Listen button plays in Spotify** — the Listen button inside the profile sends a message to close the overlay and immediately start playing the track in Spotify
- **Fixed** italic/slanted font glyphs being clipped in line-by-line sync mode

</details>

<details>
<summary>v100.10.10</summary>

- **TTML Profile redesign** — clicking a maker or uploader's name now opens a fully redesigned profile modal: two-column layout with a left info panel and a scrollable track list on the right
- **Profile banner** — user banners display at the top of the modal with a gradient fade into the profile background
- **Makes / Uploads tabs** — side-by-side tab switcher shows the track count for each; slides the track list between views
- **View stats panel** — shows total makes views and uploads views separately
- **Song deduplication** — duplicate tracks (remasters, remixes, alternate titles) are merged with their view counts combined, then re-sorted by total views

</details>

<details>
<summary>v100.10.9</summary>

- **Custom Font** — Appearance settings now has a toggle that reveals a font name field; enter any font installed on your system (placeholder shows `Spotify Mix` as the default)
- **Fixed** slanted/italic fonts being clipped at the edges during lyrics animation
- **Removed** the Old Style Font toggle (was no longer functional)

</details>

<details>
<summary>v100.10.8</summary>

- **Settings panel reorganized** — options grouped more logically across sections; unused options removed
- **Settings apply instantly** — font, right-align, syllable rendering, simple and minimal lyrics modes all update without reloading Spotify
- **Fixed** the Replace Spotify Playbar workaround incorrectly hiding Spotify's progress bar while Popup Lyrics was open

</details>

<details>
<summary>v100.10.7</summary>

- **Brought back the Clear All Cache button**
- **Fixed the pop-out player** — inline controls and timeline no longer show in the mini player
- **Removed confirmation prompts from cache buttons** — cache clears now fire immediately; the TTML database clear uses a styled in-app dialog instead of the browser prompt
- **Settings panel slightly shrunk** — more compact and centered so controls are easier to reach
- **Browse Local TTML Database** button added to the Advanced section in settings
- **UI unification** — Load TTML and Browse Database overlays now match the settings panel design

</details>

<details>
<summary>v100.10.6</summary>

- **Settings Gear :O** — a dedicated "Open Settings" button now appears under the Spicy Lyrics section in Spotify's native settings, and all the Spicy Lyrics settings can be accessed through a settings gear in the lyric view.

</details>

<details>
<summary>Initial Release</summary>

- **Settings page redesign** — most settings apply instantly, no save or reload required
- **Replace Spotify Playbar with NowBar** — option to automatically hide the Spotify playbar when entering lyrics mode with NowBar enabled
- **Always-visible Playbar in Fullscreen / Cinema** — configure Time and Controls visibility independently
- **TTML persistence** — load local TTML files temporarily (once), for the session (until Spotify restarts), or permanently to the local database
- **Local TTML Database browser** — browse and manage persisted TTML files from within settings, with an option to jump to the matching Spotify track *(currently displays the track ID rather than the title)*
- **Load TTML** — formerly "Dev Tools / TTML Maker Mode", now enabled by default and renamed, with a link to the usage guide
- **Escape key behavior** — configurable: Default, Exit Fullscreen only, or Exit Fully
- **Volume slider in Cinema / Fullscreen** — choose between Left side, Right side, or Below the cover art
- **Syllable Rendering options** — Default, Merge Words, or Reduce Splits
- **Right Align Lyrics** — toggle to mirror the lyrics layout
- **Build Channel selector** — choose Stable, Beta, Dev, or enter a custom server URL
- **Dev entrypoint standdown** — the plugin cleanly defers when a locally-built dev version (`deno run dev`) is detected
- **Clear All Cache button**
- **Clear Database button** for local persistent TTMLs
- **Updated error message on local files**
- **Fixed** lyrics view locking up when no media is playing
- **Fixed** duet vocals not being properly right-aligned
- **Fixed** Spicy Lyrics progress bar scaling incorrectly based on surrounding text length

</details>