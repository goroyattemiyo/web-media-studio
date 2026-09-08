# Immersive UI Simplification Result — 2026-09-09

## Goal

Reduce always-visible explanatory text and button density so WMS can be operated primarily by visual cues, short labels, and one clear action per area.

## Implemented on this branch

### Central system message area

Changing Library, Playlist, Queue, YouTube, Recorder, and FFmpeg status/error text is mirrored into a single system-message bar below the header. The original transient messages remain mounted for component state/accessibility integration but are hidden visually to avoid repeated small text across cards. The message bar can be tapped to expand long text.

### Local Library simplification

The primary action is `端末の曲を選ぶ`. Secondary folder/save/temporary-clear actions are moved into an overflow menu. WMS-saved audio is listed together in a dedicated selector and can be sent back to the Player/queue through the existing library state.

Browser boundary: WMS cannot silently enumerate the user's whole device filesystem. It only receives files/folders explicitly selected by the user through the browser picker, plus media that WMS previously stored in its IndexedDB library.

### YouTube source simplification

The URL field is the dominant source control. Pasting a valid source triggers the existing form submission automatically. The redundant visible Load button is hidden; keyboard Enter submission remains available. Clear is reduced to a compact × action.

### Audio visualizers

New logo-independent Canvas visualizers:

- Rainbow Ring
- Oscilloscope
- Spectrum City
- Neon Tunnel
- Kaleido
- Particle Field

For local HTML media, WMS attempts to connect a Web Audio `AnalyserNode` and uses frequency/time-domain data. If Web Audio analysis is unavailable, the same visual modes remain usable with a lightweight synthetic-motion fallback. Existing Pulse Rings, Orbit, Neon Bars, Wave Grid, Emblem Spin, and Minimal remain available.

The YouTube official IFrame is intentionally not routed through this local analyser. Cross-origin embedded YouTube audio is treated as a separate provider boundary.

### Experience skins

New skins change more than palette:

- 8-bit Arcade — grid/pixel treatment, square geometry, monospace typography
- LED Marquee — amber/red dot-matrix surface and glowing display typography
- Retro Terminal — green phosphor, scanline layer, monospace controls
- Cassette Deck — warm analog palette, serif typography, hardware-like inset surfaces

Existing color skins remain available.

## Validation

PR typecheck/build CI passed on the implementation branch. Real-device regression is still required for the Web Audio analyser modes, specifically to confirm that local audio remains audible while an analyser visualizer is active across target Android/desktop browsers.
