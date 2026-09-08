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

Status: microphone MVP and persistence pass Android real-device validation. Current-tab audio capture and clearer unsupported-device capability UX are merged; desktop capture validation remains.

- [x] microphone permissions
- [x] MediaRecorder implementation
- [ ] count-in
- [~] playback + record synchronization — practical Play & Record implemented; not sample-accurate
- [ ] chunked recording strategy
- [x] take metadata
- [x] recording library
- [x] delete/play/export
- [~] storage-limit/error handling — fallback exists; broader quota UX remains
- [x] current-tab audio capture where `getDisplayMedia` provides an audio track
- [x] Tab + Mic mixing through Web Audio
- [x] Tab / Tab + Mic capture saved to Saved Takes and Local Library
- [x] unsupported-device capability UX — merged in PR #32; real-device UX validation pending
- [ ] desktop Chrome/Edge end-to-end Tab audio validation

Exit criteria:

- user can practice against local playback and keep multiple takes safely: PASS for microphone MVP
- supported desktop environment can record current-tab audio and restore it through Local Library: pending real-device validation

## Phase 4 — Background/media-session behavior

Status: tested Android Chrome and installed-PWA sequence passes for local media. Embedded YouTube screen-off playback stops on the tested Android device and is documented as unsupported in that environment.

- [x] Media Session metadata
- [x] lock-screen actions used in Android test
- [x] background playback tests on Android
- [x] Android Chrome/PWA validation for local media
- [ ] iOS Safari/web-app validation
- [x] capability UI for unsupported/restricted behavior
- [x] screen-off next-track continuation on tested Android device for local media
- [x] embedded YouTube screen-off limitation documented
- [x] Screen Wake Lock option for foreground embedded YouTube playback where supported

Exit criteria:

- supported tested Android environment exposes working local-media lock-screen transport controls: PASS
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

Status: official-IFrame provider is merged and foreground playback is working. Local Player / YouTube playback conflict prevention is merged in PR #32; a fully unified cross-provider transport/state model remains future work.

- [x] URL parsing — watch, youtu.be, Shorts, embed/live forms and direct video IDs
- [x] official IFrame Player API integration — lazy loaded
- [x] provider-local play/pause/±10/seek/volume/rate controls
- [x] shared playback coordination — Local Player / YouTube mutual exclusion merged in PR #32; real-device regression validation pending
- [ ] one unified transport/state model across local and YouTube backends
- [ ] playlist support where appropriate
- [x] source capability display — playback yes, download no, screen-off limitation explicit
- [~] recording while YouTube is playing — current-tab capture path implemented where browser permissions/APIs allow; desktop validation pending
- [x] tested Android embedded-YouTube screen-off behavior documented

Non-goal:

- using the official embedded player to download or extract media

## Phase 6B — Authorized YouTube -> Local worker

Status: Google-authenticated Localize flow is implemented but remains `LIMITED` / experimental. The first PO Token/mweb production experiment failed. A fresh Colab comparison then showed that standard yt-dlp with Deno + EJS could enumerate playable audio formats while the forced WMS `mweb` path failed separately. The worker is therefore being revised to use the current standard yt-dlp JavaScript path by default and keep PO Token/mweb as an explicit fallback experiment only.

- [x] Google Sign-In client flow
- [x] Google ID token verification in worker
- [x] allowed-email restriction
- [x] sanitized `LIMITED` response for YouTube cloud restrictions
- [x] PR #29 PO Token experiment configuration: bgutil provider + Node + mweb + env flag
- [x] PR #29 worker CI / container validation
- [x] deploy PR #29 configuration to Cloud Run — run #6 success from `main`
- [x] production retest of the previously blocked video — FAIL
- [x] production retest with a separate copyright-free video — FAIL
- [x] run the original GitHub Actions diagnostic — FAIL with explicit `Sign in to confirm you're not a bot` on the tested Azure-hosted runner
- [x] run a fresh Colab standard-yt-dlp probe with Deno + EJS — PASS for metadata/player data/audio-format discovery
- [x] reproduce the WMS `mweb` path in Colab — FAIL because usable `mweb` media formats required a GVS PO Token
- [x] revise worker image to include Deno and `yt-dlp[default]` / EJS
- [x] change Cloud Run configuration candidate to `YOUTUBE_PO_TOKEN_MODE=off`
- [x] change the GitHub diagnostic default to `standard-deno-ejs`, retaining `po-token-mweb` as an optional comparison
- [~] root-cause assessment — both execution-environment restrictions and the previous forced-client configuration matter; neither should be treated as the sole proven cause
- [ ] pass worker CI with Deno/EJS runtime verification
- [ ] deploy the revised standard-client worker to Cloud Run
- [ ] production retest with an authorized test video after revised deployment
- [ ] identify a compliant and reliable server-side route before re-enabling this as a normal product path

GitHub Actions diagnostic guardrails:

- manual `workflow_dispatch` only
- not connected to the public WMS UI
- tester must confirm ownership or permission before download/conversion
- short-lived diagnostic artifacts only
- a successful diagnostic does not make GitHub Actions an approved production backend

General guardrails:

- no YouTube account cookies
- no proxy rotation as an automatic workaround
- no DRM bypass or authentication bypass
- do not imply that PO Token solved the production restriction
- do not describe format discovery alone as a completed media download

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

1. pass PR CI for the revised Deno + EJS + standard-client worker path
2. deploy the revised worker to Cloud Run and verify `YOUTUBE_PO_TOKEN_MODE=off`
3. retest an authorized video and capture the exact backend result
4. keep Cloud Run Localize clearly marked `LIMITED` until the revised production path is proven reliable
5. validate Android unavailable-state UX and Local Player / YouTube playback arbitration from PR #32
6. validate desktop Chrome/Edge Tab audio end-to-end
7. use the official IFrame player for normal YouTube playback and current-tab capture for authorized desktop capture where supported
8. markers/bookmarks and richer visualizers after the provider boundary is stable

## Version targets

- `v0.1.0`: local player + PWA + themes
- `v0.2.0`: playlists/library persistence
- `v0.3.0`: recorder
- `v0.4.0`: FFmpeg audio tools
- `v0.5.0`: YouTube provider
- `v0.6.x`: advanced player features
- `v1.0.0`: stable public release after mobile regression coverage
