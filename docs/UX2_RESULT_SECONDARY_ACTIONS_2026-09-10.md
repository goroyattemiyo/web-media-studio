# UX-2 Result Secondary Actions — 2026-09-10

## Scope
Recorder and FFmpeg result cards now follow the same primary/secondary action hierarchy as Local Media Cards.

## Visible primary actions
- Play now
- Play next
- More (`…`)

## More menu
### Recorder
- Save to device
- Delete recording

### FFmpeg
- Save to device

## Implementation rule
The original Recorder/FFmpeg download and delete controls remain mounted and are used as the canonical command targets. UX-2 only changes presentation and does not replace playback or storage logic.

## Validation
- Typecheck: PASS
- Build: PASS
- no new polling loop added
- playback logic unchanged

## Production verification after merge
- Recorder take: `…` appears and Save/Delete work
- FFmpeg result: `…` appears and Save works
- Play now / Play next remain visible and functional
