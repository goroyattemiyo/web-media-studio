# Performance Foundation — Slice 2 Result — 2026-09-09

## Scope

Phase P0 performance work only. No visual redesign and no new media feature.

Stable comparison baseline:

- branch: `baseline/player-before-performance-2026-09-09`
- commit: `a0bb675c81caf476e4cbc58ce5f9a1302ac4c3bd`

Implementation branch:

- `perf/playback-core-foundation`
- PR #56
- merged production commit: `6b552ca97d2b1bd0c7cd1fa9de4ac1af9b066556`

## Completed

### 1. Keep App / Player mounted during external Library updates

Before this slice, `Root` used:

```tsx
<App key={libraryRevision} />
```

Changing `libraryRevision` therefore recreated the whole `App` tree, including the local Player and its media element.

This slice removes the React `key` remount path. `App` now receives the revision as data and synchronizes only newly saved IndexedDB media into its Library state.

Expected effect:

- importing downloaded YouTube audio no longer intentionally recreates Player
- Recorder tab/mix Library saves no longer intentionally recreate Player
- current local playback element and playback position can remain mounted while Library state is refreshed

### 2. Recorder Library changes use the same incremental sync

`RecorderPanel.onMediaLibraryChanged` is now connected to the Root Library revision signal.

Only new stored records are converted to object URLs and appended to current Library state. Existing Player queue entries are not rebuilt.

### 3. Stop Canvas requestAnimationFrame when visualizer is not useful

`SkinVisualEnhancer` now watches WMS active-tool / document-visibility state.

For audio-reactive Canvas visuals, the animation-frame loop is not started when:

- another WMS tool/card is active, or
- the document is hidden.

Returning to Player while visible restarts the visualizer automatically.

Audio playback is intentionally independent from this visual rendering gate.

### 4. Slice 1 behavior retained

- Floating Mini Player periodic 350 ms polling removed
- Local Queue 1.2 s polling removed
- Saved Playlist 1.4 s database polling removed
- Player visibility uses targeted observer/event updates
- CSS visualizer animation is paused away from Player

## Automated validation

PR and production validation:

- TypeScript typecheck: PASS
- Vite production build: PASS
- GitHub Pages production deploy: PASS

## Real-device validation — CORE PASS

Production build was tested on a real device after deployment.

Core scenario:

1. Start Local audio playback.
2. Move between WMS cards/tools while playback continues.
3. Continue operating other parts of WMS during playback.
4. Observe UI responsiveness and audible playback continuity.

Observed result:

- page/tool transitions no longer stop Local playback
- the previous noticeable hitching during navigation is almost completely gone
- no obvious regression was found in normal playback/navigation use
- user assessment after repeated use: the current state appears stable enough to continue from this performance baseline

This validates the primary P0 goal: reduce WMS-side background/UI work so playback remains responsive while the user moves around the application.

Extended stress cases such as simultaneous heavy FFmpeg conversion, every Recorder import path, and browser/OS background throttling are not separately claimed as fully validated by this core pass.

## Remaining boundaries

- YouTube IFrame background behavior remains browser/provider controlled.
- FFmpeg execution can still compete for CPU/RAM.
- Some DOM observers remain and should be profiled before further removal.
- Browser/OS behavior outside the active WMS document is not guaranteed by this result.

## Next P0 candidate

Do not optimize aggressively without evidence now that the core navigation issue is substantially improved. Prefer measured/adaptive work:

- runtime performance metrics / long-task observation
- AUTO / QUALITY / ECO performance policy
- lower visualizer frame rate / resolution only under load
- reduce YouTube status work when the YouTube card is inactive
- isolate or throttle expensive FFmpeg work during active playback where practical
