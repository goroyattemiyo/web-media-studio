# WMS Colab Companion v2 — Gradio Design

Date: 2026-09-10
Status: DESIGN ONLY / NOT IMPLEMENTED

## 1. Goal

Keep the proven Colab execution path for authorized media localization, but replace the raw notebook form as the normal interaction surface with a small Gradio companion UI that can be shown inside WMS when technically available.

Target experience:

WMS Video Search / loaded source
→ Download
→ WMS opens Companion panel
→ Companion receives the source URL
→ user confirms rights and format
→ Colab runs yt-dlp + Deno + FFmpeg
→ result is exposed as a browser-downloadable file
→ user can import the downloaded file into Local Library

The existing `colab/WMS_Colab_Localizer.ipynb` remains the canonical fallback throughout this phase.

## 2. Proven precedent: IrodoriTTS Studio

WMS is not inventing the Colab + Gradio execution model from zero.

The existing `goroyattemiyo/irodori-tts-studio` already uses the following production-shaped pattern successfully:

- Colab notebook prepares the runtime.
- The actual UI lives in a separate Python Gradio app.
- The app launches with `--server-name 0.0.0.0 --server-port 7860 --share`.
- Colab prints a temporary `gradio.live` URL.
- The user operates the workload through the Gradio GUI.
- The Gradio app uses a single-job queue.
- Custom CSS is kept outside the notebook where practical.

WMS Companion v2 should reuse this architecture pattern, not copy IrodoriTTS model-specific code.

Important difference:

IrodoriTTS:
Colab → Gradio share URL → user opens Gradio in another tab.

WMS Companion v2:
Colab → Gradio share URL → WMS can embed the Gradio page, with explicit separate-tab fallback.

The Irodori implementation is evidence for the Colab/Gradio runtime pattern. It is **not** evidence that `gradio.live` iframe embedding inside GitHub Pages/PWA works; that remains Gate 0.

Also, Irodori currently installs/updates Gradio rather than pinning a WMS-tested release. WMS must pin its own Gradio version only after Gate 0 proves the chosen release.

## 3. Product boundary

This is a user-started companion, not a permanent WMS server.

The Colab runtime may stop, the Gradio share URL is ephemeral, and managed Colab runtime policy/resource limits remain outside WMS control. WMS must never represent the companion as always online.

The UI must use explicit states:

- OFFLINE — no companion URL / runtime not started
- CONNECTING — companion page opened, waiting for usable response
- READY — companion is usable
- BUSY — a localization job is running
- EXPIRED — share endpoint/runtime is no longer usable
- FALLBACK — open the existing one-cell Colab Localizer

## 4. Policy / platform constraint

Google Colab managed runtimes prioritize interactive notebook compute. Current Colab FAQ states that, on free managed runtimes without a positive compute-unit balance, bypassing the notebook UI and primarily interacting through a web UI may be terminated without warning.

Therefore:

- Companion v2 is experimental and user-started.
- Do not depend on it for guaranteed availability.
- Keep the Colab notebook/session under explicit user control.
- Preserve the one-cell notebook fallback.
- Do not add keep-alive automation intended to evade Colab resource/session controls.
- Do not describe Colab as an always-on backend.
- If stable always-on operation is later required, evaluate a user-controlled local runtime, paid Colab compute with appropriate usage, or another supported compute environment separately.

## 5. Architecture

```text
WMS (GitHub Pages / PWA)
  |
  | Companion URL + source URL
  v
WMS Companion panel
  |
  | iframe OR explicit new-tab fallback
  v
Gradio share UI (temporary gradio.live URL)
  |
  v
Colab runtime
  |- Gradio
  |- yt-dlp[default]
  |- Deno
  |- FFmpeg
  `- dedicated temporary output root
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

## 6. Irodori-style repository split

Use the same separation that worked well in IrodoriTTS:

### Notebook

`colab/WMS_Colab_Companion_v2.ipynb`

Responsibilities:

1. install the pinned Gradio version
2. install/pin yt-dlp
3. ensure Deno
4. ensure FFmpeg
5. start the WMS Companion Python app
6. print the share URL clearly
7. keep the runtime cell visibly running

The notebook should not contain the full application logic.

### Gradio app

Proposed path:

`colab_companion/wms_colab_companion.py`

Responsibilities:

- build UI
- validate rights/source/format
- run bounded localization job
- expose status/progress
- return exactly one output file
- clean temporary job data safely

### Optional CSS

`colab_companion/wms_colab_companion.css`

Keep styling separate from media logic. The visual language should resemble WMS, but remain simple enough to survive Gradio upgrades.

## 7. Companion URL lifecycle

The Colab launcher prints a Gradio share URL after startup.

The user registers that URL in WMS for the active session.

Storage policy:

- default: `sessionStorage`
- optional future setting: remember on this device
- never commit or transmit the share URL to the WMS repository/backend
- clear the saved URL when the user chooses Disconnect

Treat the URL as temporary. WMS must make reconnect/replacement obvious.

## 8. Source handoff contract

### 8.1 Primary MVP: query-parameter handoff

Do **not** make the first implementation depend on custom cross-origin DOM access or postMessage.

WMS builds the iframe/new-tab URL from the configured companion URL and appends only non-secret media context, for example conceptually:

- source URL
- title
- provider
- optional preferred format

The Gradio app reads these values through `gr.Request.query_params` during page load and pre-fills the form.

Benefits:

- same mechanism works in iframe and separate-tab fallback
- no parent/child DOM access
- no brittle selector automation
- no custom browser extension/proxy
- a Download action from WMS Video Search can immediately open the Companion with the correct source already filled

Security boundary:

- never pass Google credentials, cookies, filesystem paths, API keys, arbitrary commands, or account tokens through query parameters
- rights confirmation is never pre-approved by WMS
- companion validates source again server-side before running

### 8.2 Optional later: postMessage

After Gate 0, postMessage may be added to support live source changes without reloading the iframe.

Possible messages:

- Companion → WMS: `WMS_COMPANION_READY`
- WMS → Companion: `WMS_LOAD_SOURCE`
- Companion → WMS: `WMS_JOB_STARTED`
- Companion → WMS: `WMS_JOB_FINISHED`
- Companion → WMS: `WMS_JOB_ERROR`

If implemented:

- WMS derives the expected companion origin from the configured URL
- WMS rejects messages from every other origin
- Companion accepts parent messages only from the WMS production origin
- messages contain media metadata only, never credentials or arbitrary commands

postMessage is an enhancement, not an MVP dependency.

## 9. Gradio UI

Keep it deliberately small:

- source URL textbox
- detected provider / validation note
- format: MP3 / M4A / WAV
- MP3 bitrate: 128 / 192 / 256 / 320
- mandatory rights-confirmation checkbox
- primary `Download` / `Localize` button
- progress/status area
- resulting downloadable file
- reset button

No account cookies, proxy controls, DRM controls, arbitrary yt-dlp flags, shell input, free-form command input, or custom filesystem paths.

The app should disable Gradio analytics.

Concurrency: 1 job at a time for the first version, matching the proven Irodori pattern.

## 10. Runtime preparation

Move expensive setup to companion startup rather than every job.

Startup:

1. install pinned Gradio version selected by Gate 0
2. install/pin `yt-dlp[default]`
3. ensure pinned Deno runtime
4. ensure FFmpeg
5. create a dedicated temporary output root
6. launch Gradio with share mode

Per job:

1. validate rights confirmation
2. validate supported source URL/input
3. create unique job directory
4. run one yt-dlp job
5. max duration 1800 seconds
6. no playlist download
7. extract audio to selected format
8. return exactly one output file
9. clean previous/abandoned job outputs where safe

Do not add a GPU requirement; this workflow should use a normal CPU runtime unless future evidence requires otherwise.

## 11. Download/file handling

The current notebook uses `google.colab.files.download()`.

Companion v2 should instead return the generated file through a Gradio `File` result so the download control exists inside the Companion UI.

Restrict served files to the dedicated WMS output directory only.

Do not expose:

- `/content` generally
- Google Drive mounts
- notebook files
- credentials
- arbitrary filesystem paths

The first implementation stops at browser download.

Automatic cross-origin Blob transfer directly into WMS Local Library is deferred until CORS, memory use, browser/PWA behavior, and temporary-share exposure are validated.

## 12. WMS UI

The existing Download path remains visible.

When Companion is configured:

- Download from Video Search/source card opens the Companion section
- WMS supplies the selected source through the query-parameter handoff
- if the iframe path is usable, render the Gradio page inside WMS
- if embedding is unavailable, open the same prepared Companion URL in a new tab
- if OFFLINE/EXPIRED, show `Colab Companionを起動` and `従来のColabを開く`
- never silently start a localization job
- rights confirmation remains inside Companion for every job

Suggested WMS card:

```text
COLAB COMPANION
● READY / ○ OFFLINE

[ Companion URL ................................ ] [Connect]

[ embedded Gradio area OR open-in-new-tab state ]

[Reconnect] [Disconnect] [従来のColabを開く]
```

Do not embed the full Colab notebook itself.

## 13. Embed strategy and Gate 0

Gradio supports public share links and iframe-based inline/hosted app presentation patterns. Colab also supports Gradio share-link workflows, as already demonstrated by IrodoriTTS Studio.

However, a temporary `gradio.live` share URL embedded inside the WMS GitHub Pages/PWA origin must be verified before WMS treats embedded mode as supported.

Gate 0 real-browser PoC must confirm:

- selected pinned Gradio release launches in Colab
- share URL is produced reliably
- `gradio.live` page renders inside a WMS iframe
- no frame blocker prevents use
- text input/button interactions work on desktop Chrome
- interactions work on Android Chrome/PWA
- Gradio File download from inside the iframe works
- query parameters can pre-fill the source reliably
- iframe refresh/source replacement is acceptable
- if authentication is considered, third-party-cookie behavior is tested first

If iframe embedding fails, retain the same Companion design but open the prepared Gradio URL in a separate tab/window. Do not proxy or bypass frame restrictions.

## 14. Authentication / abuse boundary

A Gradio share link is publicly reachable by anyone who knows the URL.

For MVP:

- keep the app single-job and narrowly scoped
- expose no secrets or arbitrary commands
- expire naturally with the Colab/share session
- do not implement brittle cookie-dependent authentication before Gate 0

Gate 0 should test whether Gradio built-in auth remains usable in the target embedded Android/desktop environments. If third-party cookies make embedded auth unreliable, do not force it into the MVP.

A later capability-token design may be evaluated if practical, but it must not create the appearance of strong authentication unless it actually protects the job endpoints.

## 15. Security and rights

- mandatory rights confirmation per job
- no cookies/proxy rotation/DRM/auth bypass
- no arbitrary yt-dlp flags
- no shell field
- no arbitrary output path
- no Google Drive mount for this workflow
- no server-side filesystem path shown to user
- sanitize errors
- single-job queue
- no automatic background job launch from WMS

## 16. Compatibility / non-regression

Must preserve:

- current WMS Local playback
- current YouTube official IFrame playback
- current Video Search
- current provider-neutral Play Queue
- existing one-cell Colab notebook
- existing manual Download → Colab route

Companion failure must never break normal Player/Library/Video Search operation.

## 17. Delivery phases

### C0 — Irodori-derived technical Gate 0

- [x] architecture defined
- [x] proven Irodori Colab + Gradio launch pattern identified
- [ ] select and pin a Gradio version for the PoC
- [ ] create minimal WMS Gate 0 Gradio app using Irodori-style app/notebook split
- [ ] verify share URL creation in Colab
- [ ] verify query-parameter prefill
- [ ] verify `gradio.live` iframe inside production WMS origin
- [ ] verify desktop + Android File download
- [ ] decide whether embedded auth is viable

### C1 — Colab Companion backend/UI

- [ ] new WMS Companion Python app
- [ ] new Companion notebook launcher
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
- [ ] separate-tab fallback
- [ ] legacy one-cell Colab fallback

### C3 — WMS source handoff

- [ ] Download from Video Search opens Companion
- [ ] Download from loaded YouTube opens Companion
- [ ] query-parameter source handoff
- [ ] optional postMessage only after Gate 0 evidence

### C4 — real-device validation

- [ ] desktop Chrome
- [ ] Android Chrome/PWA
- [ ] MP3 192 download
- [ ] M4A/WAV smoke test
- [ ] expired Colab/share-session recovery
- [ ] no regression to playback / queue

### C5 — optional later improvements

- [ ] direct result import into WMS only after CORS/security/memory validation
- [ ] live postMessage handoff without iframe reload
- [ ] user-controlled local Companion/runtime
- [ ] stable hosted Companion only if provider/platform policy and extraction reliability justify it

## 18. Exit criteria

Companion v2 may be called implemented only when:

1. a user can start it from the notebook without editing Python,
2. a temporary Gradio URL is clearly surfaced,
3. WMS can use that URL in embedded mode or an explicit separate-tab fallback,
4. a WMS-selected source arrives pre-filled without ambiguity,
5. rights confirmation is required every time,
6. MP3 download succeeds on a real device,
7. expired runtime/share-link recovery is clear,
8. the existing one-cell Colab route still works.

Do not claim permanent background availability or guaranteed Colab uptime.
