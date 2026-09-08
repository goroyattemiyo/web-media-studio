# Player-first Play Queue — 2026-09-08

## Decision

WMS now treats the area directly below the Player as the primary playback queue surface.

The other cards are source / management surfaces:

- Library: import, persistence, saved-playlist management
- YouTube: official IFrame loading, Download companion, saved-playlist add, Play Queue add
- Recorder: capture and save sources
- Tools: conversion / editing

The user should not need to switch cards just to choose the next item.

## Implemented behavior

- `PLAY QUEUE / 次に再生` is rendered directly under the Player controls.
- the existing Local queue remains the playback-state source of truth but its old Library list is hidden.
- Local queue rows are mirrored under the Player and forward select/play, up/down and remove actions to the existing Local queue.
- YouTube adds a `＋ Queue` action.
- manual YouTube queue entries are stored locally and appear in the Player queue.
- selecting a YouTube queue item loads the official YouTube IFrame source and attempts playback without navigating the visible tool deck.
- when a named saved playlist is active, its YouTube entries are also surfaced under the Player beside its Local entries.
- the previous separate `MIXED SOURCES` Library surface is retired from the mounted UI.

## Boundaries

This is a unified control surface, not yet one unified media engine.

- Local audio/video still plays through the App HTMLMediaElement player.
- YouTube still plays through the official YouTube IFrame provider.
- playback arbitration continues to ensure only one source owns audible playback at a time.
- cross-provider automatic next-track continuation is not yet claimed.
- global cross-provider drag/reorder is not yet implemented; Local ordering and manual YouTube ordering are currently managed within their underlying groups.

## Validation

PR TypeScript typecheck: PASS.

PR production build: PASS.

Real-device UI / interaction validation is still required after Pages deployment, especially:

1. Local queue row -> select/play from Player card.
2. Local reorder/remove from Player queue.
3. YouTube `＋ Queue` -> Player queue.
4. YouTube queue row -> official IFrame load/play without manual card switching.
5. saved mixed playlist -> Local + YouTube entries visible in the Player queue.
