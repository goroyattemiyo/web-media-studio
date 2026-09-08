# GitHub Actions YouTube Extraction Diagnostic

Last updated: 2026-09-08 JST

## Purpose

This workflow is a diagnostic only. It exists to compare the same WMS yt-dlp + FFmpeg + PO Token container flow on a GitHub-hosted runner against the current Cloud Run result.

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
5. enables the same `YOUTUBE_PO_TOKEN_MODE=bgutil-script-mweb` configuration used in the deployed Cloud Run worker
6. requests MP3 192 kbps output
7. uploads diagnostic logs and, on success, the generated MP3 as a short-lived GitHub Actions artifact

The artifact retention period is 3 days.

## How to run

From the repository:

1. open **Actions**
2. choose **YouTube Extraction Diagnostic**
3. choose **Run workflow**
4. enter the YouTube URL or video ID
5. set the rights confirmation to `YES` only when the media is yours or you have permission to download/convert it
6. run the workflow

Do not use private/unlisted URLs that you do not want visible in repository workflow metadata or logs.

## How to read the result

The artifact contains:

- `environment.log` — runner/container versions used for the test
- `extraction.log` — WMS worker CLI / yt-dlp result
- `result.txt` — `SUCCESS` or `FAILED` plus the process exit code
- `audio.mp3` — present only when extraction succeeds

Interpretation:

- GitHub Actions `SUCCESS` while Cloud Run stays `LIMITED`: execution environment / egress becomes the stronger differentiator.
- GitHub Actions `FAILED` with a similar YouTube restriction: the problem is broader than Cloud Run and may affect multiple cloud-hosted origins.
- A different failure should be diagnosed from `extraction.log` before changing architecture.

## Guardrails

- no YouTube account cookies
- no proxy rotation
- no DRM bypass
- no authentication bypass
- manual-only diagnostic; not callable from the public WMS UI
- do not treat a successful diagnostic as proof that GitHub Actions is an appropriate production conversion backend
