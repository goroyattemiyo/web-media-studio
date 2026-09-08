# WMS Colab Localizer Companion

## Purpose

Provide the practical user-run Download route for authorized YouTube media without relying on the Cloud Run extraction path that remained restricted in production.

The companion is not a public backend. Each user opens a Colab notebook and runs the conversion in that user's temporary Colab runtime.

## Public notebook URL

`https://colab.research.google.com/github/goroyattemiyo/web-media-studio/blob/main/colab/WMS_Colab_Localizer.ipynb`

The notebook is stored in the public GitHub repository, so it does not depend on a Google Drive file permission setting. A user may need to sign in to Google to attach a Colab runtime and execute the cell.

## WMS flow

1. Enter a YouTube URL in the unified `YOUTUBE MEDIA` panel.
2. Press `Download`. WMS canonicalizes and copies the URL.
3. On the first Download only, WMS shows a short guide: sign in to Google if Colab asks, paste `YOUTUBE_URL`, confirm rights, then press the run button.
4. The guide has `次回からこの案内を表示しない`. When kept checked and the user opens Colab, later Download clicks go directly to the public notebook.
5. Paste into `YOUTUBE_URL`.
6. Confirm `RIGHTS_CONFIRMED`.
7. Press the single cell's run button.
8. The notebook installs the pinned yt-dlp/EJS package, ensures Deno 2.9.6 and FFmpeg are available, extracts audio, and starts a browser download of the result.
9. Back in WMS, press `Import downloaded audio` and choose the generated file.
10. WMS saves the file to Local Library and refreshes the Player/Library view.

The first-run guide does not attempt to automate Google authentication. Google credentials remain entirely on Google's side; WMS does not request or store Google passwords.

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
- WMS may explain the first Google/Colab step, but cannot bypass or automate Google account authentication.
- Cloud Run extraction is not shown as a normal user feature.
- Generated files are downloaded by the browser and explicitly re-imported by the user.
- Only media the user owns or is permitted to save/convert should be processed.

## Validation status

- Colab standard yt-dlp + Deno + EJS format discovery: PASS
- one-cell Colab MP3 browser download: PASS on 2026-09-08
- unified WMS Play / Download / Import UI: merged and deployed
- mixed named playlists (local saved media references + YouTube URLs): merged and deployed
- first-run Colab guide: pending branch CI and browser validation
