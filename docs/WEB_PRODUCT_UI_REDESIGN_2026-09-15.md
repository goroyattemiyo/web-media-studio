# Web Media Studio — Product UI Redesign

Last updated: 2026-09-15 JST
Status: design baseline; implementation follows in UI-R gates
Target: `goroyattemiyo/web-media-studio`
Reference implementation: `goroyattemiyo/web-media-studio-android`

## 1. Goal

Make the Web/PWA version feel like a finished media product instead of a collection of tools.

The redesign must preserve the useful Web-only features, but the first-time experience should answer four questions immediately:

1. Where do I find/open media?
2. Where do I open media already on this device?
3. What is playing now?
4. Where are advanced tools/settings when I need them?

The product should remain recognizably WMS: dark/neon identity, switchable skins, player visuals, local-first media, playlists, recorder, FFmpeg tools and provider-aware playback.

## 2. Designer review summary

### Product / Web designer view

The current Web UI has strong visual assets and many capable features, but information hierarchy is weak because product functions and developer/advanced functions compete at the same visual level.

Main problems:

- too many primary destinations
- horizontal tool-card paging plus a second mini-player layer
- several controls visible before media is loaded
- Settings, capability checks, Recorder and FFmpeg appear as peer-level destinations
- Search exists inside the YouTube/provider surface instead of owning launch
- the old App layout remains underneath newer Portal/Enhancer layers
- provider/implementation boundaries are visible where user-task boundaries should be visible

### UI / UX designer view

The current interaction model asks the user to understand WMS architecture before using WMS.

Examples:

- `Player`, `Library`, `YouTube`, `Recorder`, `Tools`, `Device` are presented equally
- a user searching for media must understand Video Search vs YouTube Player
- advanced playback controls sit too close to basic playback controls
- capability/status information appears during normal use
- the floating player is control-first rather than artwork/media-first
- the simplified Local/Library UI currently filters saved media to audio, so saved video can disappear from the simplified surface

Use progressive disclosure: common actions first, advanced actions only when requested.

## 3. What Android gets right

Android establishes a clearer model:

`Search or Share -> Import -> Local Library -> Playback`

Bring these concepts back to Web:

- launch into Search
- one prominent Search / URL input
- thumbnail-first results
- one obvious primary action per result
- persistent mini player after media is loaded
- Settings / Appearance / Developer functions outside primary navigation
- Search providers behind one Search experience

The Web version should not copy Android literally. Web has a second equally important intake path: local files already on the device. Therefore Web primary navigation should expose **Local** directly.

## 4. New information architecture

### Primary surfaces

1. **Search** — default launch; keyword or URL
2. **Local** — device files, WMS-saved audio/video, playlists
3. **Player** — full Now Playing / queue
4. **More** — Recorder, Audio Tools, Appearance, Settings, fallback/diagnostics

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
│ │ artwork  title       ▶   │ │
│ └──────────────────────────┘ │
│ Search    Local   Player More│
└──────────────────────────────┘
```

### Desktop navigation

Use the same four destinations. A compact rail/top tab is acceptable, but do not create a second desktop-only information architecture.

## 5. Search — default home

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

Provider selectors should only appear when more than one working provider is actually available.

### Search results

```text
┌────────────────────────────────┐
│ [ thumbnail ]  Title           │
│                Artist / source │
│                duration        │
│                                │
│ [ ▶ 再生 ] [ ＋ 次に ] [ ⋯ ]  │
└────────────────────────────────┘
```

Primary: `再生`.
Secondary: `次に再生` when supported.
`元サイト`, `Download` and provider-specific actions move into `⋯` unless essential.

### Remote video playback

Starting remote video should not force the user to discover a separate provider card.

- desktop: sticky/inline player above results
- mobile: compact inline player that expands to Player

## 6. Local — first-class Web intake surface

`Local` is not just the old Library panel renamed. It is the home for media already on the device and media WMS has saved locally.

### Local top actions

Primary:

- `＋ 端末メディアを追加`

Secondary / overflow:

- folder import when supported
- storage details
- clear temporary items
- maintenance actions

The main copy must say **media**, not only **曲**, because WMS supports audio and video.

### Local sections

1. **Recently added / current local queue**
2. **Saved media** — audio + video
3. **Playlists**

Do not filter the simplified saved-media list to audio only.

### Local media card

Each row/card:

- thumbnail/artwork/video poster/WMS emblem fallback
- title
- audio/video type + short source metadata
- row tap or primary button = Play
- `⋯` for delete, save, reorder, queue removal

Do not show `Save`, `Delete`, `↑`, `↓`, `×` as peer-level buttons on every row.

### Local missing capabilities to address

- saved video must appear alongside audio
- video should open the Player immediately, not look like an unsupported library item
- local rows need media-type visibility
- playlists need a visible Local subsection
- storage quota/protection text moves out of the main list into details/settings
- thumbnail/artwork fallback should replace generic note-only presentation

## 7. Mini player

Persistent whenever media is loaded and full Player is not dominant.

Required order:

1. artwork / thumbnail / video poster
2. title
3. play/pause
4. next

Previous, queue, playlist and advanced actions can be revealed on expansion/wider layouts.

Fallback priority:

1. provider/search thumbnail
2. embedded local artwork when available
3. video poster/frame when available
4. WMS emblem

Do not use a generic music-note icon as the normal loaded-media identity.

## 8. Full Player / Now Playing

The Player should feel like one coherent media player, not a control laboratory.

### Main visual

Video: video immediately.
Audio: artwork or selected WMS visualizer.

Visualizer remains a first-class WMS feature.

### Track information

- title
- artist/provider/source when known
- playlist/queue context secondary

### Primary controls

- previous
- play/pause
- next
- seek
- elapsed / duration

### Playback options

Collapse into an expandable area:

- ±10 sec
- shuffle
- repeat
- speed
- volume
- A-B loop

A-B remains valuable for practice but is not first-screen UI for everyone.

### Queue

Use a collapsible lower sheet/panel instead of permanently competing with the main visual.

## 9. Download / Localize and Colab fallback

The current repository still contains `ColabCompanionShell`, but production `main.tsx` no longer mounts it. Direct Cloud Download replaced the mounted Companion path. Therefore a user currently cannot reconnect a `gradio.live` Companion from normal WMS UI.

This is a product/UI defect if Colab remains a supported fallback.

### Product rule

Normal flow:

`Search / URL -> Play`

For authorized local acquisition where available:

`Download -> preferred available method`

Colab must be **fallback**, not another primary tab.

### Download sheet

When Download is selected:

```text
Download
  format: MP3 / M4A / WAV
  rights confirmation
  [ Download ]

  Cloud unavailable?
  [ Colab Companionを使う ]
```

### Colab Companion fallback

When expanded:

- `Companionを起動` opens canonical notebook
- paste/register `https://xxxxx.gradio.live`
- visible OFFLINE / CONNECTING / READY / EXPIRED status
- reconnect / disconnect
- current download target is retained
- separate-tab fallback remains available
- rights confirmation is still performed on the Companion side per job

Do not display the Colab connection form permanently on Search Home.

### Implementation constraint

Direct Cloud Download and Colab Companion must not both intercept the same Download click independently.

Refactor toward one Download coordinator:

`Download action -> Download coordinator -> Cloud OR Colab fallback`

During migration, a custom WMS event/handoff is acceptable, but there must be exactly one owner of the initial Download action.

## 10. More

`More` opens a simple sheet/menu:

- Recorder
- Audio Tools
- Appearance
- Settings

Optional/fallback entries:

- Colab Companion status / reconnect
- diagnostics under Settings/Developer

### Recorder

Product feature, but not primary playback navigation.

### Audio Tools

FFmpeg remains available; normal playback must not feel dependent on FFmpeg.

### Appearance

Combine:

- Skin
- Visualizer
- Backdrop
- reduced motion/effects later

Do not keep duplicate top-bar and Settings appearance controls.

## 11. Navigation behavior

Remove the final-product dependency on horizontal scroll-snap tool cards and the `1 / 6` style pager.

Target:

- tap primary destination -> direct surface change
- no horizontal swipe required to discover unrelated tools
- mini-player tap -> Player
- remote video started in Search remains connected to Search and can expand to Player
- More is a sheet/menu, not a seventh tool card

Existing panels may remain mounted internally during migration, but only one product surface should be visually dominant.

## 12. Visual design rules

### Preserve

- canonical WMS diamond emblem
- dark neon identity
- cyan/blue/purple accent family
- glass surfaces when they improve hierarchy
- optional immersive skins

### Change

- normal body text larger than current 8–10 px utility labels
- fewer nested borders
- fewer simultaneous glow effects
- 44 px minimum mobile touch target
- stronger thumbnail/artwork emphasis
- more empty space around the primary task
- consistent 8 px rhythm with 16/24 px section spacing

Recommended typography:

- page title: 24–32 px
- section title: 18–22 px
- media title: 14–17 px
- body: 13–16 px
- metadata: 11–13 px

Avoid 8–9 px text for normal user-facing information.

## 13. Accessibility

- visible keyboard focus
- `aria-label` for icon-only controls
- no color-only state
- respect `prefers-reduced-motion`
- sufficient contrast on all skins
- touch targets at least 44 x 44 CSS px where practical

## 14. Architecture implication

Current UI is assembled from the original `App.tsx` plus many DOM/Portal-based Enhancer components.

Do not add another long-lived Enhancer just to implement this redesign.

Migration direction:

1. keep proven playback/storage/provider engines
2. introduce explicit product-shell navigation state
3. move Search, Local, Player and More into first-class React composition
4. introduce one Download coordinator
5. gradually retire DOM-query/Portal shims

The number of Enhancers should decrease, not increase.

## 15. Implementation phases

### UI-R0 — design baseline

- this document
- compare Web and Android UX
- no CI required

### UI-R1 — navigation + Local correctness

- Search is default
- primary navigation = Search / Local / Player / More
- remove visible tool pager
- Recorder / Tools / Settings move under More
- remove always-visible Skin selector
- simplified Local shows both audio and video
- Local wording becomes media-oriented

Acceptance:

- first-time user lands on Search
- Local is directly reachable
- saved video is visible in Local
- no horizontal tool discovery required for primary tasks
- all existing major features remain reachable

### UI-R2 — Search + remote playback

- unified Search/URL treatment
- thumbnail-first cards
- remote video remains visible on Search after Play
- provider-specific secondary actions behind overflow

### UI-R3 — Download coordinator + Colab fallback

- one owner for Download action
- Cloud remains optional/preferred only while working
- Colab Companion reconnect flow restored as fallback
- no competing click interceptors
- fallback retains current target/format

### UI-R4 — Player redesign

- artwork/video/visualizer first
- primary transport simplified
- advanced playback options collapsed
- queue collapsible

### UI-R5 — Local/playlist polish

- thumbnail-first local rows
- item overflow
- playlists separated from storage diagnostics
- media metadata presentation improved

### UI-R6 — architecture cleanup

- replace DOM-query/Portal Enhancers with explicit component/state ownership
- remove redundant legacy CSS/navigation layers
- add focused regression tests for navigation, Local visibility and playback arbitration

## 16. CI / validation policy

Follow the Actions-saving policy.

For each UI-R gate:

1. branch / Draft PR
2. static review first
3. TypeScript/API/DOM selector/lifecycle regression review
4. local typecheck/build when available
5. mobile/desktop manual test plan
6. one full Web CI only for the finished gate when needed

Do not use CI as a layout-debug loop.

## 17. First implementation recommendation

Start with **UI-R1**.

It has the best risk/value ratio: fix information hierarchy and the concrete Local audio-only regression without changing proven playback/storage/provider engines. Then implement Download/Colab ownership in UI-R3 rather than mixing two download handlers into the first navigation patch.
