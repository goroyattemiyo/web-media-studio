# Unified Operation System — 2026-09-09

## Goal

Make WMS feel consistent regardless of where media is found. Source cards should focus on finding/importing media; listening decisions belong to Player / Queue; saved-playlist membership belongs near Player rather than inside every source card.

## Interaction rule

`Source -> 今すぐ再生 / 次に再生 -> Player + Queue -> プレイリスト`

### Source cards

YouTube now exposes the shared primary actions:

- `▶ 今すぐ再生`
- `＋ 次に再生`

Library file selection already appends selected local media to the local playback queue, so the Library shows that rule rather than adding another redundant queue button.

### Player / Queue

A `♡ プレイリスト` action is mounted beside the unified playback queue. It adds the currently selected/playing saved local media or YouTube item to an existing named playlist.

Temporary local imports must first be saved to the WMS local library before they can become durable saved-playlist entries.

Named playlist creation/management remains in Library for now; item membership is moved away from YouTube/source cards.

## Settings replaces Device Check

The sixth tool is presented as `⚙ 設定 / Settings`. The legacy small Device Check DOM remains mounted for compatibility but is visually replaced with a consolidated Settings card.

Settings includes:

- language shortcut
- skin
- visualizer
- explanation density
- background shortcut
- saved media count and bytes
- persistent-storage state
- user-facing device capability list

Capability information covers playback, Media Session/lock-screen integration, microphone recording, browser-tab audio capture, Web Audio analysis, FFmpeg/WebAssembly, Screen Wake Lock, IndexedDB, folder selection, Clipboard, PWA/Service Worker, and Secure Context.

Capability status is intentionally user-facing:

- `利用可能`
- `ブラウザ依存`
- `利用不可`

Raw API names remain secondary information.

## Current boundary

The unified queue still has separate Local and YouTube playback engines internally. This work unifies the interaction model and placement of controls; it does not claim complete automatic Local -> YouTube -> Local continuous cross-provider playback.

Recorder takes and FFmpeg results still use their existing local preview/save flows. A future step can give them the same `今すぐ再生 / 次に再生` actions once a provider-agnostic import-to-queue bridge is added.

## Validation

TypeScript typecheck/build must pass on the final branch head before merge. GitHub Pages deployment must pass after merge. Real-device review should verify the new Player playlist sheet, Settings card, and YouTube `今すぐ再生 / 次に再生` actions on mobile.
