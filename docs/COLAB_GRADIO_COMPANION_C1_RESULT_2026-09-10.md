# WMS Colab Companion v2 — C1 Real-device Result

Date: 2026-09-10 JST
Status: PASS on tested Android Chrome / WMS embedded Gradio path

## Confirmed

The C1 Companion runtime was tested with the same Colab + temporary `gradio.live` model proven by Gate 0.

Real-device PASS:

- Companion starts from Colab and exposes a temporary `gradio.live` URL
- Gradio UI works inside the WMS-origin iframe path
- explicit rights confirmation button works
- MP3 192 kbps localization works and produces a downloadable Gradio `File`
- M4A localization works
- WAV localization works
- generated file row is readable after the dark-theme CSS correction
- output selection tolerates yt-dlp/FFmpeg temporary/intermediate files and selects the newest completed file for the requested output format
- rights confirmation resets after a completed localization job

## Fixes found during real-device validation

1. STEP 2 originally used `subprocess.run(...)`, which made the share URL appear stalled in Colab. It was changed back to the Gate 0-proven notebook shell launch using `!python -u ... --share`.
2. Gradio 6.26 default light component surfaces conflicted with WMS light text. Explicit Gradio theme variables and file/input block styling were added.
3. Checkbox and Radio rights controls were unreliable to tap in the tested embedded mobile path. Rights confirmation was changed to an explicit Gradio Button backed by `gr.State`.
4. Output validation originally required exactly one candidate file. It now filters by the requested final extension and safely selects the newest completed matching file.

## Guardrails retained

- user-owned or otherwise authorized media only
- explicit rights confirmation for every job
- maximum duration 1800 seconds
- no playlist download
- one job at a time
- no Google Drive mount
- no account cookies
- no proxy controls
- no DRM/auth bypass
- no arbitrary yt-dlp flags or arbitrary filesystem paths

## Decision

C1 is proven sufficiently for merge. The launcher notebook default now points to `main` for post-merge production use.

Proceed to C2 on a separate integration branch:

- WMS Companion shell
- OFFLINE / CONNECTING / READY / EXPIRED states
- session-scoped temporary Companion URL
- iframe primary path
- reconnect/disconnect
- prepared separate-tab fallback
- keep the old one-cell Colab Localizer visible as fallback

Then C3 wires actual Video Search and loaded YouTube Download actions to the Companion with source/title/provider/format query parameters.

Direct Blob transfer into the WMS Local Library remains deferred.
