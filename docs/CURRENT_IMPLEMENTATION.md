# Current Implementation

Last updated: 2026-09-08 JST

## Repository state

The repository foundation, player bootstrap, Recorder MVP, IndexedDB recording persistence, FFmpeg video-to-audio tools, local playlist improvements, Android background/Media Session validation, persistent local media library, WMS branding, switchable player visuals, persistent queue reorder, resume-position behavior, saved named playlists, YouTube official IFrame playback, Google-authenticated Localize worker integration, UI v2 tool deck, PO Token worker experiment, current-tab recording, clearer Tab audio capability UX, and Local Player / YouTube playback arbitration are merged to `main`.

Public URL:

`https://goroyattemiyo.github.io/web-media-studio/`

Recorder, recording persistence, FFmpeg extraction/conversion, Android multi-file import, continuous playback, local-media screen-off playback, installed-PWA background playback, tested lock-screen controls, persistent local media-library behavior, queue-order persistence, saved-media resume behavior, and saved named playlists have passed the requested Android real-device checks.

PR #32 (`feat: clarify tab audio support and arbitrate playback`) passed PR typecheck/build CI, was squash-merged to `main` as `e22fe2b44b3f544339024a3bb5803996dc9639a3`, and the subsequent GitHub Pages build/deploy checks completed successfully. Real-device validation of the new Tab audio unavailable-state UX and playback arbitration remains required.

## Implemented player foundation

- React + TypeScript + Vite
- GitHub Pages deployment
- mobile-first PWA shell
- five switchable skins
- local audio/video import and playback
- play/pause, previous/next, ±10-second seek and timeline seek
- volume and speed controls
- shuffle and repeat off/all/one
- A-B loop
- Media Session metadata/action handlers
- capability panel
- service worker and manifest
- WMS diamond/monogram SVG branding
- initial switchable player visuals: `Emblem Spin` and `Minimal`

## Implemented Recorder MVP (merged PR #6)

- browser microphone capture using `getUserMedia`
- `MediaRecorder` local recording
- mic-only take capture
- Play & Record mode
- live duration and REC state
- source track/start-position metadata
- take playback, deletion and download

Recorder MVP does not claim sample-accurate synchronization and does not digitally mix playback audio into the take. Current intended use is karaoke-style vocal practice, instrument practice, and quick performance-note recording while a source track plays.

## Implemented recording persistence (merged PR #7)

- IndexedDB database: `web-media-studio`
- recording store: `recording-takes`
- recording Blob and metadata stored together
- takes restored after reload/PWA restart
- deleting a take persists across reloads

Android real-device persistence checks passed.

## Implemented current-tab recording (merged PR #30)

- capture modes: `Mic`, `Tab audio`, `Tab + Mic`
- tab/display capture through `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })`
- only the resulting audio tracks are recorded
- `Tab + Mic` mixes the captured tab and microphone through `AudioContext` / `MediaStreamDestination`
- tab recordings are stored in Saved Takes and the Local Library, subject to the existing per-file limit
- capture stops if the selected shared surface ends
- missing audio-track errors explain that the current tab and tab-audio sharing must be selected
- no Cloud Run or yt-dlp dependency for recording

Platform capability is feature-detected. Since PR #32, unsupported devices show an explicit Tab audio status and reason instead of only dimmed controls. The check distinguishes an insecure context from missing `getDisplayMedia`. Android Chrome/PWA may not expose `getDisplayMedia`; desktop Chrome/Edge remains the primary validation target for tab-audio capture.

## Implemented FFmpeg video -> audio (merged PR #8)

- lazy-loaded single-thread `@ffmpeg/ffmpeg`
- local browser processing only
- 250 MB mobile input guard
- Original stream-copy extraction when compatible
- MP3 192 kbps
- WAV PCM 16-bit / 48 kHz stereo
- progress/status UI
- preview and Save to device

Android real-device checks passed for FFmpeg initial load, Original extraction, MP3, WAV, preview and save.

## Implemented local playlist / folder progressive enhancement (merged PR #9)

- multiple media-file selection
- optional Folder input using `webkitdirectory` / `directory`
- audio/video filtering
- natural sorting
- relative path display when provided by the picker
- continuous next-track playback
- next/previous while playback is running

On the tested Android picker, Folder falls back to normal file selection. Multiple-file selection is therefore the primary Android import path. Folder remains a progressive enhancement for compatible desktop/browser-picker combinations.

## Android background / Media Session validation

Confirmed on the tested Android Chrome/PWA environment for local media:

- multiple-file playlist playback: PASS
- automatic next-track continuation: PASS
- screen-off playback for at least 30 seconds: PASS
- lock-screen controls appear: PASS
- lock-screen Pause -> Play: PASS
- lock-screen Next: PASS
- next-track continuation while screen remains off: PASS
- installed-PWA background/lock-screen sequence: PASS

These results apply only to the tested Android environment and do not imply identical behavior on iOS or every Android device/browser. The official embedded YouTube player is different: screen-off/background playback stopped on the tested Android device. `Keep screen on` only uses Screen Wake Lock to prevent automatic screen-off while visible.

## Implemented persistent local media library (merged PR #12)

- shared IndexedDB schema upgraded from version 1 to version 2
- existing `recording-takes` data preserved during schema upgrade
- new `media-library` object store
- per-item Save and Save-all actions
- saved media Blob + metadata stored locally in IndexedDB
- saved media restored automatically at app startup
- per-item Delete removes the persistent Blob from IndexedDB
- Clear temp removes only unsaved imports and leaves saved media intact
- 250 MB per-item mobile-MVP save guard
- 500 MB saved-media soft limit
- browser quota check before saving when StorageManager estimate is available
- best-effort request for persistent browser storage
- saved count, saved bytes, quota estimate and storage-protection status UI
- no application-server upload

Android real-device validation:

- saved media survives normal reload and remains playable: PASS
- saved media survives closing/reopening Chrome/PWA: PASS
- Clear temp removes only unsaved items: PASS
- deleting a saved item remains deleted after reload: PASS
- existing saved recording takes survive IndexedDB version-2 upgrade: PASS

## Implemented branding / visual foundation (merged PRs #15 and #16)

- approved WMS-style thick rounded diamond emblem traced into SVG
- WMS SVG shared by PWA/app icon, header brand mark, and audio-player artwork
- initial visual selector with `Emblem Spin` and `Minimal`
- visual choice persists in localStorage
- concise Japanese section descriptions
- service-worker cache version refreshed for branding changes

Future visual modes remain candidates, not implemented yet: album art, wave ring, spectrum, VU meter and other visualizers.

## Implemented queue reorder and resume position (merged PR #17)

- ↑ / ↓ queue-order controls
- currently selected track remains selected while rows move
- saved-library order is persisted back to IndexedDB
- temporary imports can be reordered for the current session
- saved-media playback position is stored locally
- saved media restores its previous position when reopened
- near-start / near-end positions are ignored
- track completion clears its stored resume point
- deleting saved media also clears its stored resume point
- automatic next-track playback intentionally starts the next track at 0:00 instead of applying an old resume point

Android Chrome/PWA real-device validation:

- saved queue order survives reload: PASS
- saved media resumes near the stored position after pause/reload: PASS
- completed tracks reopen from 0:00: PASS
- automatic next-track playback starts the next item from 0:00: PASS
- background/lock-screen playback regression check: PASS

## Implemented saved named playlists (merged PR #18)

- IndexedDB schema version 3 adds a `saved-playlists` object store while preserving existing recording/media stores
- create a named playlist from the current queue's saved media
- temporary unsaved imports are excluded from named playlists
- load a saved playlist as the active playback queue
- update an active playlist from the current queue
- delete a playlist without deleting its underlying saved media
- `All media` restores the full saved-media catalog view
- queue-only `×` removes a track from the current queue without deleting the saved media
- ↑ / ↓ updates the active named-playlist order when one is loaded
- deleting saved media removes its ID from stored playlists

Android Chrome/PWA real-device validation:

- playlist creation and persistence across reload/PWA restart: PASS
- loading restores only selected saved media in expected order: PASS
- reorder persists when playlist is loaded again: PASS
- Update changes the stored playlist snapshot: PASS
- deleting playlist leaves underlying saved media available in All media: PASS

## Implemented YouTube official IFrame provider

- isolated provider adapter under `src/providers/youtube.ts`
- YouTube watch/youtu.be/Shorts/embed/live URL parsing plus direct 11-character video IDs
- `t=` / `start=` start-position parsing
- lazy loading of the official `https://www.youtube.com/iframe_api` script
- official `YT.Player` construction with `playsinline` and page `origin`
- provider-local Play / Pause / ±10 seconds / seek / volume / supported playback-rate controls
- player status, title, elapsed time and duration display
- YouTube embed error mapping for invalid/unavailable/non-embeddable videos
- autoplay-blocked status handling
- capability display: playback supported, download unsupported, screen-off limitation explicit
- Screen Wake Lock option to keep the screen on during foreground playback where available
- explicit UI note that Web Media Studio does not download or extract media through the official embedded player

Foreground playback has been validated. On the tested Android environment, embedded YouTube playback stops when the screen turns off; WMS does not claim otherwise.

## Implemented playback arbitration (merged PR #32)

A small central `playbackArbiter` coordinates audible ownership without coupling `App.tsx` and `YouTubeProviderPanel.tsx` directly.

Implemented behavior:

- a Local Player play event claims the local playback source and pauses YouTube
- YouTube entering the playing state claims the YouTube playback source and pauses the Local Player
- the WMS YouTube Play action claims YouTube before playback starts
- changing the active WMS card to YouTube pauses local playback
- changing the active WMS card to Player or Library pauses YouTube
- direct IFrame-player starts and local HTMLMediaElement starts are covered in addition to WMS buttons

PR typecheck/build CI: PASS. GitHub Pages post-merge build/deploy: PASS. Real-device regression validation remains pending.

## YouTube -> Local / Cloud Run worker

- Google Sign-In is implemented and confirmed working
- production worker auth uses Google ID token verification plus an allowed-email list
- old worker API-key fallback has been removed
- YouTube cloud restriction errors are sanitized to a short WMS `LIMITED` state
- no YouTube account cookies, proxy rotation, DRM bypass, or authentication-bypass mechanisms are used
- PR #29 added the controlled PO Token experiment using `bgutil-ytdlp-pot-provider==1.3.2`, Node, pinned provider source, `mweb`, and `YOUTUBE_PO_TOKEN_MODE=bgutil-script-mweb`
- PR #29 CI passed its Python tests, Docker build/start, health, FFmpeg, Node, provider plugin and provider script checks

Production deployment status for PR #29 is now confirmed as **not yet deployed**. The latest `Deploy Media Worker to Cloud Run` workflow run is run #5, started at 2026-09-08 08:27 JST from commit `1530b7630fd06ea92502ff8008bd5c08258d9429`, before PR #29 merged at 09:00 JST. That deployed workflow revision does not contain `YOUTUBE_PO_TOKEN_MODE=bgutil-script-mweb`. Therefore the same-video PO Token production retest must wait until a new manual Cloud Run deployment is run from current `main`.

## Real-device validation still required

- Android unavailable-state UI for Tab audio after PR #32
- desktop Chrome/Edge: Tab audio -> Saved Take -> Local Library -> local playback
- Local Player / YouTube mutual exclusion while switching WMS cards
- mutual exclusion when playback is started directly inside the YouTube iframe
- longer multi-file local sessions
- lock-screen Previous specifically
- local video in longer playlists
- recording while locked/backgrounded
- larger FFmpeg files near the guard
- true folder import on a compatible picker/browser
- iPhone Safari / installed web-app playback and Media Session behavior
- service-worker update/offline behavior

## Not implemented yet

- one fully unified transport/state model across local and YouTube backends; current arbitration only prevents conflicting audible playback
- YouTube playlist handling
- sample-accurate synchronized recording
- playback + microphone digital mixdown outside the implemented Tab + Mic capture path
- audio trim/fade/normalization tools
- album-art/wave-ring/spectrum/VU player visuals
- direct URL provider
- automated browser E2E tests

## Confirmed product decisions

- repository: `goroyattemiyo/web-media-studio`
- hosting: GitHub Pages
- architecture: mobile-first client-side PWA
- local-first storage
- Android primary import path: multiple local file selection
- Folder import is progressive enhancement
- browser-side FFmpeg loads on demand
- WMS diamond emblem is the primary app-brand mark
- player visuals should be switchable rather than fixed to a single animation
- named playlists reference saved local media instead of duplicating media Blobs
- YouTube playback uses the official embedded IFrame Player API
- YouTube embedded playback and the separate authorized Localize worker are distinct paths
- provider capabilities are surfaced instead of assumed
- background behavior is platform-dependent; tested local Android Chrome/PWA background playback works, while tested embedded YouTube screen-off playback stops

## Immediate next step

1. validate Android unavailable-state UX and Local Player / YouTube playback arbitration on the deployed PR #32 build
2. validate Tab audio end-to-end on desktop Chrome/Edge
3. manually run `Deploy Media Worker to Cloud Run` from current `main` so PR #29 is actually deployed
4. retry the same previously blocked video and record `SUCCESS` vs `LIMITED`
5. if the same video remains `LIMITED`, treat Cloud Run/datacenter egress restriction as the stronger suspected cause rather than adding account cookies or proxy rotation

Do not describe planned work as implemented work.
