# UX-1 Common Media Card — Slice 1 Result — 2026-09-09

## Goal

Start Phase UX-1 without changing the Player playback/state model or undoing the validated P0 performance foundation.

Product rule:

> A playable object should look and behave like the same WMS object regardless of where it came from.

## Implementation branch

- branch: `ux/common-media-card-system`
- PR: #58
- base: production `main` after P0 real-device CORE PASS

## Completed

### 1. Shared Media Card visual language

The following playable objects now receive the shared `wms-media-card` treatment:

- Local queue / Library media row
- loaded YouTube media
- Recorder saved take
- FFmpeg conversion result

Shared treatment includes:

- consistent card border / radius / surface
- accent edge treatment
- common spacing for playback actions
- current Local item emphasis
- mobile layout overrides
- reduced-motion compatibility

The source-specific information remains intact instead of being flattened into fake metadata.

### 2. Local media gets the common primary action pair

Local media rows now expose:

- `▶ 今すぐ再生`
- `＋ 次に再生`

`▶ 今すぐ再生` selects the existing Local row and starts the existing Player. It does not create another media item or another playback engine.

`＋ 次に再生` reuses the existing Local queue reorder controls:

- when a Local current item exists, the selected row is moved directly after it
- when no Local current item exists, the selected row is moved toward queue head
- if the selected row is already the Local current item, WMS reports that state instead of pretending to queue a duplicate

This keeps one canonical Local queue.

### 3. YouTube primary actions move onto the loaded media card

After a YouTube video is loaded, the common Play / Next action pair is rendered on the loaded YouTube media card next to the title/source information.

The source utility actions remain separate:

- Download via Colab
- Import downloaded audio into Local Library

This separates “what to do with this playable item” from source/import utilities.

### 4. Recorder / FFmpeg result actions remain compatible

Recorder saved takes and FFmpeg conversion results already had:

- Play now
- Play next

UX-1 gives those result objects the same card surface as Local and YouTube without changing their blob-to-Player bridge.

Save-to-device remains a secondary action.

## Performance guardrail

This phase does not reintroduce periodic polling.

Media Card discovery uses a `MutationObserver` throttled through `requestAnimationFrame`. The Player playback core remains mounted and P0 visualizer throttling remains in place.

## Boundaries / not claimed

- The active Local list is still also the canonical Local queue; UX-1 does not create a second Library-only data model.
- Local `Play next` is Local-queue reordering. It does not implement automatic provider switching around a currently playing YouTube item.
- Full automatic Local ↔ YouTube continuous next-playback remains unimplemented.
- Secondary Local Save/Delete/Reorder controls remain visible in this slice. Moving them behind `…` belongs to UX-2 contextual controls.
- Duration is shown only where existing source metadata already exposes it; UX-1 does not probe every media file solely to populate card metadata.

## Automated validation

PR head before this documentation commit:

- TypeScript typecheck: PASS
- Vite production build: PASS
- PR deploy: skipped as expected

Final PR head should repeat Typecheck / Build before merge.

## Real-device checks after production deployment

1. In Library, confirm every Local media row has the common Play now / Play next pair.
2. Play a Local item from its card and confirm Floating Mini Player / Player state follow correctly.
3. Use Local Play next and confirm the row moves directly after the current Local item.
4. Load a YouTube URL and confirm Play now / Play next appear on the loaded YouTube media card rather than being mixed with Download / Import utilities.
5. Create or open a Recorder take and confirm the same card surface + Play now / Play next remain usable.
6. Produce an FFmpeg result and confirm the same card surface + Play now / Play next remain usable.
7. Check mobile width and at least one dark skin plus Studio Light.
8. Confirm navigation/playback remains as smooth as the P0 baseline.

## Next UX-1 / UX-2 candidate

After real-device validation:

- move secondary Local Save/Delete/Reorder controls behind one `…` menu
- establish consistent queued / playing state badges across source types
- optionally add source artwork/icon slots without increasing card height materially
- then proceed to UX-2 contextual control reduction
