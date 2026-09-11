# What to expect from iPixel Spicy Lyrics

iPixel Spicy Lyrics is an unofficial fork of Original Spicy Lyrics. It adds more control over lyric sources, local TTML files, appearance, and playback controls, along with optional effects such as Space Gravity and experimental word splitting.

This guide describes the fork's additions and behavior changes rather than listing every release or internal code change. Features depend on the build channel you use. See the [README](../README.md) for installation, channel setup, and version-by-version release notes.

## Lyrics sources and loading

Manage Sources lets you choose which providers to use and their priority. The default order is Spicy Lyrics, Musixmatch, Apple Music, Spotify, LRCLIB, then Netease. LRCLIB and Netease start disabled; you can enable them or rearrange the order.

Enabled providers load concurrently. Your priority order and the Apple Music quality preference determine the selected result, so the first response is not necessarily the one displayed. A lyric-shaped shimmer preview appears while loading finishes.

Source-specific controls include a Musixmatch token field with refresh, an option to ignore Musixmatch word sync, and a preference for higher-quality Apple Music timing. The footer identifies the source of the displayed lyrics. Musixmatch fallback also checks track identity to reject mismatched results.

The Sources section includes cache controls. You can clear current-song caches, current in-memory lyrics, or stored lyric cache, and choose a cache action to expose directly in the lyrics view.

## Local TTML files

The Load TTML dialog offers three ways to use a file:

| Load mode | How long it stays available |
| --- | --- |
| Persistent Load | Saves the file to the local TTML database for later use. |
| Temporary Load | Applies it to the current song until refresh. |
| Session Load | Keeps it for that track until Spotify restarts. |

The dialog also provides a guide, Reset TTML, and access to the TTML Database. Files are parsed inside Spotify, with support for embedded romanization, background vocals, community credits, and word boundaries recorded in timed spans. You can browse stored files from settings and return without losing your settings scroll position.

## Animation and optional lyric effects

Choose an animator in Effects:

- **Default** follows upstream animation curves, spring tuning, and lyric timing. It includes the fork's font-clipping correction for wide or overhanging glyphs.
- **Pixel** keeps the fork's animation choices, including full-size resting text and reduced scaling on joined syllables.
- **Custom** exposes scale, motion, glow, blur, and spring controls. You can type values, randomize visible controls, save and load named presets, or share and import them through the clipboard.

Clicking a vocal lyric seeks to its timing point, following upstream behavior.

Space Gravity lets words drift and rotate away from their normal line positions while their lyric animations continue. It supports background vocals, duet colors, instrumental dots, lyric seeking, and cover-art avoidance. For line-synced or static lyrics, Gravity can temporarily generate the word timing it needs.

Unique Word Filters offers Gibberish, all lowercase, ALL UPPERCASE, and Off. Gibberish changes the displayed words, including in Space Gravity. These effects are optional.

### Experimental splitting

There are two different uses of splitting:

- **Assisting Apple Music TTML:** adds splits within already timed lyrics, including combined words and hyphenated phrases. The provider label shows `(+ extra splits)` when this helped.
- **Generating word timing:** Experimental Word Sync converts line-synced or static lyrics into word-by-word timing, using timing distribution and Spotify audio analysis where available. The provider label shows `(+ automatic experimental splitting)`.

Generated timing is an estimate, not manually synchronized lyrics. When Space Gravity requires temporary word sync, a separate notice explains why it was enabled.

## Appearance and credits

You can use an installed custom font by entering its family name. Synthetic font styling is disabled for more faithful rendering, and an empty font name falls back to the normal font. The clipping correction gives animated glyphs extra space at their edges.

Background Type offers Default, Legacy, Auto, Artist Header, Cover Art, and Color. There are also controls for cover-art transitions, right-aligned lyrics, and the lyric hover background. Local-track artwork and DJ cover colors receive handling intended to avoid blank or stale backgrounds.

Pinned Lyrics Footer has three modes: Off keeps credits in the scrolling lyrics; No Writers pins source and community credits while writers remain at lyric end; Full also pins writers. Community contributor profiles can open inside Spotify, with a browser fallback if the profile cannot be loaded.

## Fullscreen, Cinema, and navigation

The fork adds fullscreen and Cinema volume placement options: Off, Left, Right, or Below. You can keep time, media controls, or both visible, show the album release year near the track information, choose how Escape exits the view, and enable an animated fullscreen close.

A directional control brings the active lyric back into view after you scroll away. Reloading lyrics or changing romanization preserves the reading position, and reopening the Now Playing View lyrics card keeps its loaded lyrics available.

Popup and Cinema settings control their playback-bar buttons. Cinema pop-out is disabled by default. Fullscreen controls account for compact and picture-in-picture layouts where there is less room.

Local FLAC files are an exception to lyric-click seeking: it is disabled because Spotify can desynchronize their audio from the timeline. Instrumental dots are not treated as seekable vocal lines.

## Settings and build channels

Settings are grouped into Appearance, Lyrics Display, Effects, Interface, Sources, and Advanced, with search and section filtering. You can hide settings you do not use, restore them through the manager, and find hidden settings through search.

Advanced contains the Build Channel selector and branch manager. Stable and Beta are built-in choices; you can also add custom branches, switch between them, and remove custom entries. The loader exposes channel controls when using the upstream Stable plugin too, so you can return to Original Spicy Lyrics through the channel selector.

## Reliability changes

Recent patch notes also cover recovery from damaged settings and caches, stale artwork and lyric requests during track changes, and local TTML database changes applying to the wrong track. Playback progress falls back to player state when local position updates stall.

Volume and timeline drags release their control locks after cancellation or window blur. Timeline drags stop when the track changes and avoid duplicate seeks. These are fixes to everyday playback behavior, not additional effects you need to configure.
