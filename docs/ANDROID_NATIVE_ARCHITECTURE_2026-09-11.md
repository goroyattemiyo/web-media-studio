# WMS Android Native Architecture — 2026-09-11

Status: **Approved design target before implementation**

This document defines the first native Android architecture for WMS. It is intentionally small enough to reach a real-device end-to-end test quickly while keeping the acquisition engine replaceable.

## 1. Core outcome

The Android app exists to make this loop reliable:

`Share URL -> local acquisition -> local library -> playlist -> native background playback`

The saved local file, not the remote provider session, becomes the playback source. That is what makes offline and screen-off playback reliable.

## 2. Recommended project shape

Dedicated repository after bootstrap:

`goroyattemiyo/web-media-studio-android`

Suggested package layout:

```text
app/
  src/main/java/.../wms/
    app/
    intake/
    acquisition/
    library/
    playlist/
    playback/
    storage/
    ui/
    common/
```

Responsibilities:

- `intake` — Android share intent parsing and URL validation
- `acquisition` — source resolution/download/extraction only
- `library` — media metadata and local file lifecycle
- `playlist` — saved playlists and ordered entries
- `playback` — Media3 player/session/service
- `storage` — Room database and file paths/export
- `ui` — Compose screens/sheets

## 3. URL intake

Android `ACTION_SEND` with `text/plain` is the primary intake path.

The app must:

1. accept shared text
2. extract an HTTP(S) URL
3. reject malformed/credential-bearing URLs
4. normalize the URL
5. open an Import sheet
6. do nothing irreversible until the user presses Save

The same intake API should also support manual URL paste for debugging and sources whose app does not expose a useful share target.

## 4. Acquisition engine boundary

Do not call yt-dlp directly from Compose screens.

Use an interface similar to:

```kotlin
interface MediaAcquisitionEngine {
    suspend fun probe(source: SourceUrl): ProbeResult
    suspend fun acquire(request: AcquisitionRequest): AcquisitionResult
    fun cancel(jobId: String)
}
```

`ProbeResult` contains only sanitized metadata needed by WMS, such as title, provider, duration, thumbnail reference and available output capability.

`AcquisitionRequest` includes:

- normalized source URL
- output mode: audio/video
- selected output format/preset
- destination job directory

No generic arbitrary yt-dlp arguments are exposed through the UI.

## 5. First acquisition implementation

### Gate candidate: youtubedl-android

Use `io.github.junkfood02.youtubedl-android` behind the engine interface for the first feasibility spike.

Reasons:

- packaged for Android
- wraps yt-dlp execution
- bundled Python runtime
- optional FFmpeg module
- proven integration pattern in existing Android downloader projects

Important constraint: the project is GPL-3.0 licensed. Development/private distribution is the current scope, but license obligations must be reviewed before any broader binary distribution.

### Fallback candidate

If the youtubedl-android runtime is unstable on the target device, keep the engine interface and spike a second implementation based on embedded Python/yt-dlp plus an Android-compatible FFmpeg binary layer.

Do not redesign the entire app around the first extractor choice.

## 6. Acquisition job execution

Acquisition may continue while the activity leaves the foreground, so the operation must not depend on a Compose coroutine owned by a screen.

Preferred MVP shape:

- app-level `AcquisitionRepository`
- one active acquisition at a time initially
- foreground `MediaAcquisitionService` while a download/conversion is active
- persistent notification with title/progress/cancel
- temporary per-job directory
- atomic move/registration only after successful completion
- cleanup failed/cancelled temporary files

Later, queued downloads can be added only after one-job reliability is proven.

## 7. File/storage model

Canonical WMS media should live in app-managed storage first.

Recommended initial location:

- app-specific external files directory when available for larger media capacity
- internal app files fallback if external app-specific storage is unavailable

Benefits:

- no broad filesystem permission required
- stable app-owned path
- works with Scoped Storage
- WMS controls cleanup consistently

Tradeoff: app-specific media is removed when the app is uninstalled.

Therefore add an explicit `Export` action later using Android MediaStore / Storage Access Framework for media the user wants outside WMS.

Do not use shared Downloads as the canonical database path for MVP.

## 8. Room data model

Minimum entities:

### MediaEntity

- id
- title
- provider
- originalUrl
- localPath / localUri
- mimeType
- mediaType: audio/video
- durationMs
- fileSize
- artworkUri/thumbnail metadata if available
- createdAt
- lastPositionMs

### PlaylistEntity

- id
- name
- createdAt
- updatedAt

### PlaylistEntryEntity

- playlistId
- mediaId
- position

### AcquisitionJobEntity

- id
- sourceUrl
- status: queued/running/succeeded/failed/cancelled
- outputMode/format
- progress
- sanitizedError
- createdAt/updatedAt

Do not store secrets, cookies or raw extractor diagnostics in Room.

## 9. Playback architecture

Use AndroidX Media3 with ExoPlayer.

Because WMS has a persistent media library and playlists, prefer `MediaLibraryService` rather than keeping the player inside the Activity.

```text
Compose UI
   |
MediaController
   |
MediaLibraryService
   |
MediaSession
   |
ExoPlayer
   |
local WMS media files
```

The service owns playback state. The Activity may be destroyed while playback continues.

Required service behavior:

- audio focus
- notification/system media controls
- previous/next
- seek
- repeat/shuffle later
- restore active queue and position
- keep playback alive when screen is locked according to Android foreground-media rules

Android's current Media3 guidance explicitly supports background playback by housing the Player/MediaSession in a media service. A library-oriented app may use `MediaLibraryService` for the same purpose.

## 10. Playlist behavior

MVP playlist rules:

- completed acquisition automatically appears in `All media`
- Import sheet can optionally choose a target playlist
- one active playback queue
- ordered persistent playlist entries
- queue survives app/activity restart
- screen-off Next continues to the next local file

Remote URLs are not the playback queue item after acquisition. The queue points at local WMS media IDs.

## 11. UI architecture

Keep first UI deliberately smaller than the Web/PWA studio.

### Home / Now Playing

- artwork/visual area
- title/source
- play/pause
- previous/next
- seek
- queue button
- Library button

### Shared URL Import sheet

- detected title/provider or `Checking…`
- `Audio` / `Video` choice
- simple format preset
- target playlist optional
- `Save to WMS`
- compact permissions notice

### Downloads/Jobs

- current job only for MVP
- progress
- cancel
- sanitized error/retry

### Library

- All media
- playlists
- delete from WMS
- export later

Avoid advanced equalizer/recorder/visualizer work until the share-save-play-background loop passes on a real device.

## 12. Initial format policy

MVP priority:

1. audio save
2. MP3 192 kbps for compatibility
3. M4A where extraction/conversion is proven stable
4. video save after audio flow is reliable
5. WAV remains a specialist option, not a default mobile-download format because of file size

The product UI should say `Audio` / `Video` first; codec/bitrate belongs in an expandable advanced section where possible.

## 13. Provider handling

The engine may support many yt-dlp extractors, but WMS presents provider support conservatively.

First validation matrix:

- YouTube public video
- TikTok public video
- Instagram public Reel/post that is accessible without login
- direct public media URL

For each provider record:

- probe pass/fail
- audio acquisition pass/fail
- video acquisition pass/fail when implemented
- filename/title correctness
- cancel behavior
- screen-off local playback after save

A provider name is not marked `supported` until at least one real-device E2E test succeeds. Login-only/private/DRM-protected URLs remain unsupported.

## 14. Security and privacy

- no hidden upload to WMS servers
- acquisition runs locally on the Android device
- no account cookie import in MVP
- no proxy rotation
- no DRM bypass
- no authentication bypass
- reject URL credentials
- sanitize filenames
- isolate temporary job directories
- cap concurrent jobs initially to one
- add configurable duration/file-size guards after the first successful feasibility spike

## 15. Development distribution

No Play Store work in the first project.

CI target:

- Gradle build
- unit tests
- lint
- debug APK artifact

For repeatable install/update testing later, add a stable development signing key through GitHub Actions secrets; never commit a keystore or password.

A GitHub Release APK can be added only after real-device install/update flow is verified.

## 16. Definition of Android MVP

Android MVP is complete only when the tested device can:

1. share a permitted public media URL from another app to WMS
2. see WMS identify/probe the source
3. save audio locally without Colab or Cloud Run extraction
4. see the saved item in WMS Library
5. add/load it in a persistent playlist
6. start playback
7. lock the screen
8. continue playback
9. use system Pause/Play and Next
10. reopen WMS with library/playlist state preserved

No individual component success substitutes for this end-to-end gate.
