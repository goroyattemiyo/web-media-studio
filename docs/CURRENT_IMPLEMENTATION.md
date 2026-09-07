# Current Implementation

Last updated: 2026-09-07 JST

## Repository state

The repository foundation is merged to `main`. Phase 1 application bootstrap is implemented on `feat/app-bootstrap` and has passed GitHub Actions typecheck/build validation.

## Implemented in the Phase 1 bootstrap

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

## Automated checks

PR #2 bootstrap validation:

- dependency install: PASS
- TypeScript typecheck: PASS
- Vite production build: PASS

Pages deployment is intentionally skipped on pull-request events and runs after merge/push to `main`.

## Real-device validation still required

Do not mark the following as supported until checked on target hardware:

- Android Chrome local audio playback
- Android installed-PWA behavior
- screen-off/background playback continuity
- lock-screen Media Session controls
- local video behavior
- iPhone Safari / installed web-app behavior
- service-worker update/offline behavior

API detection in the UI is not equivalent to successful background-playback validation.

## Not implemented yet

- persistent library / IndexedDB / Dexie
- directory import
- saved playlists
- microphone recording
- synchronized play + record
- recording/take storage
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

1. merge PR #2 after green build
2. verify GitHub Pages deployment
3. open the Pages URL on Android Chrome
4. test local audio/video, themes and transport controls
5. lock the screen and record actual Media Session/background behavior
6. fix any device-specific issues before moving to persistent library/recording work

Do not describe planned work as implemented work.
