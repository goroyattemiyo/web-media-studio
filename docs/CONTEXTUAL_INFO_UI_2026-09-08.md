# Contextual Info UI — 2026-09-08

## Decision

WMS should keep the primary interface focused on controls and current state. Static explanations and usage tips should not occupy permanent vertical space.

## Implemented pattern

- contextual circular `i` buttons are attached to major surfaces
- tapping an info button opens a compact modal / mobile bottom sheet
- tapping outside, the close button, or pressing Escape closes the sheet
- operational errors, active processing status and action feedback remain visible in place
- static guidance is moved out of the always-visible layout

Covered surfaces:

- Player
- Play Queue
- Local Library
- Saved Playlist
- YouTube
- Recorder
- FFmpeg Audio Tools
- Device Check

## Static text removed from the main surface

The new compact layer hides or retires always-visible explanatory copy such as:

- section descriptions
- queue usage notes
- Recorder long-form tab-audio instructions
- FFmpeg local-processing note
- Device Check caveat paragraph
- detailed tab-capture capability text
- old pseudo-element tool descriptions

Important errors and live status messages are intentionally not hidden.

## UX intent

Default view: concise title + controls + current status.

On demand: tap `i` for explanation, limitations and tips.

This keeps the mobile card deck shorter while preserving discoverability for less obvious functions.
