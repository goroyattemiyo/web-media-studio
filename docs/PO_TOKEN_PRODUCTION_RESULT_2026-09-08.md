# PO Token production validation result — 2026-09-08 JST

## Deployment

PR #29 PO Token configuration was deployed to Cloud Run by workflow run #6 from `main` commit `658636f3d7fc25d685329dcdc795a383c3bd73f6`.

The deployment completed successfully and included:

- `YOUTUBE_PO_TOKEN_MODE=bgutil-script-mweb`
- `bgutil-ytdlp-pot-provider==1.3.2`
- Node runtime/provider script configuration introduced by PR #29

## Production retest result

After that deployment:

- previously blocked video: FAIL
- separate copyright-free video: FAIL

The exact backend error payload for these two retests was not captured in repository evidence, so root cause is not marked proven.

## Current assessment

The PO Token experiment did not restore the YouTube -> Localize flow in the tested Cloud Run environment.

Because both the previously blocked video and a separate copyright-free video fail after the same deployed configuration, a content-specific copyright/restriction explanation is no longer the leading hypothesis. Cloud Run/datacenter egress or YouTube cloud-origin access restrictions are the stronger suspected cause.

## Decision

Do not escalate to:

- YouTube account cookies
- proxy rotation
- DRM bypass
- authentication-bypass techniques

Keep the official YouTube IFrame player as the supported playback path. Prefer current-tab audio capture on compatible desktop browsers for user-authorized local capture. Treat Cloud Run Localize as `LIMITED` / experimental until a compliant reliable server-side route is identified.
