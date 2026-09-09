# WMS UX / Experience Phase Index — 2026-09-09

## Status

Planning only. No UI/player runtime code is changed on this branch.

Stable reference:

- branch: `main`
- baseline commit at planning start: `a0bb675c81caf476e4cbc58ce5f9a1302ac4c3bd`

Planning branch:

- `plan/ux-experience-roadmap`

The current Player design and behavior on `main` must remain recoverable while these ideas are evaluated.

---

# Final recommended phase order

## Phase P0 — Performance Foundation

**First priority.**

Playback-first architecture, polling/observer reduction, remount audit, visualizer render budgets, off-screen suspension, adaptive performance, FFmpeg workload discipline and CSS compositor audit.

Detailed plan:

- `docs/PERFORMANCE_FOUNDATION_PLAN_2026-09-09.md`

Reason:

> Do not add more visual complexity until WMS can protect audio continuity while the user navigates and performs other tasks.

---

## Phase P1 — Performance regression baseline

Establish desktop + Android/PWA scenarios for playback continuity, visualizer load, navigation, Queue, Recorder and FFmpeg combinations.

Performance becomes a release gate for every later UX phase.

---

## Phase UX-0 — Stable-player protection rules

Freeze the current Player as the comparison reference. Keep state/transport refactors separate from visual redesign work.

---

## Phase UX-1 — Common Media Card

Unify Local / YouTube / Recorder / FFmpeg-result interaction language:

- `▶ 今すぐ再生`
- `＋ 次に再生`
- Player/Queue-side `♡ プレイリスト`

---

## Phase UX-2 — Contextual controls

Reduce permanent buttons. Show the next useful action according to state; keep secondary actions behind `…` / long press.

Optional experiment: Zero Text Mode.

---

## Phase UX-3 — Search-first WMS

One global search/paste entry point where practical. Local library and supported media sources converge on the same Media Card result model.

---

## Phase UX-4 — Ambient / Now Playing

Large visual field, minimal transport, idle control hiding and optional Visualizer World.

---

## Phase UX-5 — Retro Car Audio / Night Drive

Original WMS interpretation of classic high-end car-audio displays:

- Night Drive
- Graphic EQ Deck
- Cassette Drive
- amber / green / ice-blue illumination
- L/R meters
- peak hold
- dot-matrix title
- spectrum analyzer

No KENWOOD logos, copied model names or pixel-perfect protected product faceplates.

---

## Phase UX-6 — Time Machine Skins

Era/device-level transformations rather than simple recoloring:

- 1979 cassette
- 1988 car audio / graphic EQ
- 1997 desktop MP3 era
- 2005 portable player
- 2035 spatial/glass
- 2080 near-textless generative UI

---

## Phase UX-7 — Queue as a visual object

Optional experiments:

- Queue Conveyor
- Magnetic Media
- Spatial Queue

Keep a conventional accessible list fallback.

---

## Phase UX-8 — Adaptive interface

Device/context-aware layouts, one-handed mobile operation, landscape/deck layouts and Performance AUTO/QUALITY/ECO behavior.

---

## Phase UX-9 — Experimental worlds

Optional, non-default experiments only:

- Music Room
- Audio Map
- Planet Queue
- Sound Creature / Audio Pet
- Infinite Visual

---

## Phase UX-10 — Consolidation

Promote only ideas that improve WMS without harming playback continuity, understandability, accessibility, battery/CPU use or mobile operation.

---

# Documents

Full UX idea catalog and phase concepts:

- `docs/UX_EXPERIENCE_ROADMAP_2026-09-09.md`

Playback/performance-first engineering plan:

- `docs/PERFORMANCE_FOUNDATION_PLAN_2026-09-09.md`

This index is the priority order when the two documents overlap.

---

# Implementation rule

No phase begins automatically from these documents.

When a phase is approved:

1. branch from the current stable `main`
2. keep scope bounded
3. do not mix playback architecture rewrites with visual experiments
4. Typecheck / Build
5. real-device regression appropriate to the change
6. compare against the stable Player baseline
7. merge only after validation

Recommended first future implementation branch, only when explicitly approved:

`perf/playback-core-foundation`
