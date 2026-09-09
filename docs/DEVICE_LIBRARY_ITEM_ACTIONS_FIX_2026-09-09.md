# Device Library item actions fix — 2026-09-09

## Problem
UX-2 added per-item `…` actions to the canonical Local queue rows, but the simplified `保存済みの曲` browser is a separate UI and therefore showed no per-song `…` control.

## Fix
- add a per-song `…` trigger to each saved-audio row in the simplified Library browser
- bridge its commands to the existing canonical Local row controls
- keep the large Library-level `…` menu separate
- do not change playback logic
- do not add polling loops

## Validation
- Typecheck
- production build
- visual check: every saved-song row has its own `…`
- menu check: delete / move up / move down / remove from queue invoke the existing Local commands when that item is present in the active queue
