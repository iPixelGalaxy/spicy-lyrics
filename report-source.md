# Timeline Outside Media Box diagnosis

Audience: Spicy Lyrics maintainer

Date: 2026-08-28

## Answer

`Timeline Outside Media Box` is a bug. The settings panel persists the boolean, but runtime NowBar code never reads it. Its value cannot change timeline placement.

## Evidence

- `src/components/ReactComponents/SettingsPanel/InterfaceSection.tsx` writes `$timelineOutsideMediaContent` when its toggle changes.
- `src/utils/stores.ts` persists that atom as `timelineOutsideMediaContent`.
- Current `src/components/Utils/NowBar.ts` imports only `$alwaysShowInFullscreen` for timeline placement. `shouldPlaceTimelineOutsideMediaContent()` returns true when that select is `Time`, `Both`, or `All`.
- The current code subscribes to `$alwaysShowInFullscreen`, then calls `RepositionTimeline()`. No subscription or read exists for `$timelineOutsideMediaContent` outside settings.

## History

Commit `b27e1f2c8ad828cf887793507a8ac1d5162abf72` read `$timelineOutsideMediaContent` in `PositionTimelineElement()` and subscribed to it. Commit `519f7dbaeb821a6624625a22f982addc21b667f8` changed placement to use `$alwaysShowInFullscreen` but retained the old persisted toggle and settings row.

## Recommended fix

Choose one source of truth. Remove `Timeline Outside Media Box` and its persisted atom if `Always Show In Fullscreen` controls this behavior. Otherwise restore `$timelineOutsideMediaContent` as the timeline-placement condition and subscription.
