# Spicy Lyrics

### Check out the *[Spicy Lyrics Site](https://yoursit.ee/lyrics)*

Spicy Lyrics replaces Spotify's plain, static lyrics with a fully animated, immersive experience — synced syllable by syllable where supported.

[![Github Version](https://img.shields.io/github/v/release/spikerko/spicy-lyrics)](https://github.com/spikerko/spicy-lyrics/) [![Github Stars](https://img.shields.io/github/stars/spikerko/spicy-lyrics?style=social)](https://github.com/spikerko/spicy-lyrics/) [![Discord](https://dcbadge.limes.pink/api/server/uqgXU5wh8j?style=flat)](https://discord.com/invite/uqgXU5wh8j)

![Extension Example](./previews/page.gif)

---

## How to Install

### Option 1 — Spicetify Marketplace *(recommended)*

1. Open the Spicetify Marketplace in Spotify
2. Go to the **Extensions** tab and search for `Spicy Lyrics`
3. Click **Install** — done

### Option 2 — Manual

1. Make sure [Spicetify](https://spicetify.app) is installed
2. Download [spicy-lyrics.mjs](./builds/spicy-lyrics.mjs)
3. Place the file in your Spicetify Extensions directory — [find the path here](https://spicetify.app/docs/customization/extensions#manual-installation)
4. Run:
   ```
   spicetify config extensions spicy-lyrics.mjs
   spicetify apply
   ```

---

*Made with care by [Spikerko](https://github.com/spikerko). Inspired by [Beautiful Lyrics](https://github.com/surfbryce/beautiful-lyrics).*

---

---

# iPixel Dev Channel

> **This is an unofficial development build of Spicy Lyrics**, maintained by iPixelGalaxy (but imma be so fr, this is claude code doing all the heavy lifting, I'm just a guy with too many ideas).
> It runs alongside the official version and gives you access to features before they ship to stable.

---

## What's New

### v100.10.17 — Latest

- **Client-side TTML parsing** — uploaded TTML files are now parsed directly in the Spotify client instead of being sent to the server first
- **Local TTML apply flow cleanup** — local TTML uploads now apply directly in-app after parsing instead of bouncing back through the normal fetch flow
- **TTML database browser improvements** — saved TTML entries now display readable song names instead of raw Spotify IDs or full local URIs, local artist names are deduplicated, and Spotify-track lookups use Spotify client metadata instead of the rate-limited public Web API

---

### v100.10.16

- **Merged latest mainline Spicy Lyrics changes into dev** — pulled `main` forward into the iPixel dev branch, including the recent performance and background pipeline updates
- **Cover Art Animation toggle** — added a new setting to enable or disable the NowBar cover art transition, enabled by default
- **Refined cover art transition** — the cover art animation is now directional when changing tracks and behaves differently for next vs. previous track changes
- **Use Old Background Animation toggle** — added a fallback option that restores the older pre-merge dynamic background renderer

---

### v100.10.15

- **Unified update popups** — the "updated" and "update available" dialogs now match the newer Spicy Lyrics modal styling
- **Hidden custom build channels** — custom channel controls are now tucked behind a seven-right-click unlock gesture on the Build Channel label to keep the default UI cleaner
- **Removed** the old server latency / connection indicator setting and related UI

---

### v100.10.14

- **Rebased on main Spicy Lyrics** — refreshed the iPixel dev build onto the current mainline Spicy Lyrics base
- **Compact / fullscreen NowBar layout fixes** — tightened the compact NowBar so metadata, timeline, and controls no longer sprawl across the view
- **Fix Inline NowBar playbar** — when "Replace Spotify Playbar with NowBar" is enabled, the progress bar now renders inside the NowBar instead of relying on the fullscreen inline controls logic

---

### v100.10.13

- **Release Year next to Artist** — new "Release Year Position" dropdown (Off / Before Artist / After Artist) shows the album release year beside the artist name in the NowBar, with smooth scroll fade anchored to the year dot

---

### v100.10.12

- **Profile modal now covers the full Spotify window** — the iframe profile overlay now spans the entire Spotify app rather than just the lyrics panel

---

### v100.10.11

- **Profile now loads as an iframe** — the profile panel is now served directly from spicylyrics.org as an embedded iframe, replacing the custom-built React layout
- **Click outside to close** — clicking anywhere on the backdrop dismisses the profile panel
- **Listen button plays in Spotify** — the Listen button inside the profile sends a message to close the overlay and immediately start playing the track in Spotify
- **Fixed** italic/slanted font glyphs being clipped in line-by-line sync mode

---

### v100.10.10

- **TTML Profile redesign** — clicking a maker or uploader's name now opens a fully redesigned profile modal: two-column layout with a left info panel and a scrollable track list on the right
- **Profile banner** — user banners display at the top of the modal with a gradient fade into the profile background
- **Makes / Uploads tabs** — side-by-side tab switcher shows the track count for each; slides the track list between views
- **View stats panel** — shows total makes views and uploads views separately
- **Song deduplication** — duplicate tracks (remasters, remixes, alternate titles) are merged with their view counts combined, then re-sorted by total views

---

### v100.10.9

- **Custom Font** — Appearance settings now has a toggle that reveals a font name field; enter any font installed on your system (placeholder shows `Spotify Mix` as the default)
- **Fixed** slanted/italic fonts being clipped at the edges during lyrics animation
- **Removed** the Old Style Font toggle (was no longer functional)

---

### v100.10.8

- **Settings panel reorganized** — options grouped more logically across sections; unused options removed
- **Settings apply instantly** — font, right-align, syllable rendering, simple and minimal lyrics modes all update without reloading Spotify
- **Fixed** the Replace Spotify Playbar workaround incorrectly hiding Spotify's progress bar while Popup Lyrics was open

---

### v100.10.7

- **Brought back the Clear All Cache button**
- **Fixed the pop-out player** — inline controls and timeline no longer show in the mini player
- **Removed confirmation prompts from cache buttons** — cache clears now fire immediately; the TTML database clear uses a styled in-app dialog instead of the browser prompt
- **Settings panel slightly shrunk** — more compact and centered so controls are easier to reach
- **Browse Local TTML Database** button added to the Advanced section in settings
- **UI unification** — Load TTML and Browse Database overlays now match the settings panel design

---

### v100.10.6

- **Settings Gear :O** — a dedicated "Open Settings" button now appears under the Spicy Lyrics section in Spotify's native settings, and all the Spicy Lyrics settings can be accessed through a settings gear in the lyric view.

---

### Initial Release

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
