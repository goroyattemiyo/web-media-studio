# Roadmap

## Phase 0 — Repository foundation

- [x] Create repository
- [x] Initial commit
- [ ] Establish requirements/architecture/status docs
- [ ] Add development guidance
- [ ] Create bootstrap PR

## Phase 1 — App shell and player core

Goal: deployed, installable PWA with a reliable local-media player.

- React + TypeScript + Vite bootstrap
- GitHub Pages base path
- responsive app shell
- PWA manifest/service worker
- local file import
- audio/video playback
- play/pause/seek/volume/mute
- previous/next
- playback speed
- repeat/shuffle
- A-B loop
- player state model
- initial theme system
- at least 2 production-quality skins
- GitHub Actions CI/build/deploy

Exit criteria:

- app is reachable from GitHub Pages
- local media playback works on Android Chrome and desktop Chrome/Edge
- `main` build is green

## Phase 2 — Library and playlists

- directory import
- media filtering
- IndexedDB/Dexie storage
- saved playlists
- reorder/remove/add
- resume position
- markers/bookmarks
- remaining skins

Exit criteria:

- a selected folder can become a persistent playlist/library view

## Phase 3 — Recording

- microphone permissions
- MediaRecorder implementation
- count-in
- playback + record synchronization
- chunked recording strategy
- take metadata
- recording library
- rename/delete/play/export
- storage-limit/error handling

Exit criteria:

- user can practice against local playback and keep multiple takes safely

## Phase 4 — Background/media-session behavior

- Media Session metadata
- lock-screen actions
- background playback tests
- Android Chrome/PWA validation
- iOS Safari/web-app validation
- capability UI for unsupported/restricted behavior

Exit criteria:

- supported platforms expose reliable lock-screen transport controls
- limitations are documented instead of hidden

## Phase 5 — FFmpeg audio tools

- lazy-loaded ffmpeg.wasm
- loading/progress/error UI
- inspect input metadata
- original audio stream extraction when compatible
- MP3 320/192/128 kbps presets
- WAV presets
- trim
- output download
- large-file/mobile stress tests

Exit criteria:

- local video can be converted/extracted to an audio file without server upload

## Phase 6 — YouTube provider

- URL parsing
- official IFrame Player API integration
- transport adapter
- playlist support where appropriate
- source capability display
- recording while YouTube is playing where browser permissions allow
- background behavior documented/tested

Non-goal:

- YouTube stream/audio extraction or downloading

## Phase 7 — Advanced player/audio features

Candidates, prioritized after real use:

- waveform overview
- spectrum analyser
- VU meters
- 3-band or 10-band EQ
- stereo/mono/balance controls
- safe gain boost/limiter
- sleep timer
- crossfade where architecture permits
- per-track settings

## Phase 8 — Additional providers

- direct media URL adapter
- podcast/feed adapter
- additional services only where their official interfaces/policies permit the desired functionality

## Phase 9 — AI-assisted workflow

Only after the core media app is stable:

- speech-to-text integration
- transcript storage
- AI transcript cleanup
- subtitle generation
- reel-caption workflow
- optional FFmpeg caption render pipeline

## Version targets

- `v0.1.0`: local player + PWA + themes
- `v0.2.0`: playlists/library
- `v0.3.0`: recorder
- `v0.4.0`: FFmpeg audio tools
- `v0.5.0`: YouTube provider
- `v0.6.x`: advanced player features
- `v1.0.0`: stable public release after mobile regression coverage
