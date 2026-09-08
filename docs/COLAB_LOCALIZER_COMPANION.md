# WMS Colab Localizer Companion

## Purpose

Provide the practical user-run Download route for authorized YouTube media without relying on the Cloud Run extraction path that remained restricted in production.

The companion is not a public backend. Each user opens a Colab notebook and runs the conversion in that user's temporary Colab runtime.

## Public notebook URL

`https://colab.research.google.com/github/goroyattemiyo/web-media-studio/blob/main/colab/WMS_Colab_Localizer.ipynb`

The notebook is stored in the public GitHub repository, so it does not depend on a Google Drive file permission setting. A user may need to sign in to Google to attach a Colab runtime and execute the cell.

## WMS flow

1. Enter a YouTube URL in the unified `YOUTUBE MEDIA` panel.
2. Press `Download`.
3. WMS canonicalizes/copies the URL and opens the public Colab notebook in a new tab.
4. Paste into `YOUTUBE_URL`.
5. Confirm `RIGHTS_CONFIRMED`.
6. Press the single cell's run button.
7. The notebook installs the pinned yt-dlp/EJS package, ensures Deno 2.9.6 and FFmpeg are available, extracts audio, and starts a browser download of the result.
8. Back in WMS, press `Import downloaded audio` and choose the generated file.
9. WMS saves the file to Local Library and refreshes the Player/Library view.

The former separate Cloud Run Localize panel, Google Sign-In card, format/bitrate controls, `Localize & Save`, and `LIMITED` user-facing state are retired. Cloud Run remains only as an experimental backend/diagnostic target.

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
- Colab Download is a user-run companion, not an API service.
- Cloud Run extraction is not shown as a normal user feature.
- Generated files are downloaded by the browser and explicitly re-imported by the user.
- Only media the user owns or is permitted to save/convert should be processed.

## Validation status

- Colab standard yt-dlp + Deno + EJS format discovery: PASS
- one-cell Colab MP3 browser download: PASS on 2026-09-08
- unified WMS Play / Download / Import UI: implementation pending branch CI / real-device validation
- mixed named playlists (local saved media references + YouTube URLs): implementation pending branch CI / real-device validation
