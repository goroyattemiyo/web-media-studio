# UX-3 YouTube Search plan — 2026-09-10

Status: implementation branch only. Do not claim production search works until the worker has a YouTube Data API key and Cloud Run is redeployed.

## Goal

Inside the existing YouTube tab, search YouTube by keyword and use each result as a WMS source without manually copying its URL.

Primary result actions:

- `▶ 今すぐ再生` -> existing official YouTube IFrame player
- `＋ 次に再生` -> existing WMS unified YouTube queue
- `↓ Download` -> existing WMS Colab download route, with the selected canonical URL copied first

## Architecture

`WMS YouTube Search UI -> WMS Cloud Run /youtube/search -> YouTube Data API v3`

The YouTube Data API key must remain on the worker. It must never be embedded in the GitHub Pages bundle.

## Search policy

- submit-only search; no search-as-you-type
- minimum query length 2
- maximum 8 results per request
- video results only
- no scraping / unofficial search endpoint
- friendly 503 when the worker key is not configured

## Credential requirement

Cloud Run needs `YOUTUBE_DATA_API_KEY` supplied from the GitHub Actions secret `YOUTUBE_DATA_API_KEY` when running `media-worker-cloudrun.yml`.

The code and CI can be completed without the secret. Production search cannot be marked PASS until that secret exists and the worker deploy has been verified.
