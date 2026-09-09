# WMS UX / Experience Roadmap — 2026-09-09

## Purpose

This document is a planning branch for future WMS UX/UI evolution.

**Important:** the current `main` player experience remains the stable reference. This branch is documentation/planning only unless a later phase is explicitly approved for implementation.

Product direction:

> Make finding, playing, saving, watching, and transforming media feel simple, tactile, and enjoyable.

Core UX rule:

- Find media anywhere
- Use the same primary actions everywhere
- Keep playback persistent
- Keep details hidden until needed
- Let skins/visualizers provide personality without harming usability

---

## Baseline to preserve

The current player on `main` is the reference baseline and should remain recoverable.

Preserve these principles:

- Player remains the playback center
- Queue remains directly associated with playback
- Local / YouTube / Recorder / FFmpeg results converge on common actions
- WMS internal page navigation does not intentionally stop playback
- Floating Mini Player provides persistent shared controls
- Japanese is the default UI language, with EN switching
- Info/Tips live behind explicit information controls instead of constant text
- System messages are consolidated rather than scattered across cards
- Existing working local-media playback, queue, playlists, recording, FFmpeg and YouTube paths must not regress when future visual experiments are added

Any future phase that materially changes Player layout should be developed in its own feature branch and compared against this baseline.

---

# Phase UX-0 — Baseline freeze and design rules

**Goal:** protect the current working player before experimenting.

- Treat current `main` Player as the reference implementation
- Do not redesign transport and media state in the same PR
- Visual experiments must be detachable
- Keep accessibility and `prefers-reduced-motion`
- Keep contrast checks for native controls and dropdowns
- Preserve real-device mobile usability as a release gate
- Shared Media Action vocabulary:
  - `▶ 今すぐ再生`
  - `＋ 次に再生`
  - `♡ プレイリスト`
- Avoid permanent buttons when contextual actions can replace them

Exit criteria:

- Future UX work can be reverted without damaging playback state or media storage

---

# Phase UX-1 — Common Media Card system

**Goal:** every playable source feels like the same WMS object.

Candidates:

- Standardize Local / YouTube / Recorder / FFmpeg-result cards
- Common card anatomy:
  - artwork / source icon
  - title
  - source
  - duration when available
  - `▶ 今すぐ再生`
  - `＋ 次に再生`
- Playlist saving stays toward Player / Queue rather than every source card
- Long-press / `…` for secondary actions
- Hide technical metadata until requested
- Consistent selected / playing / queued states

Why first:

This reduces cognitive load more than adding new features.

---

# Phase UX-2 — Contextual controls / fewer buttons

**Goal:** show only controls that are useful in the current state.

Concepts:

- Nothing selected → only the primary discovery/import action
- Media selected → `▶ / ＋`
- Media playing → emphasize `Ⅱ / ⏭ / Queue`
- Long-press or `…` for delete, export and technical details
- Replace repeated labels with icon + short verb
- Let Mini Player replace duplicated transport controls on secondary pages
- Keep destructive actions visually separated

Experimental option:

### Zero Text Mode

A mode where labels are minimized and the UI relies on icons, position, state and animation. Standard labeled mode remains default.

---

# Phase UX-3 — Search-first WMS

**Goal:** reduce the distance between “I want to hear this” and playback.

Ideas:

- One global search/paste field
- Detect input type automatically:
  - Local library query
  - YouTube URL
  - YouTube search term if an official search API path is available
  - direct media URL where supported
- Search results use the common Media Card
- Play / Next / Copy URL where relevant
- Recent searches and recent playback
- Optional command palette (`Ctrl+K` on desktop)

Guardrail:

Do not add a scraping dependency merely for convenience.

---

# Phase UX-4 — Ambient / Now Playing experience

**Goal:** make playback itself enjoyable to look at.

## Ambient Mode

- Hide most controls after a short idle period
- Large visualizer / artwork
- Track title and minimal transport only
- Tap anywhere to restore controls

## Visualizer World

- Visualizer can expand from the Player rectangle to the full WMS background
- Player controls float above the visual field
- Keep a low-power mode for mobile

## Dynamic typography

- Track title can subtly react to audio
- Never reduce readability

---

# Phase UX-5 — Retro Car Audio visualizers

**Goal:** add a distinctive nostalgic visualizer family inspired by classic high-end car audio without copying brand logos, model names or exact proprietary faceplates.

Working family name: **Night Drive / Retro Head Unit**

## 5A — Night Drive

- Wide black head-unit display
- Amber / green / ice-blue illumination variants
- Dot-matrix scrolling track title
- Stereo L/R level meters
- Central spectrum analyzer
- Small playback indicators such as `RPT`, `RDM`, `EQ`, `ST`
- Peak-hold bars
- Seven-segment-style time display

## 5B — Graphic EQ Deck

- 7 / 10 / 12 band spectrum layout
- Frequency labels such as 60 / 150 / 400 / 1k / 2.4k / 6k / 15k
- Peak-hold behavior
- Real Web Audio analyser input for Local media where available
- Fallback animation where analyser input is unavailable

## 5C — Cassette Drive

- Hybrid cassette/head-unit presentation
- Animated reels
- L/R meters
- Mechanical playback indicators
- REC lamp when Recorder is active

Potential names:

- Night Drive
- Highway Deck
- Retro Head Unit
- Equalizer Dash
- Tape Deck Drive
- Street Audio
- Midnight Console

Important:

- No KENWOOD logo
- No copied model names
- No pixel-perfect reproduction of a protected product faceplate
- Treat it as an original WMS interpretation of the era and interaction style

---

# Phase UX-6 — Time Machine Skins

**Goal:** make Skin selection feel like changing era/device, not merely changing color.

Concept:

### TIME MACHINE

- `1979` — cassette / analog deck
- `1988` — car stereo / graphic equalizer
- `1997` — desktop MP3 / Winamp-era inspiration
- `2005` — portable MP3 player
- `2035` — glass / spatial console
- `2080` — near-textless generative interface

Each era may change:

- font
- panel geometry
- corner radius
- button style
- background texture
- display technology metaphor
- visualizer treatment
- animation behavior

Constraint:

Playback logic remains independent of Skin.

---

# Phase UX-7 — Queue as a visual object

**Goal:** make playback order understandable without reading a dense list.

Experiments:

## Queue Conveyor

- Current track centered
- Next tracks approach from the right
- Played tracks drift left

## Spatial Queue

- Next tracks appear deeper in space
- Current item is visually closest

## Magnetic Media

- Selecting `＋ 次に再生` visually pulls a media card into the Queue

Guardrail:

Always provide a conventional accessible list fallback.

---

# Phase UX-8 — Adaptive / context-aware interface

**Goal:** let the same WMS adapt to device and use context.

Ideas:

- One-handed mobile layout → controls near bottom thumb zone
- Desktop → larger queue and keyboard shortcuts
- Landscape → optional deck-style layout
- Driving / Night mode → large transport, minimal text, dark illumination
- Low-power state → reduce visualizer frame rate
- Reduced-motion state → static visual treatment

Experimental:

## Context UI

Prioritize the most likely next action based on current state without hiding critical controls unpredictably.

---

# Phase UX-9 — Experimental worlds

These are deliberately non-standard and should remain optional experiments.

## Music Room

Represent Library / YouTube / Recorder as spaces rather than tabs.

## Audio Map

Playback history becomes a visual map of listening activity.

## Planet Queue

Tracks are planets; playlists are star systems; current playback is the central body.

## Sound Creature / Audio Pet

An abstract WMS visual entity reacts to playback and changes over time.

## Infinite Visual

Visual scenes morph continuously from one track to the next rather than resetting.

These should never replace normal navigation until real user testing proves value.

---

# Phase UX-10 — Release-quality consolidation

**Goal:** decide what becomes WMS identity and what remains optional novelty.

Evaluate each experiment by:

- Can a new user understand playback within 10 seconds?
- Does it reduce or increase button count?
- Does it work on mobile?
- Does it preserve playback continuity?
- Does it remain readable in all skins?
- Does it work with reduced motion?
- Does it noticeably increase CPU/battery usage?
- Does it make WMS more memorable without making it harder to use?

Promote only successful concepts into the stable experience.

---

# Suggested implementation order

## Near term

1. Media Card consistency
2. Contextual controls / button reduction
3. Search / paste simplification
4. Floating Player polish
5. Queue-level transport consistency

## Mid term

6. Ambient Mode
7. Night Drive / Retro Head Unit visualizer
8. Graphic EQ visualizer
9. Visualizer World
10. Time Machine Skin framework

## Experimental / optional

11. Queue Conveyor
12. Magnetic Media animation
13. Spatial Queue
14. Sound Creature
15. Planet / Room interfaces

---

# Product identity candidates

The strongest WMS identity candidates are:

1. **Common Media Card** — everything behaves the same
2. **Persistent Mini Player** — playback is always reachable
3. **Ambient Mode** — music becomes visual
4. **Night Drive visualizers** — distinctive retro audio culture
5. **Time Machine Skins** — the whole player changes era/device personality

Possible product statement:

> WMS is a media player where finding, playing, saving and watching media is simple — and the player itself is fun to experience.

---

## Branch policy for this plan

- Keep current `main` as the stable Player baseline
- This planning branch does not imply implementation
- Each approved UX phase should use a separate feature branch
- Do not bundle Player state-model rewrites with visual experimentation
- Merge only after Typecheck / Build / real-device regression appropriate to the phase
