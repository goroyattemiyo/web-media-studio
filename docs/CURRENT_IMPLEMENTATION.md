# Current Implementation

Last updated: 2026-09-07 JST

## Repository state

The repository foundation, Phase 1 player bootstrap, and Recorder MVP are merged to `main`. GitHub Pages is enabled and production deployment has completed successfully.

Public URL:

`https://goroyattemiyo.github.io/web-media-studio/`

Recorder MVP has now passed the requested Android real-device checks. IndexedDB recording persistence is being added on `feat/indexeddb-recordings` and must pass reload/PWA validation before it is marked confirmed.

## Implemented in the Phase 1 player bootstrap

- React + TypeScript + Vite application
- root `index.html` configured for the GitHub Pages/Vite entry point
- GitHub Pages base path: `/web-media-studio/`
- polished responsive mobile-first player shell
- five switchable skins:
  - Midnight Neon
  - Obsidian
  - Studio Light
  - Analog Warm
  - Cyber Blue
- theme persistence through local storage
- local audio/video multi-file import
- in-memory quick playlist
- local audio/video playback
- play/pause
- previous/next
- ±10-second seek
- timeline seek
- volume control
- playback speed presets
- shuffle
- repeat off/all/one
- A-B loop controls
- initial Media Session metadata/action handlers
- runtime capability panel for Service Worker / Media Session / Media Recorder / Web Audio detection
- PWA manifest
- basic same-origin app-shell service worker
- GitHub Pages build/deploy workflow
- pull-request typecheck/build validation

## Implemented in Recorder MVP (merged PR #6)

- browser microphone capture using `getUserMedia`
- `MediaRecorder` based local recording
- music-oriented audio constraints requesting echo cancellation, noise suppression and automatic gain control off
- mic-only recording
- Play & Record mode that starts selected local media and microphone recording together
- live recording duration display
- REC state in the bottom navigation
- source track name and approximate start position attached to each take
- take playback
- take deletion
- take download to device
- browser-supported recording MIME selection (`webm/opus`, `webm`, `mp4`, or `ogg/opus`)

Recorder MVP deliberately does not claim sample-accurate sync. Playback audio is not digitally mixed into the take; only the microphone stream is recorded.

## In progress: IndexedDB recording persistence

- IndexedDB database: `web-media-studio`
- recording store: `recording-takes`
- recording Blob and metadata stored together on device
- saved takes restored after page startup
- restored Blobs receive temporary object URLs for playback/download
- deleting a take removes it from IndexedDB
- fallback remains usable if IndexedDB persistence fails, with an explicit warning

This phase must be verified by recording a take, reloading/closing the app, reopening it, and confirming the take remains playable.

## Automated checks

Latest `main` Pages workflow:

- dependency install: PASS
- TypeScript typecheck: PASS
- Vite production build: PASS
- Configure Pages: PASS
- Pages artifact upload: PASS
- Deploy to GitHub Pages: PASS

Recorder MVP PR #6:

- dependency install: PASS
- TypeScript typecheck: PASS
- Vite production build: PASS

## Real-device validation

Observed on Android phone on 2026-09-07:

- GitHub Pages loads successfully: PASS
- local MP3 import: PASS
- local audio playback: PASS
- theme/skin switching: PASS
- Service Worker capability detection: PASS
- Media Recorder capability detection: PASS
- Web Audio capability detection: PASS
- mobile A-B control layout refinement: PASS visually after deployment
- Media ready/player centering refinement: PASS visually after deployment
- microphone permission and mic recording: PASS
- Stop & Save followed by take playback: PASS
- Play & Record with local media: PASS
- saved recording download flow: PASS
- Recorder MVP overall requested check: PASS

Media Session was reported unavailable in the first browser used for screenshots; direct Chrome/PWA background validation is still required.

## Real-device validation still required

Do not mark the following as supported until checked on target hardware/browser:

- IndexedDB take survives normal page reload
- IndexedDB take survives closing and reopening Chrome/PWA
- restored take remains playable and downloadable
- deleting a persisted take remains deleted after reload
- Android Chrome background playback continuity
- Android installed-PWA behavior
- lock-screen Media Session controls
- local video behavior
- A-B loop behavior under actual playback
- recording behavior while screen is locked/backgrounded
- iPhone Safari / installed web-app behavior
- service-worker update/offline behavior

API detection in the UI is not equivalent to successful real-device behavior.

## Not implemented yet

- persistent local media library
- directory import
- saved playlists
- sample-accurate synchronized recording
- playback + microphone digital mixdown
- FFmpeg / ffmpeg.wasm
- video -> audio extraction
- audio conversion/trim
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
- FFmpeg should load on demand rather than at app startup
- YouTube playback uses the official embedded player/API
- YouTube audio/video stream downloading is not a project feature
- background playback is a best-effort capability and must be tested on real devices

## Immediate next step

1. merge IndexedDB recording persistence after green CI
2. deploy to GitHub Pages
3. record one new take on Android
4. reload the page and confirm the take survives
5. close/reopen Chrome or installed PWA and confirm it survives again
6. delete the take and confirm the deletion survives reload
7. after persistence PASS, start FFmpeg audio-extraction phase
8. separately continue screen-off/background playback and Media Session testing

Do not describe planned work as implemented work.
