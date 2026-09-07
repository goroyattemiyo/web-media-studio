# YouTube background / screen-off behavior

Last updated: 2026-09-08 JST

## Confirmed target-device result

On the tested Android Chrome/PWA environment, an official YouTube IFrame Player video stops when the device screen is turned off.

This differs from local-media playback in Web Media Studio, which has already passed screen-off/background playback checks on the same target environment.

## Platform boundary

Web Media Studio uses the official YouTube IFrame Player API. It does not download, extract, proxy, or replace YouTube media streams.

YouTube's official help states that background playback is a YouTube mobile-app feature and requires YouTube Premium. Therefore the embedded PWA must not claim that it can force true screen-off/background playback.

Official references:

- https://developers.google.com/youtube/iframe_api_reference
- https://support.google.com/youtube/answer/7437614

## Web-side mitigation

The app can provide a Screen Wake Lock option while an embedded YouTube video is actively playing.

When enabled and supported by the browser:

- the app requests `navigator.wakeLock.request('screen')`
- the screen is prevented from automatically dimming/locking while the document remains visible
- the wake lock is released when playback pauses/ends or the option is disabled
- the app attempts to reacquire the lock after returning to the visible document if playback is still active

This is a usability workaround, not true screen-off playback. The user can still manually turn the screen off, in which case the tested YouTube embed stops.

Screen Wake Lock reference:

- https://developer.mozilla.org/docs/Web/API/Screen_Wake_Lock_API

## Product behavior

The YouTube panel should therefore surface these separately:

- `Repeat 1`: supported in the embedded player by reacting to the ENDED state and replaying from 0:00
- `Keep screen on`: best-effort Screen Wake Lock workaround
- `Screen off`: not claimed as supported for embedded YouTube; tested Android result is STOP
- `Open in YouTube`: official app/site handoff remains available for users who want YouTube's own background/Premium behavior
