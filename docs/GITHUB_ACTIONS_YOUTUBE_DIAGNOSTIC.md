# GitHub Actions YouTube Extraction Diagnostic

Last updated: 2026-09-08 JST

## Purpose

This workflow is a diagnostic only. It compares the WMS worker container on a GitHub-hosted runner with Cloud Run and other execution environments.

The production Cloud Run Localize path remains `LIMITED` / experimental. This workflow is not connected to the WMS browser UI and is not a public download service.

## Workflow

File:

`.github/workflows/youtube-extraction-diagnostic.yml`

Manual workflow name:

`YouTube Extraction Diagnostic`

The workflow:

1. requires a YouTube URL or 11-character video ID
2. requires explicit confirmation that the media is owned by the tester or may be downloaded/converted
3. builds `services/media-worker/Dockerfile`, the same worker image definition used for Cloud Run
4. runs the same `wms_media_worker.cli` extraction code
5. defaults to the standard yt-dlp path with Deno + EJS and no forced YouTube player client
6. optionally allows the older `po-token-mweb` experiment for comparison
7. requests MP3 192 kbps output
8. uploads diagnostic logs and, on success, the generated MP3 as a short-lived GitHub Actions artifact

The artifact retention period is 3 days.

## Extraction modes

### `standard-deno-ejs` — default

- `YOUTUBE_PO_TOKEN_MODE=off`
- Deno is present in the worker image
- yt-dlp's `default` dependency group provides the matching EJS package
- no `player_client=mweb` override is injected
- normal yt-dlp client selection remains in effect

This is the production candidate path after the Colab diagnostic showed standard yt-dlp could enumerate playable audio formats while the forced WMS `mweb` path failed.

### `po-token-mweb` — optional comparison only

- `YOUTUBE_PO_TOKEN_MODE=bgutil-script-mweb`
- uses the existing bgutil provider + Node + `mweb` configuration
- retained only so the previous experiment can still be reproduced explicitly

This mode is not the normal production default.

## How to run

From the repository:

1. open **Actions**
2. choose **YouTube Extraction Diagnostic**
3. choose **Run workflow**
4. enter the YouTube URL or video ID
5. set the rights confirmation to `YES` only when the media is yours or you have permission to download/convert it
6. leave `extraction_mode` at `standard-deno-ejs` for the normal diagnostic
7. run the workflow

Do not use private/unlisted URLs that you do not want visible in repository workflow metadata or logs.

## Recorded GitHub-hosted-runner result

Run `34200169939` executed the pre-Deno/EJS diagnostic configuration on a GitHub-hosted Ubuntu runner in Azure `westus`.

Container build and environment checks passed, but the extraction step failed with YouTube's explicit bot-confirmation response:

`Sign in to confirm you're not a bot.`

The workflow still uploaded the diagnostic artifact successfully. This shows that the tested GitHub-hosted runner was rejected differently from the fresh Colab standard-yt-dlp probe.

## Colab comparison

See `docs/COLAB_YOUTUBE_DENO_EJS_RESULT_2026-09-08.md`.

The fresh Colab probe with Deno `2.9.6` + EJS could enumerate multiple audio formats using standard yt-dlp. The forced WMS `mweb` path failed separately because usable `mweb` media formats required a GVS PO Token.

This is why the diagnostic now defaults to `standard-deno-ejs` and keeps the PO Token/mweb path as an optional comparison only.

## How to read the result

The artifact contains:

- `environment.log` — runner/container versions and selected extraction mode
- `extraction.log` — WMS worker CLI / yt-dlp result
- `result.txt` — `SUCCESS` or `FAILED`, process exit code and extraction mode
- generated audio — present only when extraction succeeds

Interpretation:

- `standard-deno-ejs` succeeds: the revised worker runtime path is technically viable in that environment.
- `standard-deno-ejs` fails with bot confirmation: the execution environment / egress remains a restriction even with the current JS runtime requirements satisfied.
- `standard-deno-ejs` succeeds while `po-token-mweb` fails: do not force `mweb` as the normal route.
- a different failure should be diagnosed from `extraction.log` before changing architecture.

## Guardrails

- no YouTube account cookies
- no proxy rotation
- no DRM bypass
- no authentication bypass
- manual-only diagnostic; not callable from the public WMS UI
- do not treat a successful diagnostic as proof that GitHub Actions is an appropriate production conversion backend
