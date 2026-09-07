# Current Implementation

Last updated: 2026-09-07 JST

## Repository state

The repository foundation and Phase 1 player bootstrap are merged to `main`. GitHub Pages is enabled and the production deployment workflow has completed successfully.

Public URL:

`https://goroyattemiyo.github.io/web-media-studio/`

Recorder MVP is implemented on PR #6 (`feat/recorder-mvp`) and has passed pull-request typecheck/build validation. Real-device recording validation is still required before it is marked as confirmed on Android.

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

## Implemented in Recorder MVP (PR #6)

- browser microphone capture using `getUserMedia`
- `MediaRecorder` based local recording
- music-oriented audio constraints requesting echo cancellation, noise suppression and automatic gain control off
- mic-only recording
- Play & Record mode that starts the selected local media and microphone recording together
- live recording duration display
- REC state in the bottom navigation
- source track name and approximate start position attached to each take
- in-memory take list
- take playback
- take deletion
- take download to device
- browser-supported recording MIME selection (`webm/opus`, `webm`, `mp4`, or `ogg/opus`)

Recorder MVP deliberately does not claim sample-accurate sync. Playback audio is not digitally mixed into the take; only the microphone stream is recorded.

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
- first mobile layout refinement: deployed
- Media ready/player centering refinement: deployed
- Media Session reported unavailable in the first browser used for screenshots; direct Chrome/PWA validation is still required

## Real-device validation still required

Do not mark the following as supported until checked on target hardware/browser:

- Android Chrome background playback continuity
- Android installed-PWA behavior
- lock-screen Media Session controls
- local video behavior
- A-B loop behavior under actual playback
- microphone permission prompt
- mic-only recording -> stop -> local take playback
- Play & Record while local media is playing
- take download on Android Chrome/PWA
- recording behavior while screen is locked/backgrounded
- iPhone Safari / installed web-app behavior
- service-worker update/offline behavior

API detection in the UI is not equivalent to successful real-device behavior.

## Not implemented yet

- persistent library / IndexedDB / Dexie
- persistent recording/take storage across reloads
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

1. merge PR #6 after green CI
2. deploy Recorder MVP to GitHub Pages
3. test Android Chrome/PWA mic permission and mic-only recording
4. test Play & Record with a local track
5. verify take playback and device download
6. separately test screen-off/background playback and lock-screen controls
7. fix device-specific issues before adding IndexedDB persistence and FFmpeg

Do not describe planned work as implemented work.
