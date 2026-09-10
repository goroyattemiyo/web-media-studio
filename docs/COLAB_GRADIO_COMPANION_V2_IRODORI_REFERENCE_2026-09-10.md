# WMS Colab Companion v2 — IrodoriTTS Reference

Date: 2026-09-10

## Confirmed precedent

`goroyattemiyo/irodori-tts-studio` already demonstrates the execution pattern WMS Companion v2 will reuse:

- Colab prepares the runtime.
- A separate Python application owns the Gradio UI.
- The app starts on `0.0.0.0:7860` with share mode.
- Colab exposes a temporary `gradio.live` URL.
- The user performs the workload from the Gradio UI.
- Queue concurrency is intentionally bounded.
- Styling can be kept separate from application logic.

Representative existing commands include launching the Irodori Video Converter and VoiceDesign apps with `--server-name 0.0.0.0 --server-port 7860 --share`.

## What WMS reuses

- notebook/app separation
- Gradio Blocks UI
- share-link startup flow
- single-job queue
- browser-facing output controls
- simple external CSS approach

## What WMS does not reuse

- Irodori model/runtime code
- GPU requirement
- Google Drive workflow
- unrestricted dependency upgrades

## WMS-specific extension

WMS adds a browser integration layer:

1. WMS stores the active temporary Companion URL for the session.
2. A Video Search/YouTube Download action prepares the Companion URL with URL-encoded source metadata.
3. Gradio reads that metadata from request query parameters and pre-fills the source.
4. WMS attempts iframe display when supported.
5. The identical prepared URL opens in a separate tab if iframe mode is unavailable.
6. Rights confirmation remains a manual per-job action inside the Companion.

This reference confirms the Colab + Gradio architecture but does not replace Gate 0 browser validation for iframe/file-download behavior.