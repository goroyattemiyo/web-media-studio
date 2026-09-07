# Roadmap

## Phase 0 — Repository foundation

- [x] Create repository
- [x] Initial commit
- [x] Establish requirements/architecture/status docs
- [x] Add development guidance
- [x] Create bootstrap PR

## Phase 1 — App shell and player core

Goal: deployed, installable PWA with a reliable local-media player.

Status: Android/GitHub Pages exit criteria are met for the tested device/browser combination.

- [x] React + TypeScript + Vite bootstrap
- [x] GitHub Pages base path
- [x] responsive app shell
- [x] PWA manifest/service worker
- [x] local file import
- [x] audio/video playback
- [x] play/pause/seek/volume
- [x] previous/next
- [x] playback speed
- [x] repeat/shuffle
- [x] A-B loop
- [x] player state model
- [x] theme system
- [x] five skins
- [x] GitHub Actions CI/build/deploy
- [~] switchable player visuals — Emblem Spin / Minimal implemented; richer visualizers remain

Exit criteria:

- app is reachable from GitHub Pages: PASS
- local audio playback works on tested Android Chrome/PWA: PASS
- `main` build is green: PASS

## Phase 2 — Library and playlists

Status: persistent media Blob storage, queue reorder, resume position and saved named playlists are merged and pass Android Chrome/PWA validation.

- [~] directory import — progressive enhancement only; tested Android picker does not provide true whole-directory import
- [x] media filtering
- [x] IndexedDB media storage
- [x] saved named playlists
- [x] reorder/remove/add controls — import, Save, Delete, Clear-temp, ↑/↓ reorder and queue-only × implemented
- [x] resume position — saved-library media remembers previous playback position
- [ ] markers/bookmarks
- [x] remaining skins
- [x] Android multi-file import
- [x] continuous next-track playback
- [x] explicit per-item Save and Save-all actions
- [x] saved-media automatic restore on app startup
- [x] saved-media Delete persistence
- [x] storage usage/quota guard UI

Persistent-library MVP guards:

- 250 MB per saved item
- 500 MB saved-media soft limit
- browser quota check before save when StorageManager estimate is available

Exit criteria:

- saved local media survives reload/PWA restart and remains playable: PASS on tested Android Chrome/PWA
- deleted saved media stays deleted after reload: PASS
- existing recording takes survive IndexedDB schema upgrade: PASS
- saved queue order persists: PASS
- saved media resumes from previous position: PASS
- saved named playlists survive restart and restore expected order/items: PASS

## Phase 3 — Recording

Status: MVP and recording persistence pass Android real-device validation.

- [x] microphone permissions
- [x] MediaRecorder implementation
- [ ] count-in
- [~] playback + record synchronization — practical Play & Record implemented; not sample-accurate
- [ ] chunked recording strategy
- [x] take metadata
- [x] recording library
- [x] delete/play/export
- [~] storage-limit/error handling — fallback exists; broader quota UX remains

Exit criteria:

- user can practice against local playback and keep multiple takes safely: PASS for current MVP

## Phase 4 — Background/media-session behavior

Status: tested Android Chrome and installed-PWA sequence passes. iOS remains unverified.

- [x] Media Session metadata
- [x] lock-screen actions used in Android test
- [x] background playback tests on Android
- [x] Android Chrome/PWA validation
- [ ] iOS Safari/web-app validation
- [x] capability UI for unsupported/restricted behavior
- [x] screen-off next-track continuation on tested Android device

Exit criteria:

- supported tested Android environment exposes working lock-screen transport controls: PASS
- limitations are documented instead of hidden: PASS

## Phase 5 — FFmpeg audio tools

Status: core extraction/conversion MVP passes Android real-device validation.

- [x] lazy-loaded ffmpeg.wasm
- [x] loading/progress/error UI
- [ ] inspect input metadata UI
- [x] original audio stream extraction when compatible
- [~] MP3 presets — 192 kbps implemented; 320/128 remain
- [x] WAV preset
- [ ] trim
- [x] output download
- [ ] large-file/mobile stress tests near the current guard

Exit criteria:

- local video can be converted/extracted to an audio file without server upload: PASS

## Phase 6 — YouTube provider

Status: first official-IFrame provider MVP is implemented on `feat/youtube-iframe-provider`; automated and device validation are pending.

- [x] URL parsing — watch, youtu.be, Shorts, embed/live forms and direct video IDs
- [x] official IFrame Player API integration — lazy loaded
- [~] transport adapter — provider-local play/pause/±10/seek/volume/rate implemented; shared main-player transport integration remains
- [ ] playlist support where appropriate
- [x] source capability display — playback yes, download no, background device-dependent
- [ ] recording while YouTube is playing where browser permissions allow
- [ ] background behavior documented/tested

Non-goal:

- YouTube stream/audio extraction or downloading

## Phase 7 — Advanced player/audio features

Candidates, prioritized after real use:

- album artwork visual mode
- wave-ring visual mode
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

## Current priority

1. validate the first YouTube IFrame provider on Android Chrome/PWA
2. integrate YouTube into the shared main-player transport/source state
3. evaluate YouTube playlist handling and provider-specific background limits
4. markers/bookmarks and richer visualizers after the provider boundary is stable

## Version targets

- `v0.1.0`: local player + PWA + themes
- `v0.2.0`: playlists/library persistence
- `v0.3.0`: recorder
- `v0.4.0`: FFmpeg audio tools
- `v0.5.0`: YouTube provider
- `v0.6.x`: advanced player features
- `v1.0.0`: stable public release after mobile regression coverage
