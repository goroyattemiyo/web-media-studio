# Requirements

## 1. Product goal

Create a polished mobile-first web media studio that behaves like a capable music/video player, supports microphone recording during playback, manages local media as playlists, and provides browser-side FFmpeg audio extraction/conversion.

## 2. Primary targets

1. Android Chrome / installed PWA
2. Desktop Chrome / Edge
3. iPhone Safari / installed web app where practical

Browser/OS differences must be treated as explicit capability differences rather than hidden failures.

## 3. Core player requirements

- Play local audio and video files.
- Load multiple files and directory selections into a library.
- Build, save, reorder and replay playlists.
- Play/pause, previous/next, seek, ±10 seconds, volume and mute.
- Playback speed presets from at least 0.5x to 2.0x.
- Shuffle, repeat-one and repeat-all.
- A-B loop with adjustable A/B points.
- Resume last playback position where reasonable.
- Optional waveform/spectrum visualization.
- Media Session metadata and supported lock-screen controls.
- Best-effort background playback; never claim universal background-playback guarantees.

## 4. Recording requirements

- Request microphone access only when the user starts recording.
- Record microphone input while a media item continues playing.
- Support synchronized "play + record" with an optional count-in.
- Store recordings locally first.
- Record metadata: source media, source position, start time, duration, MIME type and notes.
- Support rename, playback, delete and download/export.
- Support multiple takes per source item.

The initial recorder captures microphone input separately from protected/embedded source audio.

## 5. Library and playlist requirements

- Import individual local files.
- Import directory selections using browser-supported directory/file APIs.
- Preserve relative-path metadata when exposed by the browser.
- Filter unsupported files without crashing.
- Save library metadata and playlists locally.
- Expose source capability badges such as local, direct URL and YouTube.

## 6. URL/provider requirements

Provider architecture must be extensible.

### YouTube

- Accept YouTube video URLs.
- Play through the official YouTube IFrame Player API.
- Support YouTube playlist integration where the official API permits it.
- Do not implement YouTube audio/video extraction or stream downloading.
- Background playback is best effort and may be restricted by YouTube, browser or OS behavior.

### Direct media URL

- Support direct audio/video URLs when browser fetch/playback and origin policy allow it.
- Allow download only when technically and legally permitted by the origin.

### Future providers

New providers must declare capabilities for playback, playlist, download and background behavior.

## 7. FFmpeg requirements

Use ffmpeg.wasm in the browser for media processing.

Initial tools:

- video -> audio extraction
- original audio stream extraction when safe/compatible
- MP3 conversion presets
- WAV conversion presets
- trim selection

Future tools:

- fades
- normalization
- additional codecs/formats

FFmpeg must be lazy-loaded so normal player startup does not pay the FFmpeg bundle cost.

GitHub Pages deployment should initially use the single-thread-compatible FFmpeg path unless cross-origin isolation is proven available.

## 8. Theme/skin requirements

At least five switchable skins are planned:

- Midnight Neon
- Obsidian
- Studio Light
- Analog Warm
- Cyber Blue

Themes must use design tokens/CSS variables rather than duplicate component styling.
Theme selection must persist locally.

## 9. PWA requirements

- Installable manifest.
- Service worker for app-shell caching.
- Responsive mobile-first layout.
- Avoid pretending remote media is available offline when it is not.

## 10. Privacy and security

- Core local-file playback and recording should not require upload to a server.
- Never commit API keys, tokens, cookies or secrets.
- Treat external URLs as untrusted input.
- Do not build an unrestricted server-side proxy.
- Do not silently upload recordings.

## 11. Deployment

Initial deployment target:

`https://goroyattemiyo.github.io/web-media-studio/`

Deployment should eventually be performed by GitHub Actions from `main` after CI succeeds.

## 12. Definition of MVP

The first usable MVP is complete when an Android Chrome user can:

1. open/install the PWA,
2. choose a folder of local audio files,
3. play them continuously as a playlist,
4. use playback speed and A-B repeat,
5. record microphone audio while playback continues,
6. save and replay the take,
7. export the recording,
8. invoke FFmpeg to extract audio from a local video,
9. switch visual skins,
10. use supported Media Session controls,
11. load the deployed app from GitHub Pages.
