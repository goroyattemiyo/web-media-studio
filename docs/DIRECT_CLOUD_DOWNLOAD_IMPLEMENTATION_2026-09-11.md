# Direct Cloud Download implementation — 2026-09-11

## Decision

The normal WMS Download flow no longer depends on Colab or a temporary `gradio.live` URL.

Normal user flow:

`WMS -> Download -> format -> rights confirmation -> Google auth -> Cloud Run media-worker -> browser Download`

GitHub remains the source of truth, CI and deployment origin. Runtime media conversion is performed by the existing `wms-media-worker` Cloud Run service because GitHub Pages is static hosting and cannot run yt-dlp/FFmpeg itself.

## UI

`DirectCloudDownloadPanel` replaces the mounted Colab Companion shell in the normal WMS UI.

The panel is only shown after a Download action is selected. It exposes only:

- target title/provider
- MP3 / M4A / WAV
- MP3 bitrate when applicable
- explicit rights/permission confirmation
- Google authentication status
- one Download button

The old Colab/Gradio implementation remains in the repository as a diagnostic/fallback asset but is not mounted in the normal WMS UI.

## Authentication

Production `/extract` remains protected by Google Identity Services and the worker allowlist.

- `VITE_GOOGLE_CLIENT_ID` is a public OAuth client identifier injected by Pages CI.
- Google ID tokens are held only in page/session state and `sessionStorage`.
- The browser sends `Authorization: Bearer <ID token>` to `/auth/me` and `/extract`.
- Worker verifies signature, audience, verified email and `ALLOWED_GOOGLE_EMAILS`.
- Expired/rejected tokens are discarded and the UI asks for authentication again.

## Rights gate

Rights confirmation is enforced twice:

1. UI disables Download until the user explicitly confirms rights/permission.
2. Worker `/extract` requires `rights_confirmed=true` and rejects the request before yt-dlp is called otherwise.

The confirmation resets after every successful Download.

## Worker limits and guardrails

Inherited from the existing media worker:

- YouTube URLs/video IDs only for extraction
- maximum duration 1800 seconds
- maximum source estimate 750 MiB
- playlist disabled
- no YouTube account cookies
- no proxy rotation
- no DRM/authentication bypass
- Cloud Run concurrency 1, max instances 2

## Validation gates

Before merge:

- Pages Typecheck PASS
- Pages Build PASS
- Media Worker pytest PASS
- Media Worker Docker build/runtime PASS

After merge:

- Cloud Run deployment PASS
- GitHub Pages deployment PASS
- authorized Android real-device MP3 direct Download
- M4A/WAV smoke test after MP3 succeeds

A successful deployment alone does not prove YouTube extraction. The real-device production Download remains the final runtime acceptance gate.
