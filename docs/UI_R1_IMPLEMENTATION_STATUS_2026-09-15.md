# UI-R1 / UI-R2 / UI-R3 Implementation Status — 2026-09-15

Branch: `feat/web-product-ui-r1`

## Goal

Replace the old horizontal tool carousel with a simple product navigation model, simplify Search, then make Player readable and usable on desktop/mobile without changing the playback/download backend in the same gate.

Primary destinations:

1. Search
2. Local
3. Player
4. More

## Implemented

### Product shell — UI-R1

- Search is the default destination.
- Removed the six-item horizontal tool-deck/pager interaction.
- Added a fixed four-item primary navigation: Search / Local / Player / More.
- Existing panels stay mounted so media/playback state is not destroyed while changing destinations.
- The shell exposes a `wms:navigate` event for cross-feature navigation without adding more scroll-only navigation shims.

### Search — UI-R2 first pass

- Search now has one obvious input for either keywords or a YouTube URL.
- A YouTube URL can be loaded directly even when the remote search worker is unavailable.
- The old duplicate YouTube URL form is kept mounted internally for compatibility but hidden from normal UI.
- Provider selection is moved behind a disclosure control instead of being permanently prominent.
- Search results remain thumbnail-first.
- `Play` and `Play next` are the visible primary actions.
- Download and source-site actions are moved behind a compact `•••` menu.
- The empty YouTube player is hidden until a direct URL or search result is actually loaded.
- Existing official IFrame playback and the current Download implementation are preserved.

### Local

- Simplified Local list now includes both saved audio and saved video instead of filtering to audio only.
- Primary import wording changed from songs/audio to endpoint media.
- Local remains a first-class destination rather than a secondary tool card.

### Player — UI-R3 first pass

- Player now uses a dedicated product layout rather than the old generic tool-card density.
- Video keeps a 16:9 first-class visual surface.
- Audio visualizers remain first-class and the visual selector remains available on Player.
- Track/source hierarchy and title readability are larger and clearer.
- Previous / Play-Pause / Next are visually stronger; ±10 controls remain available but are deliberately secondary.
- Shuffle / Repeat / A-B controls are visually grouped as secondary playback options.
- Speed / Volume are grouped separately from transport.
- Play Queue is collapsible and remembers the user's disclosure preference locally.
- Playlist action is grouped with Play Queue controls.
- Mini player now uses a YouTube thumbnail when available and a local-video preview for video sources; local audio falls back to the WMS artwork until embedded artwork metadata exists.
- Mini player uses product navigation instead of horizontal scroll positioning.
- On narrow iPhones the mini player keeps Previous / Play-Pause / Next visible and hides queue/playlist shortcuts first.
- Playback arbitration behavior itself is unchanged.

### More

- Recorder, FFmpeg/Audio tools, and Settings are grouped under More.
- Appearance/language controls are removed from the persistent header and remain reachable from Settings.
- Settings typography and control sizes were increased for readability/touch use.

### Header

- Persistent header is reduced visually to WMS branding.
- Skin/language selectors remain mounted internally for compatibility, but their normal UI lives in Settings.

## Colab / Download note

`ColabCompanionShell.tsx` still exists but is not mounted in production because it currently intercepts the same Download actions as `DirectCloudDownloadPanel.tsx`. Mounting both would create competing Download handlers.

Do not simply re-enable the Colab shell in `main.tsx`.

Next Download architecture should introduce one explicit execution-engine router, then expose engines such as:

- Local Companion / native local engine
- Home Worker
- Colab Companion fallback

Cloud Run remains the current production Download path until that gate is implemented or retired. BUFFALO NAS remains only a future infrastructure candidate and is not part of this UI gate.

## Static review completed

- Branch is based directly on current `main` and is not behind it.
- Primary panel IDs verified in `App.tsx`: `player-panel`, `library-panel`, `recorder-panel`, `ffmpeg-tools-panel`, and `.device-panel`.
- YouTube provider is still mounted into `.side-stack` as `youtube-provider-panel`.
- `mediaSourceBridge.ts` still drives the hidden YouTube URL form, so the unified Search input can load direct YouTube URLs without duplicating player state.
- Settings still controls hidden skin/language elements, so removing them from the persistent header does not remove functionality.
- Search-result Download links keep the existing selector shape expected by `DirectCloudDownloadPanel.tsx`.
- Player changes are presentation/state-disclosure changes; media elements and core App playback handlers remain intact.
- Mini-player thumbnail changes do not introduce a second playback source; its local video element is muted metadata preview only.
- No GitHub Actions workflow has been run for this gate yet.
- No PR has been opened yet because `pages.yml` runs typecheck/build on every PR and the project policy is to avoid CI until the gate is ready.
- A local clone/typecheck was attempted from the execution environment, but outbound DNS to GitHub is unavailable there. This is not counted as a passed check.

## Manual verification required before Ready for review

Desktop:

- Search is the first visible surface after reload.
- Search / Local / Player / More buttons switch surfaces without horizontal page snapping.
- Keyword search returns thumbnail results.
- Direct YouTube URL paste loads the official player without requiring the search worker.
- Play and Play next work from search results.
- `•••` exposes Download and source-site actions.
- Current Download flow still opens from a search result.
- YouTube playback continues correctly when browsing another destination.
- Local audio and video both appear in the simplified Local list.
- Player title, timeline, transport, secondary controls and visualizer are readable.
- Play Queue expands/collapses and playlist add remains reachable.
- More shows Recorder, Audio tools, and Settings.
- Settings can change language, skin, visualizer, and background.
- Mini player does not overlap primary navigation.

Mobile / iPhone-size viewport:

- Four primary buttons fit without horizontal scrolling.
- Touch targets are usable.
- Content is not hidden behind mini player + bottom navigation.
- Unified Search input and result cards stay within viewport width.
- Direct YouTube URL paste works from Safari-sized layout.
- Local list is readable and playable.
- Player keeps the 16:9 video/visualizer surface within the viewport.
- Mini player shows media preview plus Previous / Play-Pause / Next on narrow iPhone widths.
- More sections stack vertically.

## Next gate

Before Ready for review:

1. Perform desktop + iPhone-size manual rendering/interaction verification.
2. Fix any layout/regression issues found there.
3. Only when the gate is otherwise complete, run the single planned typecheck/build CI according to the repository CI-saving policy.
4. Then open/ready the PR and merge only after the UI gate passes.

Download execution backends remain a separate gate. Reintroduce Colab Companion only after one Download router exists.
