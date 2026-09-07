# Current Implementation

Last updated: 2026-09-08 JST

## Repository state

The repository foundation, player bootstrap, Recorder MVP, IndexedDB recording persistence, FFmpeg video-to-audio tools, local playlist improvements, Android background/Media Session validation, persistent local media library, WMS branding, switchable player visuals, persistent queue reorder, resume-position behavior, and saved named playlists are merged to `main`.

Public URL:

`https://goroyattemiyo.github.io/web-media-studio/`

Recorder, recording persistence, FFmpeg extraction/conversion, Android multi-file import, continuous playback, screen-off playback, installed-PWA background playback, tested lock-screen controls, persistent local media-library behavior, queue-order persistence, saved-media resume behavior, and saved named playlists have passed the requested Android real-device checks.

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

## Implemented persistent local media library (merged PR #12)

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

## Implemented queue reorder and resume position (merged PR #17)

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

Android Chrome/PWA real-device validation:

- saved queue order survives reload: PASS
- saved media resumes near the stored position after pause/reload: PASS
- completed tracks reopen from 0:00: PASS
- automatic next-track playback starts the next item from 0:00: PASS
- background/lock-screen playback regression check: PASS

## Implemented saved named playlists (merged PR #18)

- IndexedDB schema version 3 adds a `saved-playlists` object store while preserving existing recording/media stores
- create a named playlist from the current queue's saved media
- temporary unsaved imports are excluded from named playlists
- load a saved playlist as the active playback queue
- update an active playlist from the current queue
- delete a playlist without deleting its underlying saved media
- `All media` restores the full saved-media catalog view
- queue-only `×` removes a track from the current queue without deleting the saved media
- ↑ / ↓ updates the active named-playlist order when one is loaded
- deleting saved media removes its ID from stored playlists

Android Chrome/PWA real-device validation:

- playlist creation and persistence across reload/PWA restart: PASS
- loading restores only selected saved media in expected order: PASS
- reorder persists when playlist is loaded again: PASS
- Update changes the stored playlist snapshot: PASS
- deleting playlist leaves underlying saved media available in All media: PASS

## In progress: YouTube official IFrame provider

Feature branch: `feat/youtube-iframe-provider`

Implemented on the branch:

- isolated provider adapter under `src/providers/youtube.ts`
- YouTube watch/youtu.be/Shorts/embed/live URL parsing plus direct 11-character video IDs
- `t=` / `start=` start-position parsing
- lazy loading of the official `https://www.youtube.com/iframe_api` script
- official `YT.Player` construction with `playsinline` and page `origin`
- provider-local Play / Pause / ±10 seconds / seek / volume / supported playback-rate controls
- player status, title, elapsed time and duration display
- YouTube embed error mapping for invalid/unavailable/non-embeddable videos
- autoplay-blocked status handling
- capability display: playback supported, download unsupported, background device-dependent
- explicit UI note that Web Media Studio does not download or extract YouTube media

This first provider MVP is intentionally separate from the shared local-player transport. Shared transport/source-state integration remains the next provider step.

## Real-device validation still required

- YouTube provider URL parsing and player load on Android Chrome/PWA
- YouTube Play/Pause/seek/volume/rate controls
- embed-restricted video error behavior
- YouTube screen-off/background behavior on the tested Android environment
- longer multi-file local sessions
- lock-screen Previous specifically
- local video in longer playlists
- recording while locked/backgrounded
- larger FFmpeg files near the guard
- true folder import on a compatible picker/browser
- iPhone Safari / installed web-app playback and Media Session behavior
- service-worker update/offline behavior

## Not implemented yet

- YouTube integration with the shared main-player transport/source state
- YouTube playlist handling
- YouTube + recorder behavior validation
- markers/bookmarks
- sample-accurate synchronized recording
- playback + microphone digital mixdown
- audio trim/fade/normalization tools
- album-art/wave-ring/spectrum/VU player visuals
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
- named playlists reference saved local media instead of duplicating media Blobs
- YouTube playback uses the official embedded IFrame Player API
- YouTube stream downloading/audio extraction is not a project feature
- provider capabilities are surfaced instead of assumed
- background behavior is platform-dependent; tested local Android Chrome/PWA is confirmed working

## Immediate next step

1. validate the first YouTube IFrame provider on Android Chrome/PWA
2. after PASS, integrate YouTube into the shared player transport/source state
3. evaluate provider-specific background and playlist behavior
4. add markers/bookmarks and richer visualizers after the provider boundary is stable

Do not describe planned work as implemented work.
