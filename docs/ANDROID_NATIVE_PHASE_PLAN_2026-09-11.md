# WMS Android Native Phase Plan — 2026-09-11

Status: **Execution plan**

This phase plan follows `PLATFORM_DIRECTION_2026-09-11.md` and `ANDROID_NATIVE_ARCHITECTURE_2026-09-11.md`.

The plan intentionally attacks the highest-risk technical assumption first: whether a fully local Android acquisition engine can reliably resolve and save permitted public media on the actual target device.

## Gate A0 — Local acquisition feasibility

Goal: prove the app can execute the local extractor/FFmpeg path on Android before building the full UI.

Deliverables:

- minimal native Android project
- Kotlin/Gradle build in a dedicated Android repository
- initialize `youtubedl-android` library + FFmpeg module
- manual URL field and one `Probe` / `Save audio` path
- app-specific output directory
- sanitized status/error output
- one active job only
- no cookies, proxy, DRM or auth-bypass options

Real-device acceptance:

- app installs on target Android device
- public permitted test URL probe succeeds
- one audio file is produced locally
- produced file is playable through Media3/ExoPlayer

Test order:

1. YouTube public permitted sample
2. direct public media URL
3. TikTok public sample
4. Instagram public Reel/post accessible without login

Only the first successful source is required to exit Gate A0; the multi-provider matrix continues later.

Fallback decision:

- if `youtubedl-android` fails for a runtime/ABI reason that cannot be fixed cleanly, keep the `MediaAcquisitionEngine` interface and spike an embedded-Python alternative
- do not build provider-specific workarounds before understanding the runtime failure

## Phase A1 — Native shell + share target

Goal: make WMS appear in Android's normal share flow.

Deliverables:

- WMS branding/icon
- Compose app shell
- `ACTION_SEND text/plain` intent filter
- URL extraction/normalization
- manual URL paste fallback
- Shared URL Import sheet
- no automatic download when a URL arrives

Acceptance:

- Chrome share -> WMS opens with URL populated
- YouTube app share -> WMS opens with URL populated
- at least one additional app share path is tested
- malformed shared text fails clearly

## Phase A2 — Acquisition service

Goal: turn the feasibility code into a durable product service.

Deliverables:

- `MediaAcquisitionEngine` interface
- production implementation behind the interface
- `MediaAcquisitionService` foreground service
- progress notification
- cancel
- per-job temp directory
- completion/failure cleanup
- Room `AcquisitionJobEntity`
- audio preset UI: default MP3 192 kbps, M4A after validation

Acceptance:

- acquisition continues when the Activity is backgrounded
- cancel stops the job and removes partial output
- failed jobs do not pollute Library
- successful output moves atomically into WMS-managed media storage

## Phase A3 — Native Library + persistent playlists

Goal: make completed acquisitions immediately useful.

Deliverables:

- Room `MediaEntity`, `PlaylistEntity`, `PlaylistEntryEntity`
- All media screen
- create/delete/rename playlist
- add acquired item to selected playlist
- ordered persistent playlist
- remove from playlist without deleting media
- delete from WMS with file cleanup

Acceptance:

- completed acquisition appears in All media
- playlist survives Activity/app restart
- deletion removes both metadata and owned file when requested

## Phase A4 — Background playback

Goal: satisfy the core screen-off use case.

Deliverables:

- Media3 ExoPlayer
- `MediaLibraryService`
- MediaSession
- MediaController from Compose UI
- foreground playback notification
- system/lock-screen Play/Pause/Previous/Next/seek
- queue restoration
- resume position

Real-device acceptance:

- local playlist plays
- screen locks without stopping playback
- automatic next item works while locked
- lock-screen Pause -> Play works
- lock-screen Next works
- reopen app reconnects to the same service/session state

## Phase A5 — End-to-end Share -> Save -> Playlist -> Lock

Goal: remove developer-only seams between the previous phases.

Golden path:

`Share -> Import sheet -> Save to WMS -> completion -> playlist -> Play -> screen off -> Next`

Deliverables:

- sensible automatic navigation after acquisition
- optional target playlist at save time
- compact errors/retry
- duplicate URL/media handling policy
- clear storage usage
- no extractor logs exposed by default

Acceptance:

- full golden path passes on the target Android device without Colab, Cloud Run extraction or browser copy/paste

## Phase A6 — Multi-provider validation

Goal: broaden beyond YouTube without making unsupported promises.

Validation matrix per provider:

- YouTube public URL
- TikTok public URL
- Instagram public URL accessible without account login
- direct media URL

For each source:

- Share intake
- probe
- audio save
- local playback
- error classification
- retry/cancel

Video output is added here or later only after audio acquisition is stable.

Provider UI states:

- VERIFIED — real-device E2E passed
- BEST EFFORT — extractor recognizes source but E2E coverage is incomplete
- UNSUPPORTED — login/DRM/access requirement or known failure

## Phase A7 — Development distribution

Goal: make builds easy to install on personal/test devices without a store.

Deliverables:

- GitHub Actions Android CI
- Gradle unit test + lint + assembleDebug
- downloadable APK artifact
- versionName/versionCode policy
- installation instructions
- later: stable development signing through GitHub Secrets for upgradeable APKs
- optional GitHub Release after signing/update test passes

Non-goal: Google Play publication/review work.

## Phase A8 — Daily-use polish

Only after the core loop is used successfully:

- richer Now Playing UI
- thumbnail/artwork caching
- audio/video choice polish
- export to Music/Downloads via MediaStore
- sleep timer
- queue reorder
- playback speed/A-B repeat ports from Web WMS where useful
- download queue >1 only if needed

## Deferred tracks

Do not start these before Android A5 unless there is a blocking reason:

- Windows native WMS
- Chrome extension companion
- cloud extraction redesign
- broad account-authenticated provider support
- provider-specific cookie workflows
- Play Store distribution
- advanced visualizers/recorder parity

## Development discipline

For each Android phase:

1. create feature branch
2. update/implement smallest coherent slice
3. run Android CI
4. review security/storage/lifecycle behavior
5. merge only when CI is green
6. mark real-device acceptance separately; CI cannot substitute for device tests
7. update canonical WMS docs after a meaningful gate

## Immediate next action

After this design is merged, bootstrap the dedicated Android implementation repository and execute **Gate A0 only**. Do not build the full player UI until local acquisition feasibility has been proven on the target Android device.
