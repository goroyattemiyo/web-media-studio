# WMS Colab Companion v2 — C3 Source Handoff

Date: 2026-09-11 JST
Status: IMPLEMENTED / CI PASS / REAL-DEVICE E2E PENDING

## Implemented

WMS Download actions now route into the C2 Companion shell while keeping the proven C1 Companion runtime unchanged.

Supported source actions:

- loaded YouTube card -> Download
- Video Search result -> Download

WMS prepares only these query parameters:

- `wms_source`
- `wms_title`
- `wms_provider`
- `wms_format`

The default WMS handoff format is `mp3`. The Companion UI can still change the format to MP3 / M4A / WAV before execution.

## Connected flow

1. User clicks Download in WMS.
2. WMS captures the selected source metadata.
3. If a valid Companion `gradio.live` session is connected, WMS reloads the embedded Companion using the session URL plus the prepared query parameters.
4. Gradio `demo.load()` reads the query parameters and prefills Source URL / Title / Provider / Format.
5. The user must explicitly confirm rights inside Companion.
6. The user starts Localize and downloads the generated file.

## Offline / expired flow

If Companion is not connected, or the user has marked the session expired:

- the selected Download target is retained in WMS state
- WMS scrolls to the Companion panel
- the user starts/restarts the Colab Companion and registers the new `gradio.live` URL
- connecting/reconnecting automatically applies the retained source handoff

## Fallback

The old one-cell Colab Localizer remains explicitly available in the Companion fallback area.

The old first-download modal interceptor is no longer mounted because it would compete with the Companion Download route.

## Guardrails

- WMS never sends rights confirmation as confirmed
- per-job rights confirmation remains mandatory inside Companion
- sessionStorage stores only the base `gradio.live` URL, not media metadata
- Companion session URL must be `https://*.gradio.live`
- handed-off source must be HTTP or HTTPS and may not contain username/password credentials
- no cookies, proxy controls, DRM/auth bypass, arbitrary yt-dlp flags, or Drive mount were added

## Automated checks

PR branch GitHub Actions:

- dependency install: PASS
- TypeScript typecheck: PASS
- production build: PASS

## C4 real-device validation

Validate on the deployed WMS origin:

1. Start Companion from the WMS panel and connect the current `gradio.live` URL.
2. Load a YouTube URL in the YouTube card and click Download.
3. Confirm the embedded Companion shows the same Source URL, Title, Provider=`youtube`, Format=`mp3`.
4. Confirm rights manually and generate MP3.
5. Repeat with a Video Search result Download.
6. Change Companion format to M4A and WAV and smoke-test one output each.
7. Mark the session expired, click another Download, restart Colab, connect the new URL, and confirm the retained source is transferred.
8. Confirm Player / YouTube playback arbitration, Play Next, Local Library import, Recorder, and Audio tools still behave as before.

Do not mark C4 PASS until these real-device checks complete.
