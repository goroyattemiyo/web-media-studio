# Deno + EJS Production Deployment Result

Date: 2026-09-08 JST

## Summary

The revised WMS YouTube worker runtime was deployed successfully to Cloud Run after the fresh Colab comparison identified two distinct failure classes:

1. execution-environment / egress rejection on the tested GitHub-hosted runner
2. the previous WMS runtime forcing `mweb` while not satisfying the usable-media GVS PO Token requirement

The production candidate now uses standard yt-dlp client selection with Deno + EJS and defaults the PO Token experiment to off.

## Implementation PR

PR #37: `fix: use Deno EJS standard YouTube extraction path`

Squash merge commit:

`afce75bf3678b28c3d06d79e87e135fa1466d300`

PR validation:

- Pages typecheck/build: PASS
- Media Worker CI: PASS
- Python tests: 17 PASS
- Deno: `2.9.6`
- yt-dlp: `2026.08.19`
- yt-dlp-ejs: `0.8.0`
- FFmpeg container check: PASS
- default `YOUTUBE_PO_TOKEN_MODE=off`: PASS
- optional Node/bgutil fallback runtime: PASS

## Production deployment

A temporary path-scoped main-push trigger was introduced only to invoke the otherwise manual Cloud Run workflow from the connected GitHub environment.

Deployment PR #38 was squash-merged as:

`c83affdfca7518cc9d70d4c91d41950df6f65ebb`

Cloud Run workflow:

- name: `Deploy Media Worker to Cloud Run`
- run number: `7`
- run ID: `34206262952`
- event: `push`
- result: **SUCCESS**
- region: `asia-northeast1`
- service: `wms-media-worker`
- completed: approximately 2026-09-08 17:51 JST

The completed deployment command explicitly contained:

`YOUTUBE_PO_TOKEN_MODE=off`

and labeled the revision with:

`commit-sha=c83affdfca7518cc9d70d4c91d41950df6f65ebb`

Service URL reported by the deployment action:

`https://wms-media-worker-pcdbs5armq-an.a.run.app`

## Runtime now deployed

Primary path:

- `yt-dlp[default]==2026.8.19`
- matching EJS package
- Deno `2.9.6`
- standard yt-dlp YouTube client selection
- `YOUTUBE_PO_TOKEN_MODE=off`

Optional diagnostic fallback retained:

- Node 22
- `bgutil-ytdlp-pot-provider==1.3.2`
- pinned provider source
- explicit `bgutil-script-mweb` mode only

## Cleanup

The one-shot deployment trigger and marker are removed in the follow-up cleanup PR. The normal Cloud Run workflow returns to manual `workflow_dispatch` only.

## Validation status

Deployment success proves that the revised runtime and configuration reached Cloud Run. It does **not** yet prove that YouTube -> Localize media extraction succeeds in production.

The remaining acceptance test is one authorized production Localize attempt with exact backend result capture.

Until that succeeds, the product state remains:

`Localize: LIMITED / experimental`

## Guardrails

- no YouTube account cookies
- no proxy rotation
- no DRM bypass
- no authentication bypass
- do not treat Colab format discovery as a completed media download
- do not treat successful deployment as successful media extraction
