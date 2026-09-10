# UX-3 Video Search Provider Plan — 2026-09-10

Status: implementation branch. This supersedes the YouTube-only UX-3 search direction.

## Product goal

The YouTube tab becomes WMS's video discovery surface instead of a YouTube-only URL loader.

Search flow:

`keyword -> configured providers -> common Video Card -> play / queue where supported / Download where supported / open source`

## Provider architecture

### YouTube

- search: YouTube Data API v3
- WMS playback: existing official YouTube IFrame
- Play next: existing unified YouTube queue
- Download: existing Colab Localizer route
- required worker secret: `YOUTUBE_DATA_API_KEY`

### Vimeo

- search: Vimeo API
- WMS playback: Vimeo official embed URL in the search surface
- Play next: not implemented in the unified provider queue yet
- Download: selected public URL is copied to the existing Colab Localizer; actual support remains subject to yt-dlp/site availability and content rights
- optional worker secret: `VIMEO_ACCESS_TOKEN`

### Google Web Search Service

Reserved provider only; not enabled in this phase.

Reason:

- it is a general web-search API, not a dedicated video catalog
- it requires an API key plus partner-agreement `client_id`
- the API also requires end-user context
- WMS must validate partner terms and video-result filtering before enabling it

Do not fall back to scraping or pretend Custom Search provides an equivalent video API.

## Shared result schema

Each result owns:

- provider
- source ID
- canonical URL
- title
- author/channel
- published time if available
- thumbnail if available
- embed URL if available
- playback mode (`youtube`, `iframe`, `external`)
- queue capability
- Download capability

This allows new providers to be added without redesigning the result card.

## UX rules

- submit-only search; no search-as-you-type
- maximum 8 combined results per request
- provider selector: All / enabled individual providers
- disabled providers are visible as unavailable rather than silently failing
- provider badge is always visible on each result
- source-site link is always available
- WMS never claims every provider supports the same playback or Download behavior

## Current phase boundary

Implemented in this branch:

- provider-based `/video/providers`
- provider-based `/video/search`
- YouTube compatibility endpoint retained
- YouTube provider
- optional Vimeo provider
- common Video Search UI
- Vimeo official inline embed
- common Download handoff to Colab for providers explicitly marked compatible
- Google Web provider reserved/disabled

Not implemented yet:

- provider-neutral Play Queue
- Floating Mini Player control of Vimeo
- automatic Local <-> YouTube <-> Vimeo next-track switching
- Google Web Search Service production integration
- Dailymotion provider

## Validation gate

Before merge:

1. frontend Typecheck PASS
2. frontend Build PASS
3. media-worker pytest PASS
4. media-worker Docker build PASS
5. existing `/youtube/search` compatibility tests PASS
6. generic YouTube result test PASS
7. generic Vimeo result mapping test PASS

After merge:

- Pages deploy PASS
- Cloud Run deploy PASS
- `/video/providers` live check
- `/video/search?provider=youtube` live check
- Vimeo is marked enabled only if `VIMEO_ACCESS_TOKEN` exists
