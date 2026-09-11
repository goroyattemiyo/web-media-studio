# web-media-studio

WMS is a local-first media project for turning media the user is already viewing into a personal local library and playlist experience.

## Current product direction

The project started as a mobile-first Web/PWA media studio. That Web/PWA remains useful for local playback, recording, playlists and browser-side FFmpeg tools.

The new primary development target is a **native Android WMS app** focused on this flow:

`Watch media -> Share to WMS -> Save locally -> Playlist -> Offline/background playback`

Android development/private APK distribution is the target. Google Play publication is not part of the current phase.

See the canonical product decision:

- `docs/PLATFORM_DIRECTION_2026-09-11.md`
- `docs/ANDROID_NATIVE_ARCHITECTURE_2026-09-11.md`
- `docs/ANDROID_NATIVE_PHASE_PLAN_2026-09-11.md`

## Platform roles

### Web / PWA

- local audio/video playback
- local media library and playlists
- microphone/tab recording experiments
- browser-side FFmpeg audio extraction/conversion
- YouTube playback through the official IFrame Player API
- UI/product prototyping

Public Web/PWA URL:

`https://goroyattemiyo.github.io/web-media-studio/`

### Android — next primary implementation

Planned native responsibilities:

- receive media URLs through Android Share
- locally acquire supported public/user-permitted media
- save completed media into the WMS local library
- persistent playlists
- Media3/ExoPlayer playback
- screen-off/background playback
- Android lock-screen/system media controls
- no Colab or Cloud Run extraction requirement in the normal flow

### Cloud Run / Colab

Cloud Run remains support/diagnostic infrastructure. Provider-side restrictions have made it unsuitable as the normal media-extraction runtime in current tests.

Colab proved a user-run yt-dlp/FFmpeg route can work, but the setup and temporary-session UX are too cumbersome for the core product. It is retained as fallback/diagnostic work rather than the long-term primary interface.

## Source-provider policy

WMS is not YouTube-specific. The native acquisition architecture is intended to handle technically supported public URLs from providers such as YouTube, TikTok, Instagram Reels and direct media sources on a best-effort, real-device-verified basis.

The project does not target account-cookie harvesting, proxy rotation, DRM bypass, authentication/access-control bypass or private/login-only media in the initial native implementation.

Users should save only media they own or are otherwise permitted to save.

## Engineering principles

- Mobile first
- Local first
- Privacy conscious
- Provider-capability driven
- Explicit user action before remote-media acquisition
- Keep playback independent from extraction/FFmpeg
- Keep extractor implementation replaceable behind an acquisition interface
- Keep `main` deployable
- CI plus real-device gates for platform-specific behavior

## Repository strategy

This repository remains the WMS cross-platform product source of truth and contains the current Web/PWA implementation.

The recommended native implementation split is:

- `goroyattemiyo/web-media-studio` — Web/PWA + canonical product docs
- `goroyattemiyo/web-media-studio-android` — dedicated Android implementation after bootstrap

Future desktop/Chrome-extension repositories are deferred until the Android end-to-end loop is proven useful.

## Historical Web/PWA docs

These remain useful for existing implementation details but are secondary to the current platform-direction documents when they conflict:

- `docs/CURRENT_IMPLEMENTATION.md`
- `docs/REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`

## License

No project-wide open-source license has been granted at this stage. Third-party native dependencies must be reviewed separately before distribution expands beyond the current development/private scope.
