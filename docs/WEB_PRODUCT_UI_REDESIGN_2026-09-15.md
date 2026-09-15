# Web Media Studio — Product UI Redesign

Last updated: 2026-09-15 JST
Status: design proposal only; not implemented yet
Target: `goroyattemiyo/web-media-studio`
Reference implementation: `goroyattemiyo/web-media-studio-android`

## 1. Goal

Make the Web/PWA version feel like a finished media product instead of a collection of tools.

The redesign must preserve the useful Web-only features, but the first-time experience should answer three questions immediately:

1. Where do I find or open media?
2. What is playing now?
3. Where is my saved media?

The product should remain recognizably WMS: dark/neon identity, switchable skins, player visuals, local-first media, recorder, FFmpeg tools, playlists and provider-aware playback.

## 2. Designer review summary

### Product / Web designer view

The current Web UI has strong visual assets and many capable features, but information hierarchy is weak because product functions and developer/advanced functions compete at the same visual level.

The main visual problems are:

- too many primary destinations
- horizontal tool-card paging plus a second mini-player layer
- several controls visible before the user has media loaded
- settings, capability checks, recorder and FFmpeg appear as peer-level product destinations
- Search exists inside the YouTube/provider surface instead of owning the launch experience
- the old App layout still exists underneath newer UI overlays, making spacing and hierarchy harder to control consistently

### UI / UX designer view

The current interaction model asks the user to understand WMS architecture before using WMS.

Examples:

- `Player`, `Library`, `YouTube`, `Recorder`, `Tools`, `Device` are presented equally even though they are not equally frequent tasks
- a user searching for media must understand the difference between Video Search and the YouTube provider player
- advanced playback controls are visually close to basic playback controls
- technical capability/status information is too easy to encounter during normal use
- the floating player helps continuity but still looks like a control strip rather than a media object because artwork/thumbnail is not the primary visual anchor

The redesign should use progressive disclosure: common actions first, advanced actions only when requested.

## 3. What Android gets right

The Android UI establishes a clearer product model:

`Search or Share -> Import -> Library -> Playback`

Useful concepts to bring back to Web:

- launch into Search, not Player or diagnostics
- one prominent Search / URL input
- thumbnail-first search results
- one obvious primary action per result
- persistent mini player after media is loaded
- Settings / Appearance / Developer functions outside primary navigation
- Search providers are implementation details behind one Search experience

The Web version should not copy Android literally. Recorder, FFmpeg and richer desktop controls remain useful on Web, but they should move to secondary navigation.

## 4. New information architecture

### Primary surfaces

1. **Search** — default launch surface
2. **Library** — saved local media and playlists
3. **Player** — full Now Playing / queue
4. **More** — Recorder, Audio Tools, Settings

Do not show `Device Check` as a primary destination.
Do not show provider names such as `YouTube` as a primary navigation destination.

### Mobile navigation

```text
┌──────────────────────────────┐
│ ◇ WMS                    ⋯   │
│                              │
│          active page         │
│                              │
│ ┌──────────────────────────┐ │
│ │ thumbnail  title     ▶   │ │  mini player
│ └──────────────────────────┘ │
│ Search   Library  Player More│
└──────────────────────────────┘
```

### Desktop navigation

Use the same four destinations, but allow a compact left rail or top-level tab treatment. Do not introduce a different information architecture just because more width is available.

## 5. Search — new default home

Search becomes the visual home of WMS.

### Header

- WMS emblem
- `WMS` / `Web Media Studio`
- overflow button
- no always-visible Skin selector

Skin, visualizer and backdrop settings belong under `More -> Appearance`.

### Primary search field

One field accepts:

- search terms
- full HTTP(S) URL

Suggested copy:

`曲名・アーティスト・URLを入力`

The input should be the first dominant control after the brand header.

Provider selectors should only be shown when more than one working provider is actually available.

### Search results

Each result is a media card:

```text
┌────────────────────────────────┐
│ [ thumbnail ]  Title           │
│                Artist / source │
│                duration        │
│                                │
│ [ ▶ 再生 ] [ ＋ 次に ] [ ⋯ ]  │
└────────────────────────────────┘
```

Primary action is `再生`.
Secondary action is `次に再生` when supported.
`元サイト`, `Download`, diagnostics and provider-specific actions move into `⋯` unless they are essential for the current source.

### Remote video playback

When a search result starts remote video playback, the active video should remain visibly attached to the Search experience instead of requiring the user to discover a separate provider card.

On desktop, use a sticky player area above results when video is active.
On mobile, use a compact inline video/player area that can expand to Player.

## 6. Mini player

The mini player is persistent whenever media is loaded and the full Player is not the dominant surface.

Required visual order:

1. thumbnail / artwork / video preview fallback
2. title
3. play/pause
4. next

Optional actions should not crowd the default row.
Previous, queue, playlist and other actions may be revealed on expansion or on wider screens.

Fallback visual priority:

1. provider/search thumbnail
2. local embedded artwork when available later
3. video preview frame/poster when available
4. WMS emblem

Do not use a generic music-note icon as the normal long-term representation of loaded media.

## 7. Full Player / Now Playing

The Player should feel like one coherent media player, not a control laboratory.

### Top half

For video:

- video is the main visual immediately

For audio:

- artwork or selected WMS visualizer is the main visual

The visualizer is first-class product UI and must not disappear behind advanced settings.

### Track information

- title
- artist/provider/source when known
- playlist/queue context as secondary text

### Primary controls

- previous
- play/pause
- next
- seek bar
- elapsed / remaining or elapsed / duration

### Secondary controls

Move into an expandable `Playback options` area:

- ±10 sec
- shuffle
- repeat
- speed
- volume
- A-B loop

A-B loop remains important for practice use, but it is not a first-screen control for every user.

### Queue

Queue should be a collapsible lower sheet/panel rather than always competing with the main player visual.

## 8. Library

Library should answer `What have I saved?` before exposing storage internals.

### Top controls

- `＋ 端末から追加`
- search/filter saved media later
- `Playlists` shortcut
- overflow for folder import, storage details and maintenance

### Media rows/cards

Each saved item should use:

- thumbnail/artwork/emblem fallback
- title
- short media/source metadata
- one primary row action: play
- overflow menu for delete, save-state/queue operations

Do not show `Save`, `Delete`, `↑`, `↓`, and `×` as five peer-level controls on every row.

### Playlists

Named playlists should be a visible Library subsection, not mixed with raw storage controls.

## 9. More

`More` opens a simple sheet/menu:

- Recorder
- Audio Tools
- Appearance
- Settings

Development/diagnostic information should be nested under Settings only when needed.

### Recorder

Recorder remains a product feature, but it is not part of the primary playback navigation.

### Audio Tools

FFmpeg conversion remains available, but normal playback should never feel like it depends on FFmpeg.

### Appearance

Combine:

- Skin
- Visualizer
- Backdrop
- reduced motion / effects later

Do not keep separate top-bar appearance controls and a Settings appearance section at the same time.

## 10. Navigation behavior

The current UI uses horizontal scroll-snap cards and a pager. This should be removed from the final product navigation.

Target behavior:

- tapping a primary destination changes the active surface directly
- browser back should eventually return to the previous surface/state where practical
- no requirement to horizontally swipe through unrelated tools
- mini-player tap opens Player
- remote video started in Search stays visibly connected to Search and can expand to Player

During migration, the existing panels may remain mounted internally for compatibility, but only one product surface should be visually dominant at a time.

## 11. Visual design rules

### Preserve

- canonical WMS diamond emblem
- dark neon identity
- cyan/blue/purple accent family
- glass surfaces where they improve hierarchy
- optional immersive skins

### Change

- larger readable body text than the current 8–10 px utility labels
- fewer nested bordered boxes
- fewer simultaneous glow effects
- 44 px minimum touch target on interactive mobile controls
- stronger thumbnail/artwork emphasis
- more empty space around the primary task
- consistent 8 px spacing rhythm with 16/24 px section spacing

### Typography hierarchy

Recommended hierarchy:

- page title: 24–32 px
- section title: 18–22 px
- media title: 14–17 px
- body: 13–16 px
- metadata: 11–13 px

Avoid 8–9 px text for normal user-facing information.

## 12. Accessibility

- visible keyboard focus
- `aria-label` for icon-only controls
- do not encode state by glow/color alone
- respect `prefers-reduced-motion`
- maintain sufficient contrast on all skins
- keep touch targets at least 44 x 44 CSS px where practical

## 13. Architecture implication

The current UI is assembled from the original `App.tsx` plus many DOM/Portal-based Enhancer components.

Do not add another long-lived Enhancer to implement this redesign.

Migration direction:

1. keep existing playback/storage/provider engines
2. introduce an explicit product shell/navigation state
3. move Search, Player, Library and More into first-class React composition
4. gradually retire DOM-query/Portal shims once each migrated surface owns its controls directly

Temporary compatibility adapters are acceptable during migration, but the number of Enhancers should decrease, not increase.

## 14. Implementation phases

### UI-R0 — design baseline

- this document
- no product code change
- no CI required

### UI-R1 — navigation simplification

- Search becomes first destination
- primary navigation becomes Search / Library / Player / More
- remove the visible tool pager
- move Recorder / Tools / Settings into More
- remove always-visible Skin selector from header
- keep current engines and current panel internals

Acceptance:

- first-time user lands on Search
- no horizontal tool discovery is required for primary tasks
- all existing major features remain reachable

### UI-R2 — Search + remote playback integration

- unified Search/URL home treatment
- thumbnail-first cards
- remote video stays visible on Search after play
- provider-specific secondary actions move behind overflow

### UI-R3 — Player redesign

- thumbnail/artwork/video-first layout
- restore visualizer prominence
- primary transport simplified
- advanced playback controls collapsed
- queue becomes collapsible

### UI-R4 — Library redesign

- thumbnail-first saved-media rows
- one-row primary play action
- overflow per item
- playlists separated from storage diagnostics

### UI-R5 — architecture cleanup

- replace DOM-query/Portal Enhancers with explicit component/state ownership
- remove redundant legacy CSS/navigation layers
- add focused regression tests for navigation and playback arbitration

## 15. CI / validation policy

Follow the repository and account Actions-saving policy.

For UI-R1 through UI-R5:

1. branch / Draft PR
2. static code review first
3. TypeScript/API/DOM selector regression review
4. local typecheck/build when available
5. mobile/desktop manual test plan prepared
6. only then run one full Web CI for the finished gate if needed

Do not use CI as a layout-debug loop.

## 16. First implementation recommendation

Start with **UI-R1 only**.

Do not redesign Player and Search internals in the same first patch. The highest-value low-risk change is to fix navigation and information hierarchy first while preserving the proven playback/storage/provider behavior underneath.
