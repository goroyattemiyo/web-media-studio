# Current Implementation

Last updated: 2026-09-08 JST

## Repository state

The repository foundation, player bootstrap, Recorder MVP, IndexedDB recording persistence, FFmpeg video-to-audio tools, local playlist improvements, Android background/Media Session validation, persistent local media library, WMS branding, and switchable player-visual foundation are merged to `main`.

Public URL:

`https://goroyattemiyo.github.io/web-media-studio/`

Recorder, recording persistence, FFmpeg extraction/conversion, Android multi-file import, continuous playback, screen-off playback, installed-PWA background playback, tested lock-screen controls, and persistent local media-library behavior have passed the requested Android real-device checks.

## Implemented player foundation

- React + TypeScript + Vite
- GitHub Pages deployment
- mobile-first PWA shell
- five switchable skins
- local audio/video import and playback
- play/pause, previous/next, ±10-second seek and timeline seek
- volume and speed controls
- shuffle and repeat off/all/one
- A-B loop
- Media Session metadata/action handlers
- capability panel
- service worker and manifest
- WMS diamond/monogram SVG branding
- initial switchable player visuals: `Emblem Spin` and `Minimal`

## Implemented Recorder MVP (merged PR #6)

- browser microphone capture using `getUserMedia`
- `MediaRecorder` local recording
- mic-only take capture
- Play & Record mode
- live duration and REC state
- source track/start-position metadata
- take playback, deletion and download

Recorder MVP does not claim sample-accurate synchronization and does not digitally mix playback audio into the take. Current intended use is karaoke-style vocal practice, instrument practice, and quick performance-note recording while a source track plays.

## Implemented recording persistence (merged PR #7)

- IndexedDB database: `web-media-studio`
- recording store: `recording-takes`
- recording Blob and metadata stored together
- takes restored after reload/PWA restart
- deleting a take persists across reloads

Android real-device persistence checks passed.

## Implemented FFmpeg video -> audio (merged PR #8)

- lazy-loaded single-thread `@ffmpeg/ffmpeg`
- local browser processing only
- 250 MB mobile input guard
- Original stream-copy extraction when compatible
- MP3 192 kbps
- WAV PCM 16-bit / 48 kHz stereo
- progress/status UI
- preview and Save to device

Android real-device checks passed for FFmpeg initial load, Original extraction, MP3, WAV, preview and save.

## Implemented local playlist / folder progressive enhancement (merged PR #9)

- multiple media-file selection
- optional Folder input using `webkitdirectory` / `directory`
- audio/video filtering
- natural sorting
- relative path display when provided by the picker
- continuous next-track playback
- next/previous while playback is running

On the tested Android picker, Folder falls back to normal file selection. Multiple-file selection is therefore the primary Android import path. Folder remains a progressive enhancement for compatible desktop/browser-picker combinations.

## Android background / Media Session validation

Confirmed on the tested Android Chrome/PWA environment:

- multiple-file playlist playback: PASS
- automatic next-track continuation: PASS
- screen-off playback for at least 30 seconds: PASS
- lock-screen controls appear: PASS
- lock-screen Pause -> Play: PASS
- lock-screen Next: PASS
- next-track continuation while screen remains off: PASS
- installed-PWA background/lock-screen sequence: PASS

These results apply only to the tested Android environment and do not imply identical behavior on iOS or every Android device/browser.

## Implemented: persistent local media library (merged PR #12)

- shared IndexedDB schema upgraded from version 1 to version 2
- existing `recording-takes` data preserved during schema upgrade
- new `media-library` object store
- per-item Save and Save-all actions
- saved media Blob + metadata stored locally in IndexedDB
- saved media restored automatically at app startup
- per-item Delete removes the persistent Blob from IndexedDB
- Clear temp removes only unsaved imports and leaves saved media intact
- 250 MB per-item mobile-MVP save guard
- 500 MB saved-media soft limit
- browser quota check before saving when StorageManager estimate is available
- best-effort request for persistent browser storage
- saved count, saved bytes, quota estimate and storage-protection status UI
- no application-server upload

Android real-device validation:

- saved media survives normal reload and remains playable: PASS
- saved media survives closing/reopening Chrome/PWA: PASS
- Clear temp removes only unsaved items: PASS
- deleting a saved item remains deleted after reload: PASS
- existing saved recording takes survive IndexedDB version-2 upgrade: PASS

## Implemented branding / visual foundation (merged PRs #15 and #16)

- approved WMS-style thick rounded diamond emblem traced into SVG
- WMS SVG shared by PWA/app icon, header brand mark, and audio-player artwork
- initial visual selector with `Emblem Spin` and `Minimal`
- visual choice persists in localStorage
- concise Japanese section descriptions
- service-worker cache version refreshed for branding changes

Future visual modes remain candidates, not implemented yet: album art, wave ring, spectrum, VU meter and other visualizers.

## In progress: persistent queue reorder and resume position (PR #17)

Implemented on `feat/reorder-resume` and automated build/typecheck PASS:

- ↑ / ↓ queue-order controls
- currently selected track remains selected while rows move
- saved-library order is persisted back to IndexedDB
- temporary imports can be reordered for the current session
- saved-media playback position is stored locally
- saved media restores its previous position when reopened
- near-start / near-end positions are ignored
- track completion clears its stored resume point
- deleting saved media also clears its stored resume point
- automatic next-track playback intentionally starts the next track at 0:00 instead of applying an old resume point

Android real-device validation for these new behaviors is pending.

## Real-device validation still required

- persistent queue order after reload/PWA restart
- saved-media resume position after pause/reload/PWA restart
- automatic next-track playback still starts at 0:00 with resume enabled
- longer multi-file sessions
- lock-screen Previous specifically
- local video in longer playlists
- recording while locked/backgrounded
- larger FFmpeg files near the guard
- true folder import on a compatible picker/browser
- iPhone Safari / installed web-app playback and Media Session behavior
- service-worker update/offline behavior

## Not implemented yet

- saved named playlists
- markers/bookmarks
- sample-accurate synchronized recording
- playback + microphone digital mixdown
- audio trim/fade/normalization tools
- album-art/wave-ring/spectrum/VU player visuals
- YouTube provider
- direct URL provider
- automated browser E2E tests

## Confirmed product decisions

- repository: `goroyattemiyo/web-media-studio`
- hosting: GitHub Pages
- architecture: mobile-first client-side PWA
- local-first storage
- Android primary import path: multiple local file selection
- Folder import is progressive enhancement
- browser-side FFmpeg loads on demand
- WMS diamond emblem is the primary app-brand mark
- player visuals should be switchable rather than fixed to a single animation
- YouTube playback will use the official embedded player/API
- YouTube stream downloading is not a project feature
- background behavior is platform-dependent; tested Android Chrome/PWA is confirmed working

## Immediate next step

1. validate PR #17 queue reorder and resume behavior on Android Chrome/PWA
2. after PASS, implement saved named playlists
3. then add markers/bookmarks or continue to the official YouTube IFrame provider based on product priority

Do not describe planned work as implemented work.
