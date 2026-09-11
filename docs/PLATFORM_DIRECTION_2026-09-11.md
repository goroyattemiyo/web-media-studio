# WMS Platform Direction — 2026-09-11

Status: **Canonical product direction**

This document records the product decision made after the Cloud Run and Colab extraction experiments. When this document conflicts with older provider/download planning documents, this document takes precedence for future product work.

## 1. Product goal

WMS is moving from a browser-only media studio toward a local-first personal media player that can receive a media URL from the app the user is already viewing, save permitted media locally, organize it into playlists, and continue playback with the phone screen off.

Primary user journey:

`Watch media anywhere -> Share to WMS -> Save locally -> Add to playlist -> Listen/play offline -> Continue with screen off`

The product is not YouTube-specific. The same acquisition boundary should be able to handle public, technically supported URLs from sources such as YouTube, Instagram Reels, TikTok and other media sites, subject to source availability and access restrictions.

## 2. Platform roles

### WMS Android — primary new target

The Android app becomes the highest-priority product track.

Responsibilities:

- receive URLs from Android `Share` / `ACTION_SEND`
- resolve supported public media URLs locally on the device
- download user-authorized media to device storage
- support audio-first localizing with MP3/M4A and later video output
- add completed media automatically to the local WMS library
- add items to playlists
- play local media through Android Media3
- continue local playback while the screen is off
- expose Android system/lock-screen playback controls
- work without Colab, `gradio.live`, Cloud Run media extraction, or a browser tab once media has been saved

Distribution target: **development/private APK distribution only**. Google Play publication is not a goal for this phase.

### WMS Web / PWA — keep, but narrow its role

The existing GitHub Pages app remains useful and should not be discarded.

Responsibilities:

- browser/PWA player and UI reference
- local file library and playlists
- browser-side FFmpeg tools
- recording features
- provider playback experiments using official browser interfaces
- product UI prototyping

Remote-site extraction is no longer a requirement for the Web/PWA product. Browser limitations, provider restrictions and data-center egress restrictions make it a poor primary acquisition runtime.

### Cloud Run media-worker — support/diagnostic backend

Cloud Run remains available for bounded APIs such as provider search and controlled experiments.

It is **not** the normal media acquisition runtime for YouTube or similar providers unless future evidence proves a reliable, policy-compatible path.

The 2026-09-11 direct Cloud Run Download experiment reached deployment successfully but failed the real production extraction gate due to provider-side restriction. Deployment success must not be confused with extraction success.

### Colab Companion — fallback/diagnostic only

The Colab route proved that current yt-dlp + FFmpeg processing can work in a user-run environment, including MP3, M4A and WAV on the tested Android device.

However, requiring users to open Colab, start a runtime and manage a temporary Gradio URL is too much friction for the core product journey.

Keep the Colab implementation in the repository for diagnostics and fallback testing, but remove it from the long-term primary UX.

### Desktop WMS — later native track

A future Windows/local desktop app may use the same local acquisition concept as Android with native yt-dlp/FFmpeg execution.

### Browser extension — later companion only

A development-only Chrome extension is not the main application. Its future job is simply:

`Current browser page -> Send URL to desktop WMS`

Android does not need this extension because the Android share sheet already provides the better handoff path.

## 3. Provider model

WMS should not hard-code the product around one provider.

At the acquisition boundary, every source is a URL plus metadata/capabilities. A local resolver decides whether the URL is supported.

Initial target categories:

- YouTube public URLs
- TikTok public URLs
- Instagram public Reels/posts where no account-only access is required
- direct public media URLs
- additional yt-dlp-supported public sources after real-device verification

Support is **best effort per URL/source**, not a blanket promise that every URL on a named service will download.

## 4. Safety, access and product boundaries

The native app remains user-operated and local-first.

- no automatic acquisition merely because a URL was shared
- user explicitly chooses to save/localize
- first-run notice: save only media the user owns or is otherwise permitted to save
- no account-cookie harvesting
- no proxy rotation as an automatic workaround
- no DRM bypass
- no authentication/access-control bypass
- private/login-only media is not a target for the first implementation
- sanitize extractor errors before presenting them to the user
- treat all URLs and remote metadata as untrusted input

## 5. Repository strategy

`goroyattemiyo/web-media-studio` remains the WMS product source of truth for platform direction and shared product decisions.

The recommended implementation topology is:

- `goroyattemiyo/web-media-studio` — current Web/PWA code + canonical cross-platform product docs
- `goroyattemiyo/web-media-studio-android` — dedicated native Android implementation once bootstrapped
- future desktop/extension repositories only when those tracks actually start

Do not force the native Android build into the existing Vite/Web CI pipeline merely to keep one repository.

## 6. Android technology decision

Preferred direction:

- Kotlin
- Jetpack Compose
- AndroidX Media3 / ExoPlayer
- `MediaLibraryService` for background playback and system media controls
- Room for media/playlist/job metadata
- app-private media storage as the canonical library, with explicit export to MediaStore/Downloads later
- Android share intents for URL intake
- local acquisition engine behind an interface so the embedded yt-dlp implementation can be replaced without rewriting the app

Fastest extraction-engine candidate for the feasibility spike: `youtubedl-android` + its FFmpeg module. It currently packages yt-dlp/Python for Android and is GPL-3.0 licensed, so licensing must be reviewed before distribution expands beyond the intended development/private scope.

Do not couple UI, library or playback directly to that library. The app owns a `MediaAcquisitionEngine` abstraction.

## 7. UX principle

The normal Android flow must remain simple.

Share target opens a compact import sheet rather than a developer console.

Minimum intended flow:

1. share a URL to WMS
2. WMS shows detected source/title when available
3. choose `Audio` or `Video` (MVP may ship audio first)
4. tap `Save to WMS`
5. progress is visible in-app/notification
6. completed item appears in Library and can be added to/current playlist
7. playback continues through lock/screen-off using the native media service

No Colab setup, temporary endpoint registration or cloud authentication should appear in this primary flow.

## 8. Priority decision

Effective immediately, the highest-priority development sequence is:

1. Android local-extraction feasibility spike
2. native Android shell + share target
3. native local library + Media3 background playback
4. acquisition -> library -> playlist end-to-end flow
5. provider coverage validation for public YouTube/TikTok/Instagram/direct URLs
6. signed development APK workflow
7. desktop/Chrome extension only after the Android loop is useful in daily use

Older roadmap items remain historical/secondary unless they block this direction.
