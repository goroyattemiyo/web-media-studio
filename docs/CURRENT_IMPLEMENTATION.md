# Current Implementation

Last updated: 2026-09-07 JST

## Repository state

The repository exists and has an initial `main` branch commit.

Current implementation is intentionally minimal. Product/runtime code has not yet been bootstrapped.

## Implemented

- public GitHub repository created
- default branch is `main`
- Node-oriented `.gitignore`
- initial README/description

## Not implemented yet

- React/Vite application
- PWA manifest/service worker
- GitHub Pages workflow
- local media player
- playlist/library
- directory import
- Media Session integration
- background playback validation
- microphone recorder
- IndexedDB persistence
- theme system
- ffmpeg.wasm
- YouTube provider
- tests/CI

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

Bootstrap Phase 1 on a feature branch:

1. React + TypeScript + Vite
2. stable project structure
3. minimal theme tokens
4. app shell/player screen
5. local audio file import and playback
6. test/build scripts
7. GitHub Pages deployment workflow

Do not mark features complete in this document until they are implemented and checked.
