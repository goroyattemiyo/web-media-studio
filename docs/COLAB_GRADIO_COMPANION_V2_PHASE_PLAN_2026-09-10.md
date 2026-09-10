# WMS Colab Companion v2 — Phase Plan

Date: 2026-09-10
Status: DESIGN ONLY

## Decision

Do not replace the proven one-cell Colab Localizer yet.

Build Companion v2 beside it, using the already-proven IrodoriTTS architecture pattern:

- notebook prepares runtime
- Python file owns the Gradio UI/business logic
- Gradio starts on `0.0.0.0:7860`
- share mode exposes a temporary `gradio.live` URL
- single-job queue
- UI logic separated from notebook setup

WMS adds one new layer beyond IrodoriTTS: embed the Gradio page when the browser allows it, with a prepared separate-tab fallback when it does not.

## Phase order

1. **C0 Gate 0 PoC** — minimal Irodori-style Gradio app + launcher notebook; query-parameter prefill; share URL; WMS iframe; Android/desktop download validation.
2. **C1 Companion UI/runtime** — rights/format/bitrate, one-job queue, yt-dlp + Deno + FFmpeg, Gradio File output.
3. **C2 WMS Companion shell** — URL connect, OFFLINE/READY/EXPIRED, iframe, reconnect/disconnect, separate-tab and old-Colab fallback.
4. **C3 Source handoff** — Video Search and loaded YouTube Download actions open Companion with source in query parameters; postMessage only as optional later enhancement.
5. **C4 End-to-end validation** — real MP3 download, M4A/WAV smoke tests, session-expiry recovery, playback/queue regression.
6. **C5 Optional** — direct result import and live postMessage only after CORS/security/memory/browser evidence.

## Branch plan

- design: `plan/colab-gradio-companion-v2-clean`
- Gate 0 implementation: `feat/colab-gradio-companion-gate0`
- Companion runtime/UI: `feat/colab-gradio-companion-v2`
- WMS integration: `feat/colab-companion-shell`
- source handoff: `feat/colab-companion-source-handoff`

Keep these separate so a failed iframe experiment cannot destabilize the existing Download route.

## C0 exact scope

Gate 0 deliberately does **not** run yt-dlp.

Create:

- `colab_companion/wms_colab_companion_gate0.py`
- `colab/WMS_Colab_Companion_Gate0.ipynb`

The app only needs:

- source textbox
- one visible query-parameter prefill value
- a test button
- a generated small text file as `gr.File` output
- WMS-like minimal CSS
- analytics disabled
- queue concurrency 1

The notebook only needs:

- install the selected pinned Gradio release
- obtain the repository/app
- launch on `0.0.0.0:7860` with share mode
- clearly print the `gradio.live` URL

## Gate 0 validation matrix

Desktop Chrome:

- share URL opens directly
- query-param source prefill PASS/FAIL
- iframe render PASS/FAIL
- input/button use PASS/FAIL
- test-file download PASS/FAIL

Android Chrome:

- same five checks

Installed WMS PWA:

- iframe render PASS/FAIL
- input/button use PASS/FAIL
- test-file download PASS/FAIL

Authentication experiment:

- only test built-in Gradio auth after the unauthenticated embed path works
- if third-party-cookie restrictions break embedded auth, record it as unsupported for MVP

## Source handoff decision

Primary MVP:

`WMS Download action → prepared Companion URL with URL-encoded source metadata → Gradio reads gr.Request.query_params → form is prefilled`

Why this is preferred first:

- same path works in iframe and new tab
- no cross-origin DOM access
- no DOM-selector automation inside Gradio
- no postMessage bridge required to make MVP useful

Rights confirmation is never passed as true by WMS.

Optional after C4:

`postMessage` for changing the source without reloading the Companion.

## Merge gates

No production Companion UI merge until Gate 0 proves one of these two supported modes:

- **Embedded mode:** temporary Gradio page renders and works inside WMS on desktop + Android/PWA.
- **Fallback mode:** WMS opens a source-prepared Companion URL in a separate browser tab and file download works reliably.

Do not work around frame restrictions with a proxy.

## Gradio version rule

IrodoriTTS proves the architecture, but its current `pip install -U gradio` behavior is not sufficient for WMS reproducibility.

For WMS:

1. test one current stable Gradio release in Gate 0
2. record the exact working version
3. pin that exact version in the Companion notebook
4. upgrade only in a dedicated validation PR

## MVP non-goals

- always-on Colab server
- automatic keep-alive / session bypass
- Google Drive mount
- direct WMS access to Colab filesystem
- automatic download without per-job rights confirmation
- cookie/proxy/DRM/auth bypass
- arbitrary yt-dlp flags
- multi-user service
- direct Blob injection from Colab into WMS
- mandatory postMessage integration

## First implementation task after design merge

Create the C0 branch and implement the tiny Gradio Gate 0 app/notebook only.

Do not touch the existing Localizer media pipeline until the real WMS origin has proven either embedded mode or the prepared separate-tab fallback.
