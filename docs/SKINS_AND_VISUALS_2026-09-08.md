# Skins and player visuals — 2026-09-08

## Scope

WMS appearance was expanded without changing core media playback, playlist, recorder, YouTube, or FFmpeg behavior.

## Skins

WMS now exposes 10 color skins:

1. Midnight Neon
2. Obsidian
3. Studio Light
4. Analog Warm
5. Cyber Blue
6. Aurora Purple
7. Emerald Night
8. Crimson Noir
9. Sunset Glow
10. Sakura

The five original skins remain available. New skin selection is persisted locally and legacy skin preference is used as the initial fallback when the new preference key has not yet been written.

## Local-player visuals

WMS now exposes 6 local-audio player visuals:

1. Emblem Spin
2. Pulse Rings
3. Orbit
4. Neon Bars
5. Wave Grid
6. Minimal

Motion is tied to actual local-media playback state. Pausing playback pauses the animation. `prefers-reduced-motion: reduce` disables motion.

These modes are intentionally lightweight CSS/DOM animations. `Neon Bars` and `Wave Grid` are animated visual treatments; they are not yet driven by real-time audio frequency/amplitude analysis.

## Architecture

The expansion is implemented through `SkinVisualEnhancer.tsx` and `skin-visual-enhancer.css`, mounted from `main.tsx`.

This keeps the existing player transport/state model unchanged and makes future skins and visual modes additive.

The enhancer re-applies the selected skin if the core App is remounted, including after a Local Library refresh/import flow.

## Validation

PR #44 pre-merge Pages workflow:

- TypeScript typecheck: PASS
- Vite build: PASS

Real-device visual review remains required for final subjective tuning of animation size, speed and contrast on Android/PWA.
