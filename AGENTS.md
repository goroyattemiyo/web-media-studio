# AGENTS.md

## Purpose

This repository is developed with AI-assisted workflows. Treat the repository documents as the source of truth and do not invent implementation status.

## Source of truth order

1. `docs/PLATFORM_DIRECTION_2026-09-11.md` — current cross-platform product direction; supersedes older provider/download direction when they conflict
2. `docs/ANDROID_NATIVE_ARCHITECTURE_2026-09-11.md` — approved Android native design target
3. `docs/ANDROID_NATIVE_PHASE_PLAN_2026-09-11.md` — current Android execution sequence and gates
4. `docs/CURRENT_IMPLEMENTATION.md` — what actually exists now in the Web/PWA repository; historical sections may predate the platform pivot
5. `docs/REQUIREMENTS.md` — original Web/PWA requirements and constraints
6. `docs/ARCHITECTURE.md` — original Web/PWA technical structure
7. `docs/ROADMAP.md` — historical Web/PWA phased plan; secondary to the native-platform direction
8. `README.md` — public overview

When documents conflict, use the higher-priority document and update stale lower-priority documentation in the next relevant documentation pass instead of guessing.

## Development workflow

Use this sequence for non-trivial work:

1. Plan — identify requirement, affected modules, risks and acceptance criteria.
2. Execute — implement the smallest coherent change.
3. Test/Check — run lint, typecheck, tests and build relevant to the change.
4. Review — check regressions, platform implications, privacy and performance.
5. Improve — fix discovered issues and re-run checks.

Do not spend excessive time extending the plan once the implementation path is clear.

## Branch policy

- `main` is the deployable source of truth.
- Do feature work on `feat/*`, fixes on `fix/*`, and documentation-only changes on `docs/*` where practical.
- Prefer pull requests into `main`.
- Do not force-push `main`.

## Platform direction

- The existing Web/PWA remains a supported local-media player, recorder, browser FFmpeg toolset and UI reference.
- The new highest-priority product track is a dedicated native Android app focused on `Share URL -> local acquisition -> Library -> playlist -> screen-off playback`.
- The recommended Android code repository is `goroyattemiyo/web-media-studio-android` once bootstrapped.
- Do not force native Android code into the current Vite/Web build merely to keep one repository.
- Cloud Run media extraction and Colab/Gradio are not the long-term normal Android acquisition UX. Cloud Run remains support/diagnostic infrastructure; Colab remains fallback/diagnostic evidence.
- Chrome extension work is deferred until a desktop-native WMS track exists; Android should use the system share sheet.

## Architecture rules

- Mobile first.
- Local first for saved media and playback.
- Core playback must not depend on FFmpeg.
- Web FFmpeg must remain lazy-loaded.
- Native acquisition must be behind a replaceable `MediaAcquisitionEngine` boundary; do not couple Compose UI directly to yt-dlp wrappers.
- Providers must not leak provider-specific behavior into generic player UI/state.
- Use platform capability detection instead of browser/device-name assumptions where applicable.
- Keep `main` deployable.
- Add a regression test whenever a bug exposes a reusable failure mode.
- Browser/OS/device behavior requires real-device validation before being marked supported.

## Remote-media acquisition boundary

Web/PWA:

- YouTube playback continues to use the official embedded player.
- Do not make browser/Cloud Run extraction the required core path.

Native Android development build:

- Local acquisition of public, technically supported URLs may be implemented only after explicit user action.
- Target user-owned or otherwise permitted media.
- No account-cookie harvesting/import in the initial implementation.
- No proxy rotation as an automatic workaround.
- No DRM bypass.
- No authentication/access-control bypass.
- Login-only/private media is not an MVP target.
- Treat URLs and metadata as untrusted input and sanitize extractor errors/filenames.
- Do not expose arbitrary yt-dlp flags or filesystem paths through normal UI.

## FFmpeg boundary

The Web/PWA GitHub Pages deployment should assume a single-thread-compatible ffmpeg.wasm configuration unless cross-origin isolation has been explicitly verified.

Native Android FFmpeg/extractor code belongs behind the acquisition layer and must not become a dependency of native playback.

## UI/UX quality

The app should look like a finished media product rather than a developer utility.

- consistent spacing and typography
- responsive touch targets
- accessible focus/labels
- polished empty/loading/error states
- no raw extractor logs in normal UI
- Android primary import flow should stay compact: Share -> choose output -> Save to WMS
- advanced codec/provider diagnostics belong outside the normal path

## Testing expectations

Before declaring work complete, check as applicable:

Web/PWA:

- TypeScript typecheck
- production build
- local media playback regression
- mobile viewport behavior
- permission-denied paths for microphone/storage APIs

Android:

- Gradle build
- unit tests
- Android lint
- APK artifact build
- foreground acquisition lifecycle/cancel behavior
- local playback through Media3
- share-intent parsing
- Room/file cleanup behavior
- real-device screen-off and lock-screen controls

CI does not substitute for real-device provider/acquisition or background-playback tests.

## Documentation discipline

After a meaningful implementation step:

- update the relevant canonical platform/Android gate document
- update `docs/CURRENT_IMPLEMENTATION.md` for verified Web/PWA implementation changes
- update historical roadmap checkboxes only when that roadmap still applies
- document newly discovered platform/provider constraints

Do not describe planned work as implemented work.
