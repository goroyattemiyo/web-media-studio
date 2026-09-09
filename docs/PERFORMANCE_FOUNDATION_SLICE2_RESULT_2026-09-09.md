# Performance Foundation — Slice 2 Result — 2026-09-09

## Scope

Phase P0 performance work only. No visual redesign and no new media feature.

Stable comparison baseline:

- branch: `baseline/player-before-performance-2026-09-09`
- commit: `a0bb675c81caf476e4cbc58ce5f9a1302ac4c3bd`

Implementation branch:

- `perf/playback-core-foundation`
- PR #56

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

## Validation status

Automated validation required before merge:

- TypeScript typecheck
- Vite production build

Real-device regression is still required for performance claims involving audible continuity.

Recommended device checks:

1. Start Local audio.
2. Move Player → Library → YouTube → Recorder → Tools → Settings repeatedly.
3. Confirm audio does not stop or jump position.
4. Confirm Floating Mini Player state follows play/pause/track changes.
5. Import a downloaded YouTube audio file while Local audio is playing and confirm playback is not recreated.
6. Create a tab/mix recording that is saved into Local Library and confirm current playback continues.
7. Use an audio-reactive visualizer, leave Player, then return and confirm visual response resumes.
8. Compare perceived UI latency / audio glitches against the preserved baseline branch.

## Not claimed yet

- This does not prove all audio glitches are fixed.
- YouTube IFrame background behavior remains browser/provider controlled.
- FFmpeg execution can still compete for CPU/RAM.
- Some DOM observers remain and should be profiled before further removal.

## Next P0 candidate

- runtime performance metrics / long-task observation
- AUTO / QUALITY / ECO performance policy
- lower visualizer frame rate / resolution under load
- reduce YouTube status polling when the YouTube card is inactive
- isolate or throttle expensive FFmpeg work during active playback where practical
