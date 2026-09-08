# Persistent playback + floating mini player — 2026-09-09

## Purpose

WMS tool/card navigation must not interrupt the audio source that is already playing. Playback controls should remain available while browsing another WMS card.

## Rule

- Navigating Player / Library / YouTube / Recorder / Tools / Settings does **not** claim or switch playback.
- Playback arbitration runs only when a Local or YouTube source actually starts playback.
- Starting Local pauses YouTube; starting YouTube pauses Local.
- The full Player remains the canonical playback engine. The floating mini player only forwards controls to it.

## Floating mini player

When a source is loaded and the full Local Player card is not in view, WMS shows a floating mini player in the previous pager area.

Controls:
- current title / source; tap to return to active Player or YouTube card
- previous / play-pause / next for Local playback
- play-pause for YouTube
- queue shortcut
- playlist shortcut

The normal tool navigation remains available underneath. The small page pager is hidden while the mini player is visible to avoid another stacked control row.

## Platform boundary

This change fixes WMS-internal navigation. It does not bypass browser or OS background-media policy. In particular, an embedded YouTube IFrame may still be suspended when the browser tab is backgrounded or the screen is turned off, depending on browser/OS policy. Local HTMLMediaElement playback and Media Session support remain subject to the same device/browser implementation constraints.
