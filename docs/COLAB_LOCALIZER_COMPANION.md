# WMS Colab Localizer Companion

## Purpose

Provide a low-friction personal execution route when the Cloud Run YouTube Localize path is `LIMITED` by YouTube-side cloud restrictions.

The companion is not a public backend. Each user opens a Colab notebook and runs the conversion in that user's temporary Colab runtime.

## Public notebook URL

`https://colab.research.google.com/github/goroyattemiyo/web-media-studio/blob/main/colab/WMS_Colab_Localizer.ipynb`

The notebook is stored in the public GitHub repository, so it does not depend on a Google Drive file permission setting. Colab can load notebooks from GitHub. A user may need to sign in to Google to attach a Colab runtime and execute the cell.

## WMS flow

1. Enter or reuse a YouTube URL in the WMS Localize panel.
2. Press `URLをコピーしてColabを開く`.
3. WMS canonicalizes the URL, requests clipboard copy, and opens the public Colab notebook in a new tab.
4. Paste into `YOUTUBE_URL`.
5. Confirm `RIGHTS_CONFIRMED`.
6. Press the single cell's run button.
7. The notebook installs the pinned yt-dlp/EJS package, ensures Deno 2.9.6 and FFmpeg are available, extracts audio, and starts a browser download of the result.
8. The downloaded media can then be imported into WMS Local Library.

## Runtime configuration

- `yt-dlp[default]==2026.8.19`
- Deno `2.9.6`
- yt-dlp JavaScript runtime: `deno`
- output formats: MP3 / M4A / WAV
- MP3 bitrate: 128 / 192 / 256 / 320 kbps
- single-video only (`--no-playlist`)
- duration guard: 30 minutes
- no YouTube account cookies
- no proxy rotation
- no DRM/authentication bypass

## Product boundary

- Official IFrame remains the normal YouTube playback route.
- Cloud Run Localize remains `LIMITED` / experimental.
- Colab Localizer is a user-run companion, not an API service.
- WMS does not receive the generated file automatically; the browser downloads it and the user imports it into WMS.
- Only media the user owns or is permitted to save/convert should be processed.

## Validation status

Implementation is added on branch `feat/colab-localizer-companion`. CI/build and real Colab end-to-end execution must be confirmed before marking the flow as validated.
