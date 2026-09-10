# WMS Colab Companion v2 — Phase Plan

Date: 2026-09-10
Status: DESIGN ONLY

## Decision

Do not replace the proven one-cell Colab Localizer yet. Add Gradio Companion v2 beside it and promote it only after iframe/download real-device gates pass.

## Phase order

1. **C0 Gate 0 PoC** — minimal Gradio app, share URL, WMS iframe, Android/desktop validation.
2. **C1 Companion UI/runtime** — rights/format/bitrate, one-job queue, yt-dlp + Deno + FFmpeg, Gradio File output.
3. **C2 WMS Companion shell** — URL connect, OFFLINE/READY/EXPIRED, iframe, reconnect/disconnect, old-Colab fallback.
4. **C3 Source handoff** — Video Search and loaded YouTube Download actions open Companion; postMessage if validated, copy/paste fallback otherwise.
5. **C4 End-to-end validation** — real MP3 download, M4A/WAV smoke tests, session-expiry recovery, playback/queue regression.
6. **C5 Optional** — direct result import only after CORS/security/memory evidence.

## Branch plan

- design: `plan/colab-gradio-companion-v2`
- Gate 0 implementation: `feat/colab-gradio-companion-gate0`
- Companion runtime/UI: `feat/colab-gradio-companion-v2`
- WMS integration: split further if Gate 0 indicates meaningful browser-specific risk.

## Merge gates

No production UI merge until Gate 0 proves one of these two supported modes:

- **Embedded mode:** `gradio.live` renders and works inside WMS iframe on desktop + Android.
- **Fallback mode:** WMS opens the Companion in a separate browser tab, with a clear reconnect/source-copy flow.

Do not work around frame restrictions with a proxy.

## MVP non-goals

- always-on Colab server
- automatic keep-alive / session bypass
- Google Drive mount
- direct WMS access to Colab filesystem
- automatic download without per-job rights confirmation
- cookie/proxy/DRM/auth bypass
- arbitrary yt-dlp flags
- multi-user service

## First implementation task after design approval

Create a separate minimal Gate 0 notebook/app that does only:

- launch a tiny Gradio Blocks UI in Colab
- show a text field and test-file output
- print the share URL
- optionally emit a parent-window READY message

This first task deliberately does **not** run yt-dlp. Its only purpose is to validate iframe, browser download, and message transport before the media pipeline is changed.
