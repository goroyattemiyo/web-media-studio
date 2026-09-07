# Architecture

## 1. Overview

`web-media-studio` is a client-first PWA. The core player, recorder, local library and FFmpeg tools run in the browser. Remote providers are integrated through explicit adapters.

```text
UI / Themes
    |
    +-- Player UI
    +-- Playlist UI
    +-- Recorder UI
    +-- Tools UI
    +-- Library UI
            |
            v
Application services
    |
    +-- PlayerEngine
    +-- RecorderService
    +-- LibraryService
    +-- PlaylistService
    +-- MediaSessionService
    +-- FFmpegService
    +-- ProviderRegistry
            |
            v
Browser platform APIs
    |
    +-- HTMLMediaElement
    +-- Web Audio API
    +-- MediaRecorder
    +-- Media Session
    +-- File APIs
    +-- IndexedDB
    +-- Service Worker
    +-- ffmpeg.wasm
```

## 2. Planned stack

- React
- TypeScript
- Vite
- PWA plugin/service worker
- Dexie for IndexedDB access
- Web Audio API
- MediaRecorder API
- Media Session API
- ffmpeg.wasm
- YouTube IFrame Player API

## 3. High-level modules

```text
src/
├─ app/
├─ components/
├─ features/
│  ├─ player/
│  ├─ playlist/
│  ├─ recorder/
│  ├─ library/
│  ├─ tools/
│  └─ settings/
├─ providers/
│  ├─ local/
│  ├─ direct-media/
│  └─ youtube/
├─ services/
│  ├─ media-session/
│  ├─ storage/
│  └─ ffmpeg/
├─ themes/
├─ types/
└─ utils/
```

Feature folders own UI and feature-specific logic. Shared platform integrations live under `services/`. External-source behavior lives under `providers/`.

## 4. Media provider contract

Providers must declare capabilities instead of forcing all sources through one implementation.

```ts
export type Capability = boolean | 'best-effort'

export interface ProviderCapabilities {
  playback: Capability
  playlist: Capability
  download: Capability
  background: Capability
}

export interface MediaProvider {
  id: string
  canHandle(input: string): boolean
  resolve(input: string): Promise<MediaItem>
  capabilities: ProviderCapabilities
}
```

Examples:

- Local file: playback=true, playlist=true, background=best-effort
- Direct media: capabilities depend on browser/origin
- YouTube: playback=true, download=false, background=best-effort

## 5. Player engine

The player engine should expose one app-level state model even when playback backends differ.

Planned responsibilities:

- transport state
- current item/index
- current time/duration
- playback rate
- volume/mute
- repeat/shuffle
- A-B loop
- Media Session integration
- event normalization

The first implementation should prioritize HTMLMediaElement-backed local/direct media. YouTube should be added through an adapter without coupling core transport logic to the YouTube API.

## 6. Audio processing graph

For local/direct media that can be routed through Web Audio:

```text
MediaElementSource
      |
      +--> EQ/filter nodes
      +--> gain/balance
      +--> analyser
      +--> limiter (if boost is enabled)
      |
      v
AudioDestination
```

Visualization and EQ are progressive enhancements. Basic playback must still work when Web Audio features are unavailable.

## 7. Recorder architecture

Initial recorder path:

```text
getUserMedia({ audio: true })
        |
        v
MediaStream
        |
        v
MediaRecorder
        |
        +-- periodic chunks
        |
        v
local persistent storage
```

Recordings remain separate from embedded/protected playback audio in the first implementation.

Record metadata should reference the source item and playback position at recording start.

## 8. Storage model

Use IndexedDB through Dexie.

Planned stores:

- `mediaItems`
- `playlists`
- `playlistItems`
- `recordings`
- `recordingBlobs`
- `markers`
- `settings`

Large Blob storage must be tested on target mobile browsers before finalizing retention strategy. Export/download should always be available to avoid trapping user recordings inside browser storage.

## 9. FFmpeg architecture

FFmpeg must not be part of the initial player bundle.

```text
Tools UI
   |
   v
loadFFmpeg() -- lazy import
   |
   v
FFmpegService
   |
   +-- inspect input
   +-- extract audio
   +-- convert audio
   +-- trim
   +-- progress events
   |
   v
output Blob / download
```

Initial GitHub Pages target should use the single-thread-compatible ffmpeg.wasm core. A future deployment platform may enable cross-origin isolation and a multithread core.

## 10. Theme architecture

Components should use semantic design tokens:

```css
--color-bg
--color-surface
--color-surface-elevated
--color-text
--color-text-muted
--color-accent
--color-accent-secondary
--color-danger
--radius-panel
--shadow-panel
--player-glow
```

Themes override tokens, not component structure.

## 11. PWA and background playback

The service worker is for app-shell/offline assets, not for bypassing provider restrictions.

Media Session integration should register handlers for supported actions such as:

- play
- pause
- previous track
- next track
- seek backward
- seek forward

Background playback must be tested per OS/browser/source combination and surfaced as a capability, not assumed.

## 12. Deployment architecture

Phase 1:

```text
GitHub repository
   |
GitHub Actions
   |
Vite build
   |
GitHub Pages
```

Possible future architecture if server features become necessary:

```text
GitHub Pages / Cloudflare Pages
            |
            +--> constrained API/Worker
```

A future API must not become an unrestricted arbitrary-media proxy.

## 13. Engineering rules

- Keep core playback independent from FFmpeg.
- Keep providers independent from player UI.
- Avoid hidden global mutable state.
- Prefer typed capability checks over browser-name branching.
- Feature-detect APIs.
- Keep `main` deployable.
- Add a regression test whenever a bug exposes a reusable failure mode.
