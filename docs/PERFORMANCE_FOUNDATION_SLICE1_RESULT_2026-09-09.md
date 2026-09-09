# Performance Foundation — Slice 1 Result — 2026-09-09

## Status

Implemented on branch `perf/playback-core-foundation` only.

The current production Player on `main` is intentionally unchanged while this work is validated.

Reference baseline branch:

- `baseline/player-before-performance-2026-09-09`
- baseline commit: `a0bb675c81caf476e4cbc58ce5f9a1302ac4c3bd`

Pull request:

- PR #56 — `perf: reduce playback UI polling`

## Goal

Reduce background UI work while audio is playing without redesigning the Player or changing playback semantics.

## Implemented

### Floating Mini Player

Before:

- refreshed playback state every 350 ms
- repeatedly queried Player / YouTube DOM
- performed scroll-time geometry reads to decide whether the mini player should be hidden

After:

- no 350 ms timer
- refreshes from media events (`play`, `pause`, `ended`, metadata/duration changes)
- uses targeted MutationObservers only around track/status/transport elements
- uses IntersectionObserver for Player visibility when available
- fallback geometry work is throttled with `requestAnimationFrame`

### Unified Play Queue

Before:

- Local queue snapshot every 1200 ms
- Saved Playlist / IndexedDB refresh every 1400 ms

After:

- Local queue updates from targeted DOM changes
- Saved Playlist refreshes from the existing playlist-change event
- also refreshes when the active playlist label changes or the document becomes visible again
- Player target rediscovery is requestAnimationFrame-throttled

### Offscreen Player rendering

When another WMS tool/card is active:

- Local audio playback is not intentionally paused
- the offscreen Canvas visualizer is hidden
- CSS visualizer animations are paused
- visualizer filter work is removed while offscreen

When Player becomes active again, normal visuals resume automatically.

## Automated validation

Latest PR head after the first performance slice:

- TypeScript typecheck: PASS
- Vite build: PASS
- PR Pages deploy: skipped as expected for pull requests

## Real-device validation still required

Before merging this performance slice into production, verify on the target Android device/PWA:

1. Start Local audio with an audio-reactive visualizer.
2. Navigate Player → Library → YouTube → Record → Tools → Settings while audio continues.
3. Confirm no unexpected pause during WMS-internal navigation.
4. Listen for reduced or unchanged audio dropouts during horizontal card transitions.
5. Confirm Floating Mini Player updates play/pause and track title correctly.
6. Confirm previous/next buttons remain accurate.
7. Return to Player and confirm the visualizer resumes correctly.
8. Change local tracks while paused and while playing; confirm Mini Player title stays in sync.
9. Load/play YouTube and confirm Mini Player source/title/play state remain correct.
10. Confirm named playlist YouTube entries update after adding from the Player playlist action.

## Not implemented in Slice 1

- App-wide remount removal (`<App key={libraryRevision}>` still exists)
- true central playback state store
- stopping the Canvas requestAnimationFrame loop itself while offscreen (painting is suppressed first; full loop gating is a later slice)
- AUTO / QUALITY / ECO performance modes
- FFmpeg worker/load isolation changes
- automatic device-performance adaptation

## Recommended Slice 2

1. remove App-wide remount as the library refresh mechanism
2. introduce an event-driven media-library sync bridge
3. let YouTube import and Recorder library writes notify App without destroying/recreating Player state
4. gate Canvas animation loop itself when Player is offscreen/hidden
5. establish a lightweight runtime performance metric before adding new visualizers
