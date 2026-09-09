# UX-2 Contextual Secondary Actions — 2026-09-09

## Status

Implemented on `ux/contextual-secondary-actions` as UX-2 Slice 1.

## Goal

Reduce visible button density without changing the validated playback model.

## Visible Local Media Card actions

- `▶ 今すぐ再生`
- `＋ 次に再生`
- `…`

## Actions inside `…`

- save temporary media to the device library
- delete saved media from the device library
- move item up
- move item down
- remove item from the current playback queue

## Implementation boundary

The original App buttons remain mounted and are used as command targets. UX-2 only changes the visible interaction layer.

This deliberately preserves:

- existing Local playback state
- MediaCardSystem Play now / Play next behavior
- queue reorder logic
- media-library persistence logic
- P0 performance improvements

No polling timer was added. DOM discovery uses a requestAnimationFrame-throttled MutationObserver, consistent with the current enhancer architecture.

## Validation

Automated:

- TypeScript typecheck: PASS
- Vite production build: PASS

Post-deploy real-device checks:

1. Local card shows only primary Play now / Play next plus `…`.
2. `…` opens the secondary action menu.
3. Save / delete works.
4. Move up / move down works.
5. Remove from queue works.
6. Play next still places the item immediately after the current Local item.
7. Playback continues normally while the menu is opened/closed.

## Not changed in this slice

- named-playlist row actions
- Recorder result secondary actions
- FFmpeg result secondary actions
- YouTube source utilities
- cross-provider automatic next playback
