# WMS Colab Companion v2 — Gradio Design

Date: 2026-09-10
Status: DESIGN ONLY / NOT IMPLEMENTED

## 1. Goal

Keep the proven Colab execution path for authorized media localization, but replace the raw notebook form as the normal interaction surface with a small Gradio companion UI that can be shown inside WMS when technically available.

Target experience:

WMS Video Search / YouTube source
→ Download
→ WMS opens Companion panel
→ Companion receives the source URL
→ user confirms rights and format
→ Colab runs yt-dlp + Deno + FFmpeg
→ result is exposed as a browser-downloadable file
→ user can import the downloaded file into Local Library

The existing `colab/WMS_Colab_Localizer.ipynb` remains the canonical fallback throughout this phase.

## 2. Product boundary

This is a user-started companion, not a permanent WMS server.

The Colab runtime may stop, the Gradio share URL is ephemeral, and managed Colab runtime policy/resource limits remain outside WMS control. WMS must never represent the companion as always online.

The UI must use explicit states:

- OFFLINE — no companion URL / runtime not started
- CONNECTING — iframe opened, waiting for handshake
- READY — companion handshake received
- BUSY — a localization job is running
- EXPIRED — iframe/share endpoint is no longer reachable or handshake times out
- FALLBACK — open the existing one-cell Colab Localizer

## 3. Policy / platform constraint

Google Colab managed runtimes are intended for interactive notebook compute. Current Colab FAQ states that, on free managed runtimes without a positive compute-unit balance, bypassing the notebook UI and primarily interacting through a web UI may be terminated without warning.

Therefore:

- Companion v2 is experimental and user-started.
- Do not depend on it for guaranteed availability.
- Keep the Colab notebook tab/running session visible to the user.
- Preserve the one-cell notebook fallback.
- Do not add keep-alive automation intended to evade Colab resource/session controls.
- If stable always-on operation is later required, evaluate a user-controlled local runtime or paid/guaranteed compute separately.

## 4. Architecture

```text
WMS (GitHub Pages)
  |
  | source URL / requested format
  v
Colab Companion panel
  |
  | iframe (cross-origin)
  v
Gradio share UI (ephemeral gradio.live URL)
  |
  v
Colab runtime
  |- yt-dlp[default]
  |- Deno
  |- FFmpeg
  `- temporary job output
       |
       v
     Gradio File result
       |
       v
 browser download
       |
       v
 WMS Local Library import
```

The WMS parent must not attempt direct DOM access inside the cross-origin Gradio iframe.

## 5. Integration contract

### 5.1 Companion URL

The Colab launcher prints a Gradio share URL after startup. The user pastes that URL into WMS once for the active session.

Storage policy:

- default: `sessionStorage`
- optional future setting: remember on this device
- never commit or transmit the share URL to the WMS repository/backend
- clear the saved URL when the user chooses Disconnect

### 5.2 WMS ↔ iframe messaging

Use `window.postMessage`, not cross-origin DOM access.

Minimum messages:

- Companion → WMS: `WMS_COMPANION_READY`
- WMS → Companion: `WMS_LOAD_SOURCE` with URL/title/provider
- Companion → WMS: `WMS_JOB_STARTED`
- Companion → WMS: `WMS_JOB_FINISHED` with display metadata only
- Companion → WMS: `WMS_JOB_ERROR` with sanitized error text

Security rules:

- WMS derives the expected origin from the configured companion URL and rejects messages from any other origin.
- Companion only accepts messages from the configured WMS origin (`https://goroyattemiyo.github.io`).
- No tokens, Google credentials, cookies, local filesystem paths, or arbitrary commands are accepted over the message channel.

### 5.3 First implementation fallback

If the postMessage handoff cannot be made reliable with the current Gradio version, MVP falls back to:

1. WMS copies the source URL.
2. Companion iframe opens.
3. User pastes the URL into Gradio.

Do not delay a usable MVP solely for automatic form population.

## 6. Gradio UI

Keep it deliberately small:

- source URL textbox
- format: MP3 / M4A / WAV
- MP3 bitrate: 128 / 192 / 256 / 320
- mandatory rights-confirmation checkbox
- primary `Download` / `Localize` button
- progress/status area
- resulting downloadable file
- reset button

No account cookies, proxy controls, DRM controls, arbitrary yt-dlp flags, shell input, or free-form command input.

The app should disable Gradio analytics.

## 7. Runtime preparation

Move expensive setup to companion startup rather than every job:

Startup:

1. install/pin `yt-dlp[default]`
2. ensure pinned Deno runtime
3. ensure FFmpeg
4. create a dedicated temporary output root
5. launch Gradio

Per job:

1. validate rights confirmation
2. validate supported source URL/input
3. create unique job directory
4. run one `yt-dlp` job
5. max duration 1800 seconds
6. no playlist download
7. extract audio to selected format
8. return exactly one output file
9. clean previous/abandoned job outputs on reset/new job where safe

Concurrency: 1 job at a time for the first version.

## 8. Download/file handling

The current notebook uses `google.colab.files.download()`. Companion v2 should instead return the generated file through a Gradio `File` result so the download control exists inside the companion UI.

Restrict Gradio-served files to the dedicated WMS output directory only. Do not expose `/content`, Drive mounts, credentials, notebook files, or arbitrary paths.

Initial integration stops at browser download. Automatic cross-origin transfer of the generated Blob directly into WMS Local Library is explicitly deferred until CORS, memory use, and exposure of temporary share URLs are validated.

## 9. WMS UI

The existing Download path remains visible.

When Companion is configured:

- Download from a search/source card opens the Companion section.
- If READY, send the source to Companion.
- If OFFLINE/EXPIRED, show `Colab Companionを起動` and `従来のColabを開く`.
- Never silently launch a download job; rights confirmation remains inside Companion for every job.

Suggested WMS card:

```text
COLAB COMPANION
● READY / ○ OFFLINE

[ Companion URL ................................ ] [Connect]

[ embedded Gradio area ]

[Reconnect] [Disconnect] [従来のColabを開く]
```

Do not embed the full Colab notebook itself.

## 10. Embed strategy and Gate 0

Gradio officially supports iframe embedding for hosted apps, and Colab automatically creates Gradio share links. However, a temporary `gradio.live` share URL inside GitHub Pages must be verified in the real WMS origin before treating iframe embedding as guaranteed.

Gate 0 real-browser PoC must confirm:

- `gradio.live` page renders inside WMS iframe
- no `frame-ancestors` / X-Frame-Options blocker
- controls work on desktop Chrome
- controls work on Android Chrome/PWA
- file download initiated inside iframe works
- third-party-cookie settings do not break the chosen auth/session approach
- iframe can send/receive the planned `postMessage` handshake

If iframe embedding fails, retain the same companion design but open the Gradio UI in a new tab/window; do not proxy or bypass frame restrictions.

## 11. Share URL lifecycle

Treat the Gradio share URL as ephemeral even if its advertised maximum lifetime is longer than a typical Colab session.

WMS health behavior:

- READY requires an explicit companion handshake, not only iframe `load`.
- handshake timeout → EXPIRED/UNREACHABLE state.
- user can replace the URL after restarting Colab.
- no automatic URL discovery from Colab is assumed.

## 12. Security

- Gradio share links are publicly reachable if someone knows the URL; do not expose secrets through the UI or output.
- Do not mount Google Drive for this workflow.
- Do not accept arbitrary output paths.
- Do not display server-side filesystem paths to the user.
- Sanitize errors before posting them back to WMS.
- Use a single-job queue for MVP.
- Rights confirmation is mandatory per job.
- No cookies/proxy rotation/DRM/auth bypass.

Authentication for the share UI is a separate Gate 0 decision because cookie-based auth inside a third-party iframe can be affected by browser cookie policy. Do not ship a brittle auth layer before iframe behavior is tested.

## 13. Compatibility / non-regression

Must preserve:

- current WMS Local playback
- current YouTube official IFrame playback
- current Video Search
- current Play Queue
- existing one-cell Colab notebook
- existing manual Download → Colab route

Companion failure must never break normal Player/Library/YouTube operation.

## 14. Delivery phases

### C0 — design and technical gates

- [x] architecture defined
- [ ] pin Gradio version for implementation
- [ ] build minimal Colab Gradio hello-world
- [ ] verify `gradio.live` iframe inside production WMS origin
- [ ] verify Android/desktop download from iframe
- [ ] decide handshake/auth approach from real-browser evidence

### C1 — Colab Companion backend/UI

- [ ] new Gradio companion launcher/notebook
- [ ] setup dependencies once per runtime
- [ ] rights/format/bitrate UI
- [ ] single-job localization
- [ ] Gradio File output
- [ ] bounded output directory / cleanup

### C2 — WMS Companion shell

- [ ] session URL input
- [ ] OFFLINE / CONNECTING / READY / EXPIRED UI
- [ ] iframe container
- [ ] connect/reconnect/disconnect
- [ ] legacy Colab fallback

### C3 — WMS source handoff

- [ ] Download from Video Search opens Companion
- [ ] Download from loaded YouTube opens Companion
- [ ] postMessage source handoff if Gate 0 passes
- [ ] visible fallback to copy/paste when handoff is unavailable

### C4 — real-device validation

- [ ] desktop Chrome
- [ ] Android Chrome/PWA
- [ ] MP3 192 download
- [ ] M4A/WAV smoke test
- [ ] expired Colab session recovery
- [ ] no regression to playback / queue

### C5 — optional later improvements

- [ ] direct result import into WMS only after CORS/security/memory validation
- [ ] user-controlled local companion/runtime
- [ ] stable hosted companion only if provider/platform policy and extraction reliability justify it

## 15. Exit criteria

Companion v2 may be called implemented only when:

1. a user can start the companion from the notebook without editing Python,
2. WMS can connect to the issued companion URL,
3. the companion is usable either embedded or through an explicit non-embedded fallback,
4. source URL reaches the companion without ambiguity,
5. rights confirmation is required,
6. MP3 download succeeds on a real device,
7. expired runtime recovery is clear,
8. the existing one-cell Colab route still works.

Do not claim permanent background availability or guaranteed Colab uptime.
