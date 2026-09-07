# web-media-studio

Mobile-first PWA media player, recorder and FFmpeg-powered audio toolkit.

## Goal

Build a polished browser-based media studio that works well on smartphones and desktops, with:

- local audio/video playback
- folder-based playlists
- microphone recording while media is playing
- background playback where the browser/OS allows it
- lock-screen/media-session controls
- multiple switchable visual skins
- advanced player controls such as A-B repeat and playback speed
- browser-side FFmpeg audio extraction and conversion
- YouTube playback through the official IFrame Player API
- provider adapters for additional sources that permit playback/download

## Product principles

- Mobile first
- Local first
- Privacy conscious
- Progressive enhancement
- Fast player startup
- FFmpeg loaded only when media processing is requested
- No hidden server dependency for the core player
- `main` should stay deployable

## Planned stack

- React
- TypeScript
- Vite
- PWA / Service Worker
- Web Audio API
- MediaRecorder API
- Media Session API
- IndexedDB / Dexie
- ffmpeg.wasm
- YouTube IFrame Player API

## Hosting

The initial public deployment target is GitHub Pages.

Planned URL:

`https://goroyattemiyo.github.io/web-media-studio/`

## Source-provider policy

YouTube support is planned for playback and playlist integration through the official YouTube player API. The project will not implement extraction/downloading of YouTube audio streams.

Direct media URLs may be imported only where the origin permits access and downloading.

## Development status

Repository bootstrap in progress. See:

- `docs/REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/CURRENT_IMPLEMENTATION.md`

## License

No open-source license has been granted at this stage.
