# Recorder / FFmpeg common source actions — 2026-09-09

## Decision

WMS source/result surfaces use the same primary listening actions:

- `▶ 今すぐ再生` / `▶ Play now`
- `＋ 次に再生` / `＋ Play next`

Playlist membership remains a Player/Queue responsibility through `♡ プレイリスト`.

## Recorder results

Each Saved take can be sent to the main Local Player. The take's blob URL is converted to a browser `File` and passed through the existing Library import path.

The take card's native `<audio controls>` is hidden once the common actions are mounted. `Save to device` remains available as a secondary action.

## FFmpeg results

Each completed audio conversion uses the same actions and the same Local Player import path. Conversion/download behavior is unchanged.

## Queue semantics

`Play now`:
1. import the result into the current Local queue;
2. select it;
3. start the main Player;
4. navigate to the Player card.

`Play next`:
1. import the result into the Local queue;
2. move the newly imported item directly after the current Local item.

If no current Local item can be identified, the imported result stays at the queue tail.

## Persistence boundary

These common actions add result media to the current Local queue as temporary media. They do not change the existing persistence policy:

- Recorder's existing recording persistence remains unchanged.
- Tab/mix recorder behavior that also writes to Local Library remains unchanged.
- FFmpeg output remains downloadable to the device unless separately saved/imported by the user.
- Temporary queue media must correspond to a saved Local Library item before it can be stored in a named playlist.

## Feedback

Success and failure messages are dispatched to the shared WMS system-message area instead of adding new persistent help text to each result card.
