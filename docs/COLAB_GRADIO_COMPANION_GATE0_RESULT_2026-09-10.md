# WMS Colab Companion — Gate 0 Result

Date: 2026-09-10 JST
Status: Android Chrome embedded-mode PASS

## Result

Gate 0 was validated on a real Android Chrome device using the production WMS-origin experiment page and a temporary `gradio.live` session.

Confirmed PASS:

- temporary Gradio share URL opened directly in Android Chrome
- Gate 0 Gradio UI rendered and accepted input
- Gradio `File` test output was generated and downloaded directly
- `gradio.live` rendered inside the WMS GitHub Pages iframe
- WMS query parameters prefilled the embedded Companion correctly:
  - `wms_source` -> `https://example.com/wms-gate0-video`
  - `wms_title` -> `WMS Gate 0 Test`
  - `wms_provider` -> `other`
- controls inside the iframe were usable
- the iframe-generated Gradio `File` output was downloadable on Android Chrome

## Transient session observation

During validation, one iframe action displayed a Gradio error and a later screen showed `No interface is running right now` after the temporary Gradio session had stopped. After restarting the Colab/Gradio session, the same iframe path successfully generated and downloaded the Gate 0 file.

Interpretation:

- this was treated as temporary Companion-session lifetime behavior, not an iframe incompatibility
- WMS must still represent the Companion as session-scoped and expirable
- reconnect and separate-tab fallback remain required product behavior

## Decision

Android Chrome proves the embedded path is technically viable for the next implementation phase.

Proceed with C1:

- real authorized media localization in the Gradio Companion
- MP3 / M4A / WAV
- MP3 bitrate selection
- per-job rights confirmation
- yt-dlp + Deno + FFmpeg setup once per Colab runtime
- one job at a time
- maximum duration 1800 seconds
- no playlist download
- bounded output directory
- Gradio `File` result

For later WMS integration, use iframe as the primary candidate and retain the same prepared URL as a separate-tab fallback.

## Still pending

Gate 0 evidence in this record is Android Chrome specific.

Still validate during C2/C4:

- installed WMS PWA
- desktop Chrome
- expired-session reconnect UX
- separate-tab prepared-URL fallback end-to-end

Do not describe Colab or the temporary Gradio share URL as always online.
