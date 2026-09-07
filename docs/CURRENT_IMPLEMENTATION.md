# Current Implementation

Last updated: 2026-09-07 JST

## Repository state

The repository foundation, Phase 1 player bootstrap, Recorder MVP, IndexedDB recording persistence, FFmpeg video-to-audio tools, and local playlist/folder improvements are merged to `main`. GitHub Pages is enabled and production deployment has completed successfully.

Public URL:

`https://goroyattemiyo.github.io/web-media-studio/`

Recorder, recording persistence, FFmpeg audio extraction/conversion, Android multi-file import, continuous playlist playback, screen-off playback, installed-PWA background playback, and the tested lock-screen Media Session controls have passed the requested Android real-device checks.

Android whole-folder selection remains browser/file-picker dependent and is not considered confirmed on the tested phone.

## Implemented in the Phase 1 player bootstrap

- React + TypeScript + Vite application
- root `index.html` configured for the GitHub Pages/Vite entry point
- GitHub Pages base path: `/web-media-studio/`
- polished responsive mobile-first player shell
- five switchable skins: Midnight Neon, Obsidian, Studio Light, Analog Warm, Cyber Blue
- theme persistence through local storage
- local audio/video multi-file import
- local audio/video playback
- play/pause, previous/next, ±10-second seek, timeline seek
- volume and playback-speed controls
- shuffle
- repeat off/all/one
- A-B loop controls
- initial Media Session metadata/action handlers
- runtime capability panel
- PWA manifest and same-origin app-shell service worker
- GitHub Pages build/deploy workflow
- pull-request typecheck/build validation

## Implemented in Recorder MVP (merged PR #6)

- browser microphone capture using `getUserMedia`
- `MediaRecorder` based local recording
- music-oriented audio constraints requesting echo cancellation, noise suppression and automatic gain control off
- mic-only recording
- Play & Record mode
- live recording duration and REC state
- source track name and approximate start position attached to each take
- take playback, deletion and device download
- browser-supported recording MIME selection

Recorder MVP deliberately does not claim sample-accurate sync. Playback audio is not digitally mixed into the take; only the microphone stream is recorded.

## Implemented: IndexedDB recording persistence (merged PR #7)

- IndexedDB database: `web-media-studio`
- recording store: `recording-takes`
- recording Blob and metadata stored together on device
- saved takes restored after page startup
- restored Blobs receive temporary object URLs for playback/download
- deleting a take removes it from IndexedDB
- fallback remains usable if persistence fails

Android real-device persistence checks passed: take survives reload and browser/PWA reopen, remains playable, and deletion remains deleted after reload.

## Implemented: FFmpeg video -> audio (merged PR #8)

- browser-side `@ffmpeg/ffmpeg` single-thread engine
- FFmpeg engine loaded on demand only when Tools is first used
- local browser processing; selected media is not uploaded to an application server
- current mobile MVP input guard: 250 MB
- Original stream-copy extraction where compatible
- MP3 192 kbps conversion via `libmp3lame`
- WAV PCM 16-bit / 48 kHz stereo conversion
- progress/status display
- result audio preview and Save to device
- bottom Tools navigation

Android real-device checks passed for FFmpeg initial load, Original extraction, MP3 conversion, WAV conversion, preview, and device save.

## Implemented: local playlist and folder progressive enhancement (merged PR #9)

- separate Files and Folder import actions
- regular Files input supports multiple media selection
- Folder selection uses `webkitdirectory` / `directory` where the browser/file picker supports true directory import
- audio/video-only filtering
- natural path sorting so numbered tracks stay in expected order
- relative folder path retained and shown when directory metadata is available
- loaded root folders displayed as chips when available
- playlist Clear action revokes temporary object URLs
- track completion advances to the next playlist item and attempts continuous playback
- manual next/previous keeps playback running when the previous track was already playing

Android target-device observation: tapping Folder opened a normal file chooser rather than importing an entire directory. Multiple file selection works and is the primary Android import path for now. Folder import remains progressive enhancement for desktop/compatible browser-file-picker combinations.

## Android background / Media Session validation

Observed on the tested Android device on 2026-09-07:

- multiple selected audio files form a playable playlist: PASS
- track ending automatically continues into the next playlist item: PASS
- Chrome playback continues after the screen is turned off for at least 30 seconds: PASS
- lock-screen playback controls appear: PASS
- lock-screen Pause -> Play control: PASS
- lock-screen Next control: PASS
- screen-off playback continues through the end of a track into the next playlist item: PASS
- installed-PWA background playback test: PASS
- installed-PWA lock-screen/background behavior requested in the same test sequence: PASS

These results are confirmed only for the tested Android Chrome/PWA environment. They do not imply identical behavior on iOS or every Android browser/device combination.

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
- local MP3 import/playback: PASS
- theme/skin switching: PASS
- mobile layout refinements: PASS
- microphone permission and mic recording: PASS
- Stop & Save followed by take playback: PASS
- Play & Record with local media: PASS
- saved recording download flow: PASS
- IndexedDB take survives normal page reload: PASS
- IndexedDB take survives closing and reopening Chrome/PWA: PASS
- restored take remains playable/downloadable: PASS
- deleting a persisted take remains deleted after reload: PASS
- FFmpeg engine initial load: PASS
- Original audio extraction: PASS
- MP3 conversion/playback/save: PASS
- WAV conversion/playback/save: PASS
- Android multiple-file media selection: PASS
- selected multiple files are added to the playlist and playable: PASS
- continuous next-track playback: PASS
- Android Chrome screen-off playback: PASS
- lock-screen player controls: PASS
- lock-screen pause/play: PASS
- lock-screen next-track action: PASS
- next-track continuation while screen is off: PASS
- installed-PWA background/lock-screen sequence: PASS
- Android whole-folder import through the tested Folder control: NOT CONFIRMED; tested picker fell back to normal file selection

## Real-device validation still required

Do not mark the following as supported until checked on target hardware/browser:

- long multi-file playlists remain usable over extended sessions
- lock-screen Previous action specifically
- local video behavior in longer playlists
- recording behavior while screen is locked/backgrounded
- larger FFmpeg files near the MVP guard
- true folder import on desktop or another compatible browser/file picker
- iPhone Safari / installed web-app playback and Media Session behavior
- service-worker update/offline behavior

API detection in the UI is not equivalent to successful real-device behavior.

## Not implemented yet

- persistent local media library across reloads
- saved named playlists
- playlist reorder/remove/add UI beyond Clear/import
- resume position
- markers/bookmarks
- sample-accurate synchronized recording
- playback + microphone digital mixdown
- audio trim/fade/normalization tools
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
- Android primary import path: multiple local file selection
- Folder import is progressive enhancement, not guaranteed mobile behavior
- browser-side FFmpeg for local video/audio processing
- FFmpeg loads on demand rather than at app startup
- GitHub Pages uses single-thread FFmpeg because cross-origin isolation is not assumed
- YouTube playback will use the official embedded player/API
- YouTube audio/video stream downloading is not a project feature
- background playback remains a platform-dependent capability, but the tested Android Chrome/PWA environment is confirmed working

## Immediate next step

The next core-product priority is persistent local media/library behavior because imported playlist media currently disappears after reload.

1. design a bounded IndexedDB media-library store separate from recording takes
2. allow selected local audio/video files to be explicitly saved into the app library
3. restore saved library items after reload/PWA restart
4. add delete/remove and storage-usage/error handling
5. add saved named playlists after persistent media works reliably
6. then continue with the official YouTube IFrame provider phase

Do not describe planned work as implemented work.
