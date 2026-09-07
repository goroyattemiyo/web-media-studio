# Current Implementation

Last updated: 2026-09-07 JST

## Repository state

The repository foundation and Phase 1 player bootstrap are merged to `main`. GitHub Pages is enabled and the production deployment workflow has completed successfully.

Public URL:

`https://goroyattemiyo.github.io/web-media-studio/`

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

Latest `main` Pages workflow:

- dependency install: PASS
- TypeScript typecheck: PASS
- Vite production build: PASS
- Configure Pages: PASS
- Pages artifact upload: PASS
- Deploy to GitHub Pages: PASS

## Real-device validation

Observed on Android phone on 2026-09-07:

- GitHub Pages loads successfully: PASS
- local MP3 import: PASS
- local audio playback: PASS
- theme/skin switching: PASS
- Service Worker capability detection: PASS
- Media Recorder capability detection: PASS
- Web Audio capability detection: PASS
- Media Session reported unavailable in the browser used for the screenshot; Chrome/PWA validation is still required

The first real-device screenshots also exposed two mobile layout issues:

- the fixed bottom navigation can overlap content visually while scrolling
- the horizontal quick-control row can clip the rightmost A-B control

A mobile layout refinement is being applied before the next device pass.

## Real-device validation still required

Do not mark the following as supported until checked on target hardware/browser:

- Android Chrome background playback continuity
- Android installed-PWA behavior
- lock-screen Media Session controls
- local video behavior
- A-B loop behavior under actual playback
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

1. deploy the real-device mobile layout refinement
2. re-check the A-B control layout and bottom navigation spacing
3. open the site in Android Chrome directly (not an in-app browser)
4. test screen-off/background playback and lock-screen controls
5. install as a PWA and repeat the playback test
6. fix device-specific issues before persistent library/recording work

Do not describe planned work as implemented work.
