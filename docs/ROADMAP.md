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

Exit criteria:

- app is reachable from GitHub Pages: PASS
- local audio playback works on tested Android Chrome/PWA: PASS
- `main` build is green: PASS

Desktop regression coverage is still useful but is not blocking ongoing mobile-first development.

## Phase 2 — Library and playlists

Status: persistent media Blob storage is merged in PR #12 and deployed; Android persistence validation is pending.

- [~] directory import — progressive enhancement only; tested Android picker does not provide true whole-directory import
- [x] media filtering
- [~] IndexedDB media storage — implementation merged/deployed; device validation pending
- [ ] saved named playlists
- [~] reorder/remove/add controls — import, Save, Delete and Clear-temp implemented; reorder remains
- [ ] resume position
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

- saved local media survives reload/PWA restart and remains playable: DEVICE TEST PENDING
- deleted saved media stays deleted after reload: DEVICE TEST PENDING
- saved named playlists can be restored: NOT YET MET

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

Start after persistent local library + saved playlists are stable.

- [ ] URL parsing
- [ ] official IFrame Player API integration
- [ ] transport adapter
- [ ] playlist support where appropriate
- [ ] source capability display
- [ ] recording while YouTube is playing where browser permissions allow
- [ ] background behavior documented/tested

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

## Current priority

1. pass Android persistent-media reload/PWA-restart validation
2. add saved named playlists
3. add reorder and resume-position behavior
4. then Phase 6 official YouTube provider

## Version targets

- `v0.1.0`: local player + PWA + themes
- `v0.2.0`: playlists/library persistence
- `v0.3.0`: recorder
- `v0.4.0`: FFmpeg audio tools
- `v0.5.0`: YouTube provider
- `v0.6.x`: advanced player features
- `v1.0.0`: stable public release after mobile regression coverage
