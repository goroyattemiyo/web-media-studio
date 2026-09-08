# Colab YouTube Deno/EJS Diagnostic Result

Date: 2026-09-08 JST

## Purpose

Compare the current WMS Cloud Run / GitHub-hosted-runner failures with a fresh Google Colab VM using the same yt-dlp release and then isolate the effect of the WMS `mweb` + PO Token configuration.

This is a diagnostic record only. It does not change WMS product guardrails and does not authorize downloading media without ownership or permission.

## Test target

Video ID: `kmsmtF9wMjc`

The metadata probe reported the title `Lee Ritenour - Night Rhythms` and duration `398` seconds.

## Test A — standard yt-dlp on Colab

Environment after installing the current JavaScript requirements:

- yt-dlp `2026.08.19`
- Python `3.13.15`
- Deno `2.9.6`
- `yt_dlp_ejs` `0.8.0`
- FFmpeg `4.4.2`

Result: **PASS for metadata / format discovery**.

The extractor successfully loaded the YouTube webpage, player API JSON and m3u8 information. `--list-formats` exposed multiple playable audio-only formats, including `m4a` and `webm` audio entries (`139`, `140`, `249`, `250`, `251`) plus HLS audio entries.

Important scope: this step demonstrated that the Colab environment could reach the player data and resolve available audio formats. It was not used as evidence of a completed MP3 download.

## Test B — WMS PO Token / mweb path on Colab

The WMS source was checked out at:

`10909436befc9bd5bc11ae0cd285a9817e66c5e2`

The bgutil provider source was checked out at:

`7511309af023b09788dc8f2efc96cc3671291e6c`

Provider build: **PASS**.

The WMS CLI with `YOUTUBE_PO_TOKEN_MODE=bgutil-script-mweb` failed before producing audio. The relevant diagnostics were:

- signature / n-challenge solving warnings
- `mweb` HTTPS formats requiring a GVS PO Token
- only image formats remaining
- `Requested format is not available`

Result: **FAIL**.

## Interpretation

This result changes the earlier working hypothesis.

1. The same day, a GitHub-hosted Azure runner was rejected with `Sign in to confirm you're not a bot`.
2. A fresh Colab VM did not hit that bot-confirmation failure during the standard yt-dlp probe and could enumerate multiple audio formats.
3. Forcing the WMS `mweb` path created a separate failure in Colab because the required GVS PO Token was not supplied to the usable media requests.
4. Therefore the problem is not explained only by Cloud Run egress. WMS also needs to follow yt-dlp's current JavaScript-runtime/EJS requirements and should not force `mweb` as the normal path.

## Implementation decision

Primary worker path:

- install `yt-dlp[default]` so the matching EJS package is present
- include a supported Deno runtime in the worker image
- leave yt-dlp's standard client selection intact
- default `YOUTUBE_PO_TOKEN_MODE` to `off`

Optional diagnostic fallback:

- retain the existing bgutil + Node + `mweb` mode only behind the explicit `bgutil-script-mweb` flag

## Guardrails

- no YouTube account cookies
- no proxy rotation
- no DRM bypass
- no authentication bypass
- Cloud Run Localize remains `LIMITED` until the revised production worker is deployed and retested
