# Android Import Validation — 2026-09-07

## Result

Android real-device testing confirmed that the browser/file-picker used on the target phone does not expose the current `Folder` control as a true whole-directory import. Tapping it opens a normal file chooser instead of returning the complete selected directory tree.

The regular file-import control supports selecting multiple media files and is therefore the primary Android workflow for now.

## Confirmed on target Android device

- multiple local audio/video file selection: PASS
- selected files are added to the playlist: PASS
- playback from the imported list: PASS

## Platform limitation observed

- `webkitdirectory` / `directory` cannot be treated as reliable Android folder-import support across the tested browser/file-picker combination
- do not describe Android whole-folder import as confirmed

## Product decision

Use **multiple file selection** as the primary mobile import path.

Keep **Folder** as a progressive-enhancement path for desktop or browsers/file pickers that genuinely return directory-relative files.

The UI should eventually make this distinction explicit rather than implying that Folder is universally supported on mobile.
