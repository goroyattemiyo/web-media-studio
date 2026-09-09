# WMS Performance Foundation Plan — 2026-09-09

## Purpose

This is a planning document only. No runtime implementation is included in this branch.

The current `main` player remains the stable reference baseline.

Primary objective:

> Playback must remain the highest-priority experience even while the user navigates WMS, opens Library, changes views, runs visualizers, or performs other supported work.

This phase should be completed before adding more expensive visual effects or large UI experiments.

---

# Phase P0 — Performance Foundation

## Why this phase comes first

WMS now combines several browser workloads at the same time:

- local HTML media playback
- Web Audio analysis
- Canvas visualizers
- React UI updates
- horizontal/page navigation
- queue and playlist synchronization
- DOM observers / compatibility enhancers
- YouTube IFrame playback
- Recorder / Web Audio mixing
- FFmpeg WebAssembly when Tools are used
- translucent surfaces, blur and animated skins

The browser can handle these features, but they must not all compete equally for CPU, memory and main-thread time.

This is not treated as an "HTML has reached its limit" problem. The first response should be architectural and performance optimization.

---

## P0-A — Measure before optimizing

Goal: identify where audio glitches and interaction jank actually begin.

Plan:

- Add a development-only performance diagnostic mode
- Measure long tasks and frame drops where browser APIs allow
- Record visualizer frame time
- Record navigation transition time
- Record active media source and playback state during glitches
- Compare:
  - Player only
  - Player + visualizer
  - Player + Library navigation
  - Player + Queue activity
  - Player + YouTube panel
  - Player + Recorder
  - Player + FFmpeg workload
- Test at least:
  - desktop Chrome
  - current Android Chrome/PWA device
- Do not expose noisy engineering diagnostics in the normal UI

Exit criteria:

- We can reproduce at least one heavy-use scenario and identify the dominant source of load instead of guessing.

---

## P0-B — Playback Core isolation

Goal: keep playback state independent from page/view lifecycle.

Target architecture:

```text
                 PLAYBACK CORE
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   Full Player    Mini Player     Queue
        │
   Visualizer
```

Rules:

- Player state is the source of truth
- UI observes playback state; UI does not infer it by repeatedly scraping the DOM where avoidable
- Internal WMS navigation never remounts the active media element unless media itself changes
- Library refresh must not recreate the entire playback application
- Switching visual presentation must not recreate the audio source
- Local / YouTube source arbitration occurs only when another source actually starts playback

Important audit target:

- Review the current `App key={libraryRevision}` pattern because a key change can recreate the App tree. Future architecture should update Library state without using full-App remount as the synchronization mechanism.

Exit criteria:

- Library refresh and WMS page navigation do not recreate the active local media element.

---

## P0-C — Replace polling with events/state

Goal: reduce periodic DOM work while media is playing.

Current architecture contains compatibility/enhancer layers that periodically inspect rendered DOM. This is useful during rapid development but should not become the long-term playback-state bus.

Plan:

- Replace Mini Player periodic state snapshots with playback events/state subscriptions where practical
- Replace Queue periodic DOM snapshots with explicit queue-change events
- Replace playlist polling with explicit playlist-change events
- Keep MutationObserver only where it protects integration with legacy DOM that has not yet been refactored
- Remove observers immediately when their owning feature is inactive/unmounted
- Avoid global subtree observers when a narrower target is sufficient

Desired flow:

```text
Playback / Queue state changes
          ↓
      event/store
          ↓
Mini Player / Queue / UI
```

instead of:

```text
Timer
  ↓
query DOM
  ↓
compare text/classes
  ↓
update React
```

Exit criteria:

- Shared playback controls do not require sub-second DOM polling.

---

## P0-D — Visualizer budget

Goal: visualizers must never be allowed to damage playback quality.

Plan:

- Introduce a common render budget for every visualizer
- Stop or sharply reduce rendering when the visualizer is fully off-screen
- Pause expensive animation when the document is hidden where appropriate
- Cap Canvas device-pixel ratio on mobile
- Avoid allocating gradients/large temporary objects every frame when reusable
- Reduce expensive shadow blur / composite operations on constrained devices
- Keep `prefers-reduced-motion`
- Consider 30 fps as the normal mobile target where 60 fps gives little visual benefit
- Allow 15 fps / static fallback under heavy load
- Ensure analyser work is not duplicated by multiple visualizers
- Only one visualizer renderer should be active at a time

Quality levels:

- HIGH — maximum intended visual quality
- BALANCED — reduced resolution / 30 fps
- ECO — minimal effects / 15–30 fps

Exit criteria:

- Visualizer quality can be reduced without affecting playback state.

---

## P0-E — Adaptive Performance Mode

Goal: make performance management understandable to users without exposing engineering complexity.

Possible Settings UI:

### Performance

- `AUTO` — recommended; WMS adjusts visuals according to current workload
- `QUALITY` — prefer visual quality
- `ECO` — prefer lower CPU / battery usage

AUTO concept:

```text
Normal playback
→ visualizer normal quality

Load increases
→ visualizer 30 fps
→ reduce blur / particles

Heavy task such as FFmpeg
→ visualizer 15 fps or static
→ decorative background animation off
→ playback controls remain responsive
```

Optional tiny indicator:

`PERFORMANCE  ●●●○`

Do not show raw CPU percentages unless they are genuinely measured and trustworthy.

Exit criteria:

- User can select one understandable performance preference; default remains AUTO.

---

## P0-F — Background and hidden-view discipline

Goal: inactive WMS views should cost almost nothing.

Plan:

- Stop visual-only timers in off-screen cards
- Do not keep expensive Canvas loops alive for hidden visualizers
- Avoid repeated layout measurement on pages that are not visible
- Lazy-load heavy feature code where possible
- Recorder meters operate only while Recorder needs them
- FFmpeg UI progress work exists only while a job is active
- Keep media playback alive independently from decorative page work

Exit criteria:

- Navigating away from a feature reduces its ongoing CPU/render work without stopping playback.

---

## P0-G — FFmpeg workload isolation

Goal: local conversion should degrade visual effects before it degrades playback.

Plan:

- Audit current ffmpeg.wasm threading/worker behavior before changing it
- Keep conversion work away from normal UI work as much as supported by the chosen FFmpeg integration
- Avoid simultaneous duplicate decoding/analysis of the same media
- During conversion, AUTO Performance Mode may temporarily reduce visual effects
- Provide an explicit heavy-task status rather than letting the UI appear broken
- Stress-test mobile memory limits with realistic media sizes

Guardrail:

- Do not claim a Worker/threading improvement until the actual FFmpeg integration is verified to use it.

Exit criteria:

- Starting conversion does not unnecessarily keep decorative high-cost rendering active.

---

## P0-H — CSS / compositor cost audit

Goal: keep skins visually rich without excessive repaint cost.

Audit candidates:

- large `backdrop-filter: blur(...)`
- full-screen translucent layers
- multiple simultaneous box shadows
- animated filters
- large glowing elements
- scanline overlays
- background animation under moving panels

Strategy:

- preserve the visual identity of each skin
- prefer compositor-friendly transforms/opacity for animation
- use expensive blur/glow selectively rather than everywhere
- lower effects under ECO/AUTO heavy-load states

Exit criteria:

- Each major skin has a lightweight path.

---

# Phase P1 — Performance regression suite

Goal: prevent later visual experiments from reintroducing audio instability.

Real-device scenarios:

1. Local audio + Player only
2. Local audio + active audio-reactive visualizer
3. Local audio + navigate Player → Library → Recorder → Tools → Settings
4. Local audio + manipulate Queue
5. Local audio + change Skin and visualizer
6. Local audio + device screen-off/background behavior where supported
7. YouTube playback + WMS internal page navigation
8. Recorder while supported playback source is active
9. FFmpeg job while local playback is active, only if the device can reasonably support that combination

For every scenario record:

- audio continuity
- visible interaction lag
- source unexpectedly paused or recreated
- visualizer behavior
- thermal/battery concerns when obvious
- browser/device used

Exit criteria:

- A defined regression checklist exists before UX visual expansion resumes.

---

# Phase P2 — Resume UX evolution

Only after P0/P1 are satisfactory should WMS proceed with the larger UX roadmap:

1. Common Media Card
2. Contextual controls / button reduction
3. Search-first WMS
4. Ambient Mode
5. Retro Car Audio / Night Drive visualizers
6. Time Machine Skins
7. Queue Conveyor / spatial experiments
8. Adaptive / experimental worlds

Performance remains a release gate for every later phase.

---

# Relationship to current `main`

Current `main` is intentionally preserved as the working reference player.

This planning branch must not be merged merely because the plan exists.

When implementation starts:

- create a dedicated `perf/...` feature branch from the chosen stable `main`
- implement one bounded optimization at a time
- Typecheck / Build
- compare behavior against the stable baseline
- real-device playback regression
- only then consider merge

Recommended first implementation branch when approved:

`perf/playback-core-foundation`

Recommended first implementation target:

> Remove unnecessary state polling/remount pressure without changing the visible Player design.
