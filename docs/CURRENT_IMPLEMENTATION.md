# Current Implementation

Last updated: 2026-09-07 JST

## Repository state

The repository foundation, Phase 1 player bootstrap, Recorder MVP, IndexedDB recording persistence, and FFmpeg video-to-audio tools are merged to `main`. GitHub Pages is enabled and production deployment has completed successfully.

Public URL:

`https://goroyattemiyo.github.io/web-media-studio/`

Recorder, persistence, and FFmpeg audio extraction/conversion have passed the requested Android real-device checks. Folder import and continuous playlist playback are now being implemented on `feat/folder-playlist`.

## Implemented in the Phase 1 player bootstrap

- React + TypeScript + Vite application
- root `index.html` configured for the GitHub Pages/Vite entry point
- GitHub Pages base path: `/web-media-studio/`
- polished responsive mobile-first player shell
- five switchable skins: Midnight Neon, Obsidian, Studio Light, Analog Warm, Cyber Blue
- theme persistence through local storage
- local audio/video multi-file import
- local audio/video playback
- play/pause, previous/next, ±10-second seek, timeline seek
- volume and playback-speed controls
- shuffle
- repeat off/all/one
- A-B loop controls
- initial Media Session metadata/action handlers
- runtime capability panel
- PWA manifest and same-origin app-shell service worker
- GitHub Pages build/deploy workflow
- pull-request typecheck/build validation

## Implemented in Recorder MVP (merged PR #6)

- browser microphone capture using `getUserMedia`
- `MediaRecorder` based local recording
- music-oriented audio constraints requesting echo cancellation, noise suppression and automatic gain control off
- mic-only recording
- Play & Record mode
- live recording duration and REC state
- source track name and approximate start position attached to each take
- take playback, deletion and device download
- browser-supported recording MIME selection

Recorder MVP deliberately does not claim sample-accurate sync. Playback audio is not digitally mixed into the take; only the microphone stream is recorded.

## Implemented: IndexedDB recording persistence (merged PR #7)

- IndexedDB database: `web-media-studio`
- recording store: `recording-takes`
- recording Blob and metadata stored together on device
- saved takes restored after page startup
- restored Blobs receive temporary object URLs for playback/download
- deleting a take removes it from IndexedDB
- fallback remains usable if persistence fails

Android real-device persistence checks passed: take survives reload and browser/PWA reopen, remains playable, and deletion remains deleted after reload.

## Implemented: FFmpeg video -> audio (merged PR #8)

- browser-side `@ffmpeg/ffmpeg` single-thread engine
- FFmpeg engine loaded on demand only when Tools is first used
- local browser processing; selected media is not uploaded to an application server
- current mobile MVP input guard: 250 MB
- Original stream-copy extraction where compatible
- MP3 192 kbps conversion via `libmp3lame`
- WAV PCM 16-bit / 48 kHz stereo conversion
- progress/status display
- result audio preview and Save to device
- bottom Tools navigation

Android real-device checks passed for FFmpeg initial load, Original extraction, MP3 conversion, WAV conversion, preview, and device save.

## In progress: folder playlist

Feature branch: `feat/folder-playlist`

- separate Files and Folder import actions
- folder selection through `webkitdirectory` / directory attribute where supported
- audio/video-only filtering
- natural path sorting so numbered tracks stay in expected order
- relative folder path retained and shown in the playlist
- loaded root folders displayed as chips
- folder media appended to the current playlist
- playlist Clear action revokes temporary object URLs
- track completion advances to the next playlist item and attempts continuous playback
- manual next/previous keeps playback running when the previous track was already playing

This phase is not considered device-confirmed until Android folder selection and continuous next-track playback pass.

## Automated checks

Latest `main` Pages workflow before this feature branch:

- dependency install: PASS
- TypeScript typecheck: PASS
- Vite production build: PASS
- Configure Pages: PASS
- Pages artifact upload: PASS
- Deploy to GitHub Pages: PASS

## Real-device validation

Observed on Android phone on 2026-09-07:

- GitHub Pages loads successfully: PASS
- local MP3 import/playback: PASS
- theme/skin switching: PASS
- mobile layout refinements: PASS
- microphone permission and mic recording: PASS
- Stop & Save followed by take playback: PASS
- Play & Record with local media: PASS
- saved recording download flow: PASS
- IndexedDB take survives normal page reload: PASS
- IndexedDB take survives closing and reopening Chrome/PWA: PASS
- restored take remains playable/downloadable: PASS
- deleting a persisted take remains deleted after reload: PASS
- FFmpeg engine initial load: PASS
- Original audio extraction: PASS
- MP3 conversion/playback/save: PASS
- WAV conversion/playback/save: PASS

## Real-device validation still required

Do not mark the following as supported until checked on target hardware/browser:

- Android folder chooser opens from Folder button
- one folder imports all supported audio/video files
- relative paths and track order display correctly
- track ending automatically continues into the next playlist item
- long folder playlists remain usable
- Android Chrome background playback continuity
- Android installed-PWA background behavior
- lock-screen Media Session controls
- local video behavior in longer playlists
- recording behavior while screen is locked/backgrounded
- larger FFmpeg files near the MVP guard
- iPhone Safari / installed web-app behavior
- service-worker update/offline behavior

API detection in the UI is not equivalent to successful real-device behavior.

## Not implemented yet

- persistent local media library across reloads
- saved named playlists
- sample-accurate synchronized recording
- playback + microphone digital mixdown
- audio trim/fade/normalization tools
- YouTube provider
- direct URL provider
- waveform/spectrum/EQ
- automated browser E2E tests

## Confirmed product decisions

- repository: `goroyattemiyo/web-media-studio`
- initial hosting: GitHub Pages
- architecture: mobile-first client-side PWA
- local-first storage for recordings/library metadata
- switchable visual skins
- advanced music-player features including A-B repeat and playback speed
- browser-side FFmpeg for local video/audio processing
- FFmpeg loads on demand rather than at app startup
- GitHub Pages uses single-thread FFmpeg because cross-origin isolation is not assumed
- YouTube playback will use the official embedded player/API
- YouTube audio/video stream downloading is not a project feature
- background playback is a best-effort capability and must be tested on real devices

## Immediate next step

1. run folder-playlist typecheck/build
2. merge after green CI
3. deploy to GitHub Pages
4. on Android, open Playlist and select Folder
5. confirm all supported media appears in natural path order
6. start track 1 and verify track 2 starts automatically when track 1 ends
7. verify Clear releases the playlist and a second folder can be loaded cleanly
8. after folder playlist PASS, continue background/lock-screen validation and URL/YouTube providers

Do not describe planned work as implemented work.
