# AGENTS.md

## Purpose

This repository is developed with AI-assisted workflows. Treat the repository documents as the source of truth and do not invent implementation status.

## Source of truth order

1. `docs/CURRENT_IMPLEMENTATION.md` — what actually exists now
2. `docs/REQUIREMENTS.md` — product requirements and constraints
3. `docs/ARCHITECTURE.md` — intended technical structure
4. `docs/ROADMAP.md` — phased plan
5. `README.md` — public overview

When documents conflict, stop and resolve the conflict instead of guessing.

## Development workflow

Use this sequence for non-trivial work:

1. Plan — identify requirement, affected modules, risks and acceptance criteria.
2. Execute — implement the smallest coherent change.
3. Test/Check — run lint, typecheck, tests and build relevant to the change.
4. Review — check regressions, browser implications, privacy and performance.
5. Improve — fix discovered issues and re-run checks.

Do not spend excessive time extending the plan once the implementation path is clear.

## Branch policy

- `main` is the deployable source of truth.
- Do feature work on `feat/*`, fixes on `fix/*`, and documentation-only changes on `docs/*` where practical.
- Prefer pull requests into `main`.
- Do not force-push `main`.

## Architecture rules

- Mobile first.
- Core playback must not depend on FFmpeg.
- FFmpeg must be lazy-loaded.
- Providers must not leak provider-specific behavior into generic player UI/state.
- Use feature detection for browser APIs.
- Background playback is best effort; never hard-code a promise that all browsers/OSes will continue playback.
- Keep local user media and recordings local unless a future feature explicitly requires user-approved upload.
- Never commit secrets, API keys, cookies or access tokens.
- Treat external URLs and media metadata as untrusted input.

## YouTube boundary

YouTube integration is for official embedded playback/control. Do not implement stream scraping, audio extraction or download from YouTube URLs.

## FFmpeg boundary

Initial GitHub Pages deployment should assume a single-thread-compatible ffmpeg.wasm configuration. Do not require cross-origin isolation until deployment headers and target-browser behavior have been explicitly verified.

## UI/UX quality

The app should look like a finished media product rather than a developer utility.

- consistent spacing and typography
- responsive touch targets
- accessible focus/labels
- polished empty/loading/error states
- switchable design-token-based skins
- no duplicate per-theme component markup

## Testing expectations

Before declaring work complete, check as applicable:

- lint
- TypeScript typecheck
- unit tests
- production build
- local media playback regression
- mobile viewport behavior
- permission-denied paths for microphone/storage APIs

Browser/OS-specific features require real-device validation before being marked fully supported.

## Documentation discipline

After a meaningful implementation step:

- update `docs/CURRENT_IMPLEMENTATION.md`
- update `docs/ROADMAP.md` checkboxes only for verified work
- document newly discovered browser/platform constraints

Do not describe planned work as implemented work.
